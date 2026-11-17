# Deployment Guide

## Using Docker (Recommended)

Requires a machine with Docker and Docker Compose installed. Recommended minimum specifications: 2 vCPUs, 4 GB RAM.

```bash
git clone https://github.com/KKKKhazix/AIHOT.git myhot
cd myhot
node scripts/init-env.ts --llm-key <your-llm-api-key>
```

`init-env.ts` generates a `.env` file containing random cryptographic secrets and an auto-generated admin password (printed to stdout).

Verify `SITE_URL` in `.env`:
- Local testing: keep `http://localhost:3000`.
- Production server: set to the public URL accessible by visitors (e.g. `http://192.0.2.10:3000` or `https://example.com`).

Build and boot the containers:

```bash
docker compose up -d --build
```

Access `http://<server-ip>:3000`. The admin dashboard is located at `/admin`.
Docker Compose orchestrates 5 containers:
1. `db`: PostgreSQL 17.
2. `setup`: Runs database migrations and seed data, then terminates.
3. `api`: Fastify backend server.
4. `worker`: Background ingestion, LLM pipelines, scheduled crons.
5. `web`: React Router SSR web frontend.

---

## Domain and HTTPS (Caddy Automatic SSL)

Point your DNS domain to the server IP, then configure `.env`:

```dotenv
SITE_URL=https://example.com
SITE_DOMAIN=example.com
PORT=127.0.0.1:3000
TRUST_PROXY=true
```

Start with the HTTPS profile (Caddy automatically provisions Let's Encrypt certificates):

```bash
docker compose --profile https up -d --build
```

If using Nginx as a reverse proxy, forward traffic to `http://127.0.0.1:3000` with headers:
```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

---

## Non-Docker Deployment (Bare Metal / Node.js)

Requires Node.js >= 24.11 and PostgreSQL 16 or 17 (macOS or Linux).

```bash
npm ci
node scripts/init-env.ts --llm-key <your-api-key>
createdb myhot
```

Add database and API configuration to `.env`:

```dotenv
DATABASE_URL=postgres://<username>@127.0.0.1:5432/myhot
API_BASE_URL=http://127.0.0.1:3001
```

Run migrations, seed data, and build web assets:

```bash
node --env-file=.env scripts/migrate.ts
node --env-file=.env scripts/seed.ts
npm run build -w @aihot/web
```

Start the three processes in production mode (via pm2 or systemd):

```bash
# 1. API Server (Port 3001)
NODE_ENV=production node --env-file=.env apps/api/src/main.ts

# 2. Background Worker
NODE_ENV=production node --env-file=.env apps/worker/src/main.ts

# 3. Web Frontend (Port 3000)
cd apps/web && NODE_ENV=production node --env-file=../../.env server.ts
```

In development, use hot-reloading:
```bash
npm run dev:api
npm run dev:worker
npm run dev:web
```
To bypass authentication in local development, set `DEV_AUTH_ROLE=admin` in `.env`.

---

## Upgrades and Database Migrations

1. Backup current database and data.
2. Pull latest git commits and build containers:
```bash
git pull
docker compose build
docker compose stop api worker web
docker compose run --rm setup && docker compose up -d
```
All schema migrations are safe for online execution and run sequentially by filename.

---

## Automated Backups (S3-Compatible Object Storage)

Configure S3 credentials in `.env`:
```dotenv
DB_BACKUP_STORE_SECRET_ID=<access-key>
DB_BACKUP_STORE_SECRET_KEY=<secret-key>
DB_BACKUP_STORE_BUCKET=<bucket-name>
DB_BACKUP_STORE_REGION=<region>
DB_BACKUP_STORE_DOMAIN=<custom-s3-endpoint-optional>
```
The system performs automated backups daily at 04:10 UTC to S3:
- Full database snapshot (`.dump`).
- Compressed media uploads (`uploads/`, `feedback-screenshots/`).
- Stored by prefixes: `daily/`, `weekly/` (Sundays), `monthly/` (1st of month).

Manual single-command database dump:
```bash
docker compose exec -T db pg_dump -U aihot aihot | gzip > myhot-$(date +%F).sql.gz
```

---

## Cost Optimization Checklist

1. **Inspect Costs in Admin**: Review call volumes and prompt/completion token usage in `/admin/models`.
2. **Disable Thinking / Reasoning Overhead**: LLM reasoning tokens incur additional costs. Set `LLM_REASONING_TOKENS` appropriately or choose non-reasoning models.
3. **Model Tiering**: Assign cheaper, high-throughput models for high-volume steps (`PREFILTER_MODEL`, `SCORE_MODEL`) and save stronger models for `STRUCTURE_MODEL` and `GROUP_REVIEW_MODEL`.
4. **Tune Polling Cadence**: Decrease polling frequency on high-noise or rarely-curated feeds in the Admin Sources tab.
