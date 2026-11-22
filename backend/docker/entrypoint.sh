#!/bin/sh
# Container start: fix storage permissions, wait for the database, cache config, optionally migrate,
# then run php-fpm (app) or the given command as www-data (scheduler, one-off artisan commands).
set -e
cd /var/www/html

# storage/ is a volume: make sure the skeleton exists and www-data can write it
mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/app/private
chown -R www-data:www-data storage bootstrap/cache

if [ -z "$APP_KEY" ]; then
  echo 'APP_KEY is not set in .env. Generate one with: echo "base64:$(openssl rand -base64 32)"' >&2
  exit 1
fi

wait_for_db() {
  i=0
  until php -r '
    $dsn = getenv("DB_SOCKET") ? "mysql:unix_socket=".getenv("DB_SOCKET") : "mysql:host=".getenv("DB_HOST").";port=".(getenv("DB_PORT") ?: 3306);
    try { new PDO($dsn.";dbname=".getenv("DB_DATABASE"), getenv("DB_USERNAME"), getenv("DB_PASSWORD")); }
    catch (Throwable $e) { fwrite(STDERR, $e->getMessage()."\n"); exit(1); }'; do
    i=$((i+1)); [ $i -ge 30 ] && { echo "Database not reachable (socket: ${DB_SOCKET:-none}, host: $DB_HOST)" >&2; exit 1; }
    echo "Waiting for database..."; sleep 2
  done
}

cache() {
  su-exec www-data php artisan config:cache
  su-exec www-data php artisan route:cache
  su-exec www-data php artisan view:cache >/dev/null 2>&1 || true
}

if [ "$1" = "php-fpm" ]; then
  wait_for_db
  if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    su-exec www-data php artisan migrate --force
    # Roles and permissions (idempotent: adds missing ones, keeps changes made in the app)
    su-exec www-data php artisan db:seed --class=RolePermissionSeeder --force
    su-exec www-data php artisan db:seed --class=WorkflowTemplateSeeder --force
  fi
  cache
  exec "$@"                          # php-fpm master runs as root, workers as www-data
fi

if [ "$1" = "php" ] && [ "$3" = "schedule:work" ]; then
  wait_for_db
  cache
fi

exec su-exec www-data "$@"
