# Deploying Task Management with Docker + Cloudflare Tunnel

Three containers, using the VM's native MySQL and exposed through a Cloudflare Tunnel. Nothing listens on a public port; the app is published on `127.0.0.1:5054` only, so it does not clash with the VM's other apps (ifrs16 uses 5052, fincubed 5053).

```
browser / Android app ──https──> Cloudflare ──tunnel──> cloudflared ──> 127.0.0.1:5054 / web:80
                                                                         web        (nginx: React app, /api → app)
                                                                         app        (PHP-FPM 8.4, Laravel) ──┐
                                                                         scheduler  (schedule:work)        ──┴─ unix socket ─> native MySQL
```

- **Database:** the app connects through MySQL's unix socket (the host's socket directory is mounted into the containers). MySQL needs no `bind-address` or grant changes: a user allowed from `localhost` works.
- **Volume:** `tasks_storage` holds task attachments. Back it up with the database (`deploy/backup.sh` does both).
- **Scheduler:** the `scheduler` container runs the daily jobs, in Pakistan time:

  | Time | Job |
  |---|---|
  | 06:00 | `routines:create-runs`: creates each routine's tasks 5 days (its lead days) before the period ends |
  | 09:00 | `tasks:send-due-reminders`: in-app alerts for tasks due today / overdue |
  | 09:15 | `tasks:escalate-overdue`: tells project managers about tasks overdue past the project's escalation days |
  | 03:00 | clears read alerts older than 90 days; expired sign-in tokens |

## 1. Prepare

```bash
git clone https://github.com/iamhananbaig/task_management.git /opt/tasks && cd /opt/tasks
cp .env.docker.example .env && chmod 600 .env
```

Create the database and its user:

```sql
CREATE DATABASE tasks CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tasks'@'localhost' IDENTIFIED BY '<strong password>';
GRANT ALL ON tasks.* TO 'tasks'@'localhost';
```

Find the MySQL socket and fill in `.env`:

```bash
mysql -u root -p -e "select @@socket"
#  /var/run/mysqld/mysqld.sock  (Debian/Ubuntu) → MYSQL_SOCKET_DIR=/var/run/mysqld, DB_SOCKET=/var/run/mysqld/mysqld.sock
#  /var/lib/mysql/mysql.sock    (RHEL family)   → MYSQL_SOCKET_DIR=/var/lib/mysql,  DB_SOCKET=/var/run/mysqld/mysql.sock
```

(`DB_SOCKET` is the path *inside* the container: the directory is always mounted at `/var/run/mysqld`.)

Set `DB_USERNAME` / `DB_PASSWORD`, and the `MAIL_*` settings if the "Email reminder" button should send real email (with `MAIL_MAILER=log` the emails only go to the log).

Create the app key and build:

```bash
sed -i "s|^APP_KEY=.*|APP_KEY=base64:$(openssl rand -base64 32)|" .env
docker compose build
```

## 2. Start

```bash
docker compose up -d --wait
docker compose logs app | tail -30            # migrations, then "ready to handle connections"
docker compose logs scheduler | tail          # "Running scheduled tasks every minute"
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5054/up   # 200
```

The first start creates the tables, the roles and permissions, and the default review workflow (`RUN_MIGRATIONS=true`). No demo data is added.

Create the first admin (asks for the password; it must be changed at first sign-in):

```bash
docker compose exec app php artisan tasks:create-admin you@company.com --name="Your Name"
```

Sign in, then add the team under **Admin → Users**, tags under **Admin → Tags**, and projects.

## 3. Cloudflare Tunnel

In Cloudflare **Zero Trust → Networks → Tunnels**:

**A. cloudflared already runs on the VM** (natively, for other apps): open that tunnel → *Public hostnames* → *Add*: hostname `tasks.example.com`, service **`http://localhost:5054`**. Done, no change to this stack.

If that tunnel uses a local `config.yml` instead of the dashboard, add before the final catch-all rule and restart cloudflared:

```yaml
ingress:
  - hostname: tasks.example.com
    service: http://localhost:5054
  # ... existing rules ...
  - service: http_status:404
```

**B. New tunnel for this app, run in this stack:** *Create a tunnel* → *Cloudflared* → copy the token (the long string after `--token`) into `CLOUDFLARE_TUNNEL_TOKEN` in `.env`. Add a public hostname with service **`http://web:80`** (the container name, not localhost). Then:

```bash
docker compose --profile tunnel up -d
docker compose logs cloudflared | tail      # "Registered tunnel connection"
```

Use `--profile tunnel` on every later `up` so cloudflared keeps running.

Set `APP_URL` in `.env` to the public `https://` hostname and `docker compose up -d` again (links in emails use it).

**Android app:** sign in with server address `https://tasks.example.com`. If you put **Zero Trust → Access** in front of the hostname, add a *Bypass* policy for the path `/api/*` (the app signs in with its own token and can't show the Access login page); keep Access on the rest for the web app.

## Updating

```bash
cd /opt/tasks
/usr/local/bin/tasks-backup            # or a manual mysqldump, see Backups
git pull
docker compose build
docker compose up -d --wait            # add --profile tunnel if cloudflared runs in this stack
```

Migrations run on start. Roles and permissions added by an update are filled in too; changes made on the Roles page are kept.

## Backups

`deploy/backup.sh`: database dump (checked for completeness) + the attachments volume, kept 14 days, optionally copied to another machine.

```bash
install -m 700 deploy/backup.sh /usr/local/bin/tasks-backup
install -m 600 deploy/backup.conf.example /etc/tasks-backup.conf    # edit: REMOTE_TARGET etc.
# /root/.my.cnf (chmod 600):  [client]  user=root  password=...
crontab -e   →   15 2 * * * /usr/local/bin/tasks-backup >> /var/log/tasks-backup.log 2>&1
```

On a UTC VM, cron runs on UTC: 02:15 UTC = 07:15 PKT. For 02:15 PKT use `15 21 * * *`.

Restore:

```bash
gunzip -c /var/backups/tasks/db/tasks_<stamp>.sql.gz | mysql -u root -p tasks
docker run --rm -v tasks_storage:/s -v /var/backups/tasks/storage:/b alpine sh -c 'cd /s && tar xzf /b/storage_<stamp>.tar.gz'
```

## Time zones

- App and scheduler: Asia/Karachi. "Today", due dates, reminders and routine periods are Pakistan time. Due dates are plain dates (a task due on a Sunday is due on Sunday).
- Database connection: pinned to UTC (`DB_TIMEZONE`, default `+00:00`). Changing the VM's or MySQL's time zone later does not shift stored times.

## Everyday commands

| | |
|---|---|
| Status | `docker compose ps` |
| Logs | `docker compose logs -f app web scheduler` |
| Laravel command | `docker compose exec app php artisan <command>` |
| Run a daily job now | `docker compose exec app php artisan routines:create-runs` (or `tasks:send-due-reminders`, `tasks:escalate-overdue`; `--dry-run` to preview the last two) |
| Scheduled jobs | `docker compose exec app php artisan schedule:list` |
| Reset an admin's password | `docker compose exec app php artisan tasks:create-admin <email>` |
| Restart | `docker compose restart` |
| Stop | `docker compose down` (never `-v`: it deletes the attachments volume) |

## Troubleshooting

- **App keeps "Waiting for database"** (`docker compose logs app`): wrong `MYSQL_SOCKET_DIR`/`DB_SOCKET`, or the user lacks access from `localhost`. Test on the VM: `mysql -u <DB_USERNAME> -p -S <socket> <DB_DATABASE>`.
- **SELinux (RHEL family)** blocks the socket mount (don't relabel MySQL's own directory with `:z`). Use TCP instead: `DB_SOCKET=` (empty), `DB_HOST=host.docker.internal`, make MySQL listen on the Docker bridge (`bind-address = 127.0.0.1,172.17.0.1`) and create the user for `'172.%'`.
- **Changed `.env`**: `docker compose up -d` (the containers re-cache config on start).
- **502 from Cloudflare**: the tunnel's service URL is wrong: `http://localhost:5054` for native cloudflared, `http://web:80` for the one in this stack.
- **No reminders / routine tasks**: `docker compose logs scheduler`; it must be running (`docker compose ps`).
- **Build hangs on `apk add`** (slow link to Alpine's CDN): set `ALPINE_MIRROR=https://mirror.leaseweb.com/alpine` (or another Alpine mirror) in `.env` and `docker compose build` again.
- **Upload limit**: 20 MB per file (`AttachmentController`); `php.ini` and `nginx.conf` allow 25 MB so the app, not nginx, gives the error.
