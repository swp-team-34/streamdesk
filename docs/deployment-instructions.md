# Deployment Instructions

This document describes the current manual production deployment for StreamDesk.

## Server Login

```bash
ssh root@team34.ru
```

## Switch to the Application User

```bash
sudo -iu streamdesk
cd /var/www/streamdesk
```

Run Git and PM2 commands as `streamdesk`, not as `root`.

## Update the Code

```bash
git fetch origin
git checkout main
git pull origin main
```

## Run Deployment

```bash
bash deploy-to-server.sh
```

## Verify Deployment

```bash
pm2 list
curl -I http://127.0.0.1:5000
curl -I -L https://team34.ru
```

## Full Short Scenario

```bash
ssh root@team34.ru
sudo -iu streamdesk
cd /var/www/streamdesk
git fetch origin
git checkout main
git pull origin main
bash deploy-to-server.sh
pm2 list
curl -I http://127.0.0.1:5000
curl -I -L https://team34.ru
```

## Common Problems

### `fatal: detected dubious ownership`

Cause: Git was run as `root`, but the repository belongs to `streamdesk`.

Fix:

```bash
sudo -iu streamdesk
cd /var/www/streamdesk
```

### `./deploy-to-server.sh: Permission denied`

Fix: run the script through `bash`.

```bash
bash deploy-to-server.sh
```

### `pm2 list` is empty

Cause: PM2 runs under the `streamdesk` user.

Fix:

```bash
sudo -iu streamdesk pm2 list
```

### `streamdesk is not in the sudoers file`

Cause: the command is already running as `streamdesk` and tries to use `sudo`.

Fix: return to `root` first.

```bash
exit
```

### `npm run db:push` fails

Check PostgreSQL and environment configuration:

```bash
systemctl status postgresql --no-pager
ss -ltnp | grep 5432
cat /var/www/streamdesk/.env
```

Do not publish real `.env` values.

### Site Does Not Open After Deployment

Check application logs, Nginx, and open ports:

```bash
pm2 logs streamdesk --lines 100
systemctl status nginx --no-pager
ss -ltnp | grep -E ':(80|443|5000|5432)\b'
```
