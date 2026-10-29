# Self-Hosting Arbor with Docker Compose

Arbor ships a **single root `Dockerfile`** (`node:20-bookworm-slim` multi-stage build) that packages the compiled Next.js application, Prisma CLI + generated client, `git` + OpenSSH for shallow repository clones, and the long-lived BullMQ worker (`src/worker/index.ts`).

`docker-compose.yml` reuses that single image (`arbor-selfhosted:local`) across three roles — one-shot database migration (`migrate`), web server (`app`), and background queue consumer (`worker`) — with Compose **profiles** (`postgres`, `redis`, `bundled`) so you can run bundled backing stores or bring external managed PostgreSQL/Redis through the **same `docker compose up` command**.

---

## Quickstart (One `docker compose up` Path)

1. **Copy the example environment file and generate production secrets:**

   ```bash
   cp .env.example .env
   ```

   Update `NEXTAUTH_SECRET` and `ENCRYPTION_SECRET` in `.env` with distinct 32-byte random values (for example `openssl rand -base64 32`), and set `APP_URL` / `NEXTAUTH_URL` to your public origin (defaults to `http://localhost:3000`).

2. **Start the stack:**

   ```bash
   docker compose up -d --build
   ```

   Because `.env.example` sets `COMPOSE_PROFILES="postgres,redis"`, this single command:
   - Builds `Dockerfile` once into `arbor-selfhosted:local`.
   - Starts `postgres` (`postgres:16-alpine`) and `redis` (`redis:7-alpine` with AOF persistence) and waits for their healthchecks.
   - Runs `migrate` (`npx prisma db push --skip-generate`) to create or reconcile all 30 Prisma models before any traffic is served.
   - Launches `app` on `http://localhost:3000` (probed via `GET /api/health`) and `worker` (`npm run worker`).

3. **Verify health:**

   ```bash
   curl -fsS http://localhost:3000/api/health
   # {"status":"ok","service":"arbor","checks":{"database":"ok","redis":"ok"},"timestamp":"..."}
   ```

---

## PostgreSQL & Redis Compose Profiles

`postgres` (`profiles: ["postgres", "bundled"]`) and `redis` (`profiles: ["redis", "bundled"]`) are profile-gated in `docker-compose.yml`, while `app`, `worker`, and `migrate` declare `required: false` on optional infrastructure dependencies. You can switch topologies strictly via `.env` without editing `docker-compose.yml`:

| Deployment Topology | `COMPOSE_PROFILES` in `.env` | Connection Overrides in `.env` | Command |
| --- | --- | --- | --- |
| **All-in-one (bundled Postgres + Redis)** | `postgres,redis` *(default)* | Default `postgres:5432` & `redis:6379` | `docker compose up -d --build` |
| **Bundled Postgres + external Redis** | `postgres` | `DOCKER_REDIS_URL="rediss://..."` | `docker compose up -d --build` |
| **External Postgres + bundled Redis** | `redis` | `DOCKER_DATABASE_URL="postgresql://..."` | `docker compose up -d --build` |
| **External Postgres + external Redis** | `""` *(empty)* | Set both `DOCKER_DATABASE_URL` & `DOCKER_REDIS_URL` | `docker compose up -d --build` |

*(If running without a `.env` file, pass `--profile bundled` — e.g. `docker compose --profile bundled up -d --build` — to activate both `postgres` and `redis`.)*

---

## GitHub Sign-In & Repository Access

To enable GitHub OAuth login and private repository cloning on your self-hosted instance:

1. Create a **GitHub OAuth App** under **GitHub Settings → Developer settings → OAuth Apps**:
   - **Homepage URL:** `https://arbor.your-domain.example` (or `http://localhost:3000`)
   - **Authorization callback URL:** `https://arbor.your-domain.example/api/auth/callback/github`
- **Create / update `.env` and start:**

   ```bash
   docker compose up -d --build
   ```

*(Alternatively, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in non-public local environments for local admin credential sign-in.)*

---

## Health Checks, Upgrades & Backups

- **Readiness probe (`GET /api/health`):** Verifies both PostgreSQL (`SELECT 1`) and Redis (`PING`), returning HTTP `200` when healthy or HTTP `503` when degraded. Append `?probe=liveness` (`GET /api/health?probe=liveness`) for a zero-dependency process liveness check.
- **Upgrading Arbor:** Pull the latest commit and re-run the same command — `migrate` reconciles the Prisma schema automatically before `app` and `worker` restart:

  ```bash
  git pull
  docker compose up -d --build
  ```

- **Backing up bundled PostgreSQL:**

  ```bash
  docker compose exec postgres pg_dump -U arbor arbor > arbor-backup.sql
  ```
