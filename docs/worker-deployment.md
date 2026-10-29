# Background Worker Deployment Guide (`src/worker/`)

Arbor processes repository analyses, fullstack system scans, and scheduled repository syncs asynchronously through **BullMQ** queues (`arbor-analysis` and `arbor-system-analysis`) backed by **Redis** and **PostgreSQL**.

You can run the worker in two modes:

1. **Continuous long-lived worker (`npm run worker` via `Dockerfile`)** — recommended for production so queued scans start within seconds and scheduled scans dispatch every 60 seconds.
2. **Serverless daily cron fallback (`GET /api/worker/process` via `vercel.json`)** — preserved for zero-infrastructure serverless deployments (`0 3 * * *` UTC, up to `maxDuration = 300` seconds per run).

---

## Shared Environment Requirements

The long-lived worker **must** connect to the **exact same** PostgreSQL database, Redis instance, and encryption key as the Next.js web application:

| Variable | Why it must match the web app |
| --- | --- |
| `REDIS_URL` | Points at the exact same Redis / Upstash / managed Redis instance (`redis://...` or `rediss://...` with TLS) where the web app enqueues `arbor-analysis` and `arbor-system-analysis` jobs. |
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

4. **Deploy and pin at least 1 always-on machine** so the BullMQ consumer and 60-second schedule dispatcher stay active continuously:

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
5. Trigger a deploy and confirm `[worker] ready — waiting for analysis and system jobs` appears in the Railway deployment logs.

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
- **Behavior:** Drains waiting jobs from the same `REDIS_URL` BullMQ queues within a bounded execution window (`maxDuration = 300` seconds) and dispatches due `ScanSchedule` rows.
- **Coexistence with a long-lived worker:** Keeping `/api/worker/process` enabled while a Fly.io or Railway worker is running is safe — BullMQ's Redis job lock guarantees a queued analysis is claimed by at most one consumer, and startup/cron stale-job recovery (`recoverWorkerState`) cleans up interrupted runs.
