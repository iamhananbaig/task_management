# Laravel API on PHP-FPM 8.4 (Laravel 13 needs PHP >= 8.3)
FROM php:8.4-fpm-alpine

# Optional faster package mirror for slow connections, e.g. --build-arg ALPINE_MIRROR=https://mirror.leaseweb.com/alpine
ARG ALPINE_MIRROR=
RUN if [ -n "$ALPINE_MIRROR" ]; then sed -i "s|https://dl-cdn.alpinelinux.org/alpine|$ALPINE_MIRROR|" /etc/apk/repositories; fi

# Extensions: pdo_mysql (DB), intl, bcmath, opcache. su-exec runs the scheduler as www-data.
RUN apk add --no-cache tzdata icu-libs su-exec \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS icu-dev linux-headers \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql intl bcmath opcache \
    && apk del .build-deps
COPY --from=composer:2.8.12 /usr/bin/composer /usr/local/bin/composer

WORKDIR /var/www/html
ENV COMPOSER_ALLOW_SUPERUSER=1 TZ=Asia/Karachi

# Dependencies first (cached unless composer.lock changes)
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --no-scripts --no-autoloader --prefer-dist

COPY . .
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative \
    && php artisan package:discover --ansi \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/app/private \
    && chown -R www-data:www-data storage bootstrap/cache

COPY docker/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]
