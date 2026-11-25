# Background Worker Deployment Guide (`src/worker/`)

Arbor processes repository analyses, fullstack system scans, and scheduled repository syncs asynchronously through **BullMQ** queues (`analysis` and `system-analysis`) backed by **Redis** and **PostgreSQL**.

You can run the worker in two modes:

1. **Continuous long-lived worker (`npm run worker` via `Dockerfile`)** — recommended for production so queued scans start within seconds and scheduled scans and queued-job reconciliation run every 30 seconds.
2. **Serverless scheduled processor (`GET /api/worker/process`)** — for zero-infrastructure serverless deployments (Vercel). Driven by the `analysis-cron` GitHub Actions workflow every 5 minutes (`.github/workflows/analysis-cron.yml`, requires the `CRON_SECRET` and `APP_URL` repository secrets); the daily `vercel.json` cron (`0 3 * * *` UTC) remains as a safety net. Set `ANALYSIS_QUEUE_DRIVER="db"` so analyze requests skip Redis delivery and the queued database row is treated as the queue — each invocation processes queued rows for up to 240 seconds with atomic claims, so overlapping runs are safe.

---

## Shared Environment Requirements

The long-lived worker **must** connect to the **exact same** PostgreSQL database, Redis instance, and encryption key as the Next.js web application:

| Variable | Why it must match the web app |
| --- | --- |
| `REDIS_URL` | Points at the exact same Redis / Upstash / managed Redis instance (`redis://...` or `rediss://...` with TLS) where the web app enqueues `analysis` and `system-analysis` jobs. |
| `DATABASE_URL` | Points at the same PostgreSQL database storing `Project`, `Analysis`, `ScanSchedule`, and `GitHubAccount` records. |
| `ENCRYPTION_SECRET` | Must be byte-for-byte identical to the web app's `ENCRYPTION_SECRET` so the worker can decrypt stored GitHub OAuth / PAT credentials when cloning private repositories. |
| `NEXTAUTH_SECRET` | Required by `src/lib/env.ts` startup validation (non-empty secret). |
| `APP_URL` | Canonical web URL used when publishing GitHub pull-request Check Run details links. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional; pass matching values if using GitHub App / OAuth integrations. |

---

## 1. Self-Hosted & Local Docker Compose

The root `Dockerfile` builds a single Node 20 (`bookworm-slim`) image (`arbor-selfhosted:local`) containing `git`, `openssh-client`, `openssl`, Prisma CLI + Client, the compiled Next.js app, and the TypeScript worker entrypoint (`src/worker/index.ts`).

`docker-compose.yml` uses Compose profiles (`postgres`, `redis`, `bundled`) with `COMPOSE_PROFILES="postgres,redis"` enabled by default in `.env.example`, so one command starts PostgreSQL, Redis, automatic Prisma migrations (`arbor-migrate`), the Next.js app (`arbor-app`), and the long-lived BullMQ worker (`arbor-worker`):

```bash
cp .env.example .env
# Edit .env with real NEXTAUTH_SECRET and ENCRYPTION_SECRET values (and adjust COMPOSE_PROFILES if using external DB/Redis)
docker compose up -d --build
```

Inspect live worker logs:

```bash
docker compose logs -f worker
```

For full self-hosted topology options (bundled vs. external managed PostgreSQL/Redis via `COMPOSE_PROFILES`), health probes (`GET /api/health`), and upgrade steps, see [`docs/self-hosting.md`](./self-hosting.md).

---

## 2. Deploying the Long-Lived Worker to Fly.io

Deploy the web app on Vercel (or Fly.io) and run `src/worker/index.ts` as a headless Fly Machine sharing the **same `REDIS_URL`** and **`DATABASE_URL`**.

1. **Create a Fly app without public HTTP ports** (the BullMQ worker pulls from Redis outbound and does not need an inbound public URL):

   ```bash
   fly apps create arbor-worker
   ```

2. **Create a `fly.worker.toml` config** (or use `fly launch --no-deploy`):

   ```toml
   app = "arbor-worker"
   primary_region = "sin"

   [build]
     dockerfile = "Dockerfile"

   [env]
     NODE_ENV = "production"
     CLONE_BASE_DIR = "/tmp/arbor-clones"

   [processes]
     worker = "npm run worker"
   ```

3. **Set shared secrets** — ensure `REDIS_URL`, `DATABASE_URL`, and `ENCRYPTION_SECRET` match your web deployment:

   ```bash
   fly secrets set -a arbor-worker \
     DATABASE_URL="postgresql://..." \
     REDIS_URL="rediss://default:...@your-shared-redis-host:6379" \
     NEXTAUTH_SECRET="..." \
     ENCRYPTION_SECRET="..." \
     APP_URL="https://your-arbor-domain.example.com"
   ```

4. **Deploy and pin at least 1 always-on machine** so the BullMQ consumer and 30-second schedule/recovery dispatcher stay active continuously:

   ```bash
   fly deploy -c fly.worker.toml --ha=false
   fly scale count worker=1 -a arbor-worker
   fly logs -a arbor-worker
   ```

---

## 3. Deploying the Long-Lived Worker to Railway

1. In your Railway project, click **New -> GitHub Repo** and select your `Arbor` repository to create a service named `arbor-worker`.
2. Under **Settings -> Build**, select **Dockerfile** (`Dockerfile` at the repository root).
3. Under **Settings -> Deploy**:
   - Set **Custom Start Command** to:
     ```bash
     npm run worker
     ```
   - Set **Restart Policy** to **Always**.
   - Leave **Public Networking** disabled (no public HTTP domain is needed for the queue worker).
4. Under **Variables**, set `REDIS_URL` to the **exact same Redis instance URL** configured on your Next.js web deployment (for example `${{Redis.REDIS_URL}}` if Redis is in the same Railway project, or your shared Upstash/managed `rediss://...` URL), along with matching `DATABASE_URL`, `ENCRYPTION_SECRET`, `NEXTAUTH_SECRET`, and `APP_URL`.
5. Trigger a deploy and confirm `[worker] Arbor analysis worker running` appears in the Railway deployment logs.

---

## 4. Serverless Cron Fallback (`/api/worker/process`)

`vercel.json` retains the scheduled cron route as a documented fallback for deployments that do not run a dedicated worker container:

```json
{
  "crons": [
    {
      "path": "/api/worker/process",
      "schedule": "0 3 * * *"
    }
  ]
}
```

- **Authentication:** Requests to `GET /api/worker/process` must present `Authorization: Bearer <CRON_SECRET>` matching `CRON_SECRET` in the server environment.
- **Behavior:** Reads queued repository and system analyses directly from the shared database. Each invocation attempts at most **five** jobs, interleaving the two types, with a **240-second admission/analysis budget** inside the 300-second route limit. No new job is admitted when fewer than 60 seconds remain in that budget. Small jobs can therefore drain faster than one per day; a large job may still consume most of an invocation. External I/O and platform hard limits can interrupt execution. The fallback does **not** dispatch scheduled scans; those require the continuous worker.
- **Coexistence with a long-lived worker:** Both processors atomically claim the database record from `queued` before doing work. The cron processor does not use BullMQ locks. Startup, periodic worker recovery, and cron recovery mark overdue interrupted executions failed; only worker startup sweeps orphaned clone directories.


## 5. Diagnosing a scan that stays queued

`npm start` and `npm run dev` start the **web app only**. Run `npm run worker`
in a separately supervised process, or use the Compose worker service. For local
development, `npm run dev:all` starts both. Deploying only the web app does not
create a continuous queue consumer.

1. Check `docker compose ps worker` and `docker compose logs --tail=100 worker`
   (or the corresponding Fly/Railway service logs). Look for the worker startup
   message above and database/Redis connection errors. Never paste secret values
   into logs or support messages.
2. Compare the web/worker configurations privately: they must use the **same
   Redis instance, Redis logical database, PostgreSQL database, and encryption
   key**. A connected worker using a different database can consume a queue job
   without finding the corresponding analysis.
3. Open the project's scan status card. Authenticated `project.processingHealth`
   and `system.processingHealth` report queue reachability, pause state, and
   whether a BullMQ worker connection was detected. Detection is not a heartbeat
   or proof of progress. Redis ACLs that disallow worker inspection yield
   `worker: unknown`, not a claim that Redis is down.
4. If no worker is deployed, inspect the production cron logs and ensure
   `CRON_SECRET` is non-empty and matches its exact bearer token. Unauthorized
   calls return **401**. On serverless deployments the `analysis-cron` GitHub
   Actions workflow drives processing every 5 minutes; confirm it is enabled and
   its `CRON_SECRET`/`APP_URL` secrets match the deployment, or use the
   recommended continuous worker.
5. An editor can select **Retry delivery**. It repairs the **same queued scan**
   with its stable job ID, preserves active/waiting/delayed jobs, and removes only
   retained terminal queue jobs. It does not create another scan, spend another
   analysis quota, resume a paused queue, or start an absent worker. Repairs are
   rate-limited to six requests per user per minute.

### Recovery guarantees and limits

The queued database row is the durable pending-work record. Repository/system
submission retains it and records a sanitized explanation if Redis delivery
fails. The worker reconciles both queue types at startup and every 30 seconds,
including jobs lost after startup or a Redis restart. This relies on a running
worker; the independent daily fallback can process pending rows without Redis
queue delivery. No system can run scans when **both** processors are absent or
misconfigured.

Overdue `cloning`/`analyzing` executions are marked failed after the greater of
10 minutes or `ANALYSIS_TIMEOUT_MS + 60 seconds`. Queued jobs are not falsely
failed merely because they have waited for that duration. Their status card
shows elapsed wait, a warning after two minutes, connection diagnostics, scan ID,
and inline retry errors. Old completed reports are identified as previous
snapshots; uncompleted scans do not render empty reports as successful results.

`GET /api/health` remains an **infrastructure readiness** check for PostgreSQL and
Redis, not an assertion that analysis workers are processing jobs. Use the
scan-specific authenticated diagnostics above for processing availability.
