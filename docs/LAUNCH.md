# LinguoLab — Production Launch Runbook

> Last updated: 2026-05-14 | Version: 1.0.0

---

## Pre-flight Checklist

### 1. Environment Variables

Copy `.env.example` → `.env` on the production server and fill every value:

```bash
cp infra/compose/.env.example infra/compose/.env
nano infra/compose/.env  # fill all secrets
```

**Critical secrets (never commit to git):**

| Variable                 | Where to get                     |
| ------------------------ | -------------------------------- |
| `POSTGRES_PASSWORD`      | Generate: `openssl rand -hex 32` |
| `REDIS_PASSWORD`         | Generate: `openssl rand -hex 32` |
| `JWT_SECRET`             | Generate: `openssl rand -hex 64` |
| `NEXTAUTH_SECRET`        | Generate: `openssl rand -hex 32` |
| `NEXTAUTH_SECRET_PORTAL` | Generate: `openssl rand -hex 32` |
| `TELEGRAM_BOT_TOKEN`     | BotFather → `/mybots`            |
| `SENTRY_DSN`             | sentry.io project settings       |
| `PAYME_KEY`              | Payme merchant cabinet           |
| `CLICK_SECRET_KEY`       | Click merchant cabinet           |
| `UZUM_SECRET_KEY`        | Uzum merchant cabinet            |
| `OFD_API_KEY`            | Soliq OFD cabinet → API keys     |

### 2. Infrastructure on Server

```bash
# 1. Docker + Docker Compose installed
docker --version        # >= 24.x
docker compose version  # >= 2.x

# 2. Traefik (or nginx) running — shared_web network exists
docker network inspect shared_web || docker network create shared_web

# 3. Backup directory exists with correct permissions
mkdir -p /opt/linguolab/backups
chmod 750 /opt/linguolab/backups
```

### 3. DNS Records

| Record                               | Type      | Value             |
| ------------------------------------ | --------- | ----------------- |
| `api-linguolab.muzaffarbahodir.uz`   | A / CNAME | Server IP / proxy |
| `app-linguolab.muzaffarbahodir.uz`   | A / CNAME | Server IP / proxy |
| `admin-linguolab.muzaffarbahodir.uz` | A / CNAME | Server IP / proxy |

Wait for DNS propagation (up to 24h, usually < 5 min with Cloudflare).

### 4. SSL Certificates

If using Traefik with Let's Encrypt — certificates are issued automatically on first request.

If using nginx + certbot:

```bash
certbot --nginx -d api-linguolab.muzaffarbahodir.uz \
                -d app-linguolab.muzaffarbahodir.uz \
                -d admin-linguolab.muzaffarbahodir.uz
```

### 5. CORS_ALLOWED_ORIGINS

Set in `.env`:

```
CORS_ALLOWED_ORIGINS=https://app-linguolab.muzaffarbahodir.uz,https://admin-linguolab.muzaffarbahodir.uz
```

---

## Deployment Steps

### First Deploy

```bash
# On server — clone repo (infra only needed)
git clone https://github.com/artsoftmuzaffarkhon/linguolab.git /opt/linguolab/repo
cd /opt/linguolab/repo/infra/compose

# Fill .env
cp .env.example .env
nano .env

# Pull images and start
docker compose pull
docker compose up -d

# Check all containers healthy
docker compose ps
```

### Database Migration (first time only)

```bash
# Run migrations inside API container
docker compose exec linguolab_api npx prisma migrate deploy

# Seed initial data (languages, roles, etc.)
docker compose exec linguolab_api node dist/prisma/seed.js
```

### Telegram Bot Webhook

```bash
# Register webhook after API is live and DNS resolves
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://api-linguolab.muzaffarbahodir.uz/api/v1/telegram/webhook"}'

# Verify
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

### Payment Provider Webhooks

| Provider | Webhook URL                                                               |
| -------- | ------------------------------------------------------------------------- |
| Payme    | `https://api-linguolab.muzaffarbahodir.uz/api/v1/payments/payme/callback` |
| Click    | `https://api-linguolab.muzaffarbahodir.uz/api/v1/payments/click/callback` |
| Uzum     | `https://api-linguolab.muzaffarbahodir.uz/api/v1/payments/uzum/callback`  |

Register each in the respective merchant cabinet.

---

## Ongoing Operations

### Subsequent Deploys

GitHub Actions CI/CD handles this automatically on push to `main`.

Manual update:

```bash
cd /opt/linguolab/repo/infra/compose
docker compose pull
docker compose up -d --no-deps --build linguolab_api linguolab_admin linguolab_portal
```

### Database Backups

**Automated daily backup cron** (add to server crontab):

```bash
# crontab -e
0 3 * * * docker exec linguolab_postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB \
  | gzip > /opt/linguolab/backups/db_$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz \
  && find /opt/linguolab/backups -name "*.sql.gz" -mtime +30 -delete
```

This:

- Dumps DB at 03:00 daily
- Compresses with gzip
- Deletes backups older than 30 days

**Manual backup:**

```bash
docker exec linguolab_postgres pg_dump -U linguolab linguolab \
  | gzip > /opt/linguolab/backups/manual_$(date +%Y%m%d_%H%M%S).sql.gz
```

**Restore from backup:**

```bash
gunzip -c /opt/linguolab/backups/db_YYYYMMDD_HHMMSS.sql.gz \
  | docker exec -i linguolab_postgres psql -U linguolab linguolab
```

### Log Viewing

```bash
# API logs
docker compose logs linguolab_api --tail=100 -f

# All services
docker compose logs --tail=50 -f

# Error-only
docker compose logs linguolab_api 2>&1 | grep -i error
```

---

## Monitoring

### UptimeRobot Setup (free tier)

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Add monitors:
   - `https://api-linguolab.muzaffarbahodir.uz/health` — HTTP, every 5 min
   - `https://app-linguolab.muzaffarbahodir.uz` — HTTP, every 5 min
   - `https://admin-linguolab.muzaffarbahodir.uz` — HTTP, every 5 min
3. Add alert contacts (email, Telegram)

### Sentry Error Tracking

- API errors → Sentry project `linguolab-api`
- Admin errors → Sentry project `linguolab-admin` (if configured)
- Portal errors → Sentry project `linguolab-portal` (if configured)
- Alert rules: notify on new issues + spike detection

### Health Endpoint

```
GET https://api-linguolab.muzaffarbahodir.uz/health
→ { "status": "ok", "db": "ok", "redis": "ok" }
```

---

## Smoke Tests After Deploy

Run after every production deploy to verify critical paths:

```bash
BASE=https://api-linguolab.muzaffarbahodir.uz/api/v1

# 1. Health check
curl -s $BASE/../health | grep '"status":"ok"'

# 2. Languages list (public, cached)
curl -s $BASE/languages | python3 -m json.tool | head -10

# 3. Classes list (public, cached)
curl -s "$BASE/classes?limit=5" | python3 -m json.tool | head -20

# 4. Auth smoke (should get 401 — not 500)
curl -s -o /dev/null -w "%{http_code}" $BASE/users/me
# expected: 401
```

---

## Rollback Procedure

```bash
# Roll back to previous image tag
docker compose stop linguolab_api
docker compose rm -f linguolab_api

# Edit docker-compose.yml image tag to previous version
# OR pull specific tag:
docker pull ghcr.io/artsoftmuzaffarkhon/linguolab-api:sha-<previous-sha>

docker compose up -d linguolab_api
```

---

## Security Checklist

- [ ] All secrets in `.env` — never in docker-compose.yml or git
- [ ] `USE_SANDBOX=false` — Soliq OFD in production mode
- [ ] `NODE_ENV=production` — disables test shortcuts (throttler skip, etc.)
- [ ] Firewall: only ports 80/443 open publicly; 3000/3001/3002 internal only
- [ ] Postgres not exposed on public interface
- [ ] Redis not exposed on public interface (password set + no public port)
- [ ] CORS_ALLOWED_ORIGINS — exact production domains only (no `*`)
- [ ] Rate limiting active (ThrottlerGuard: 20 req/s, 300 req/min)
- [ ] Helmet security headers enabled
- [ ] Sentry DSN configured and receiving events
- [ ] SSL auto-renew configured (certbot timer or Traefik ACME)

---

## Contact & Ownership

| Role           | Contact                                  |
| -------------- | ---------------------------------------- |
| Lead Developer | artsoftmuzaffarkhon@gmail.com            |
| Repository     | github.com/artsoftmuzaffarkhon/linguolab |
| Sentry Org     | linguolab                                |
