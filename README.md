# Arbor

<!-- [![CI](https://github.com/mdadeel/Arbor/actions/workflows/ci.yml/badge.svg)](https://github.com/mdadeel/Arbor/actions/workflows/ci.yml) -->

Connect a GitHub repository to generate an inspectable architecture map, six-dimension health score, and evidence-linked findings.

Arbor's core analysis is deterministic: it shallow-clones a temporary working copy, parses supported source files with Babel AST and rule-based static checks, records derived metrics and findings, and removes the clone when processing finishes. Optional AI explanations and unified-diff patch suggestions are bring-your-own-key (BYOK) and review-only — Arbor never writes commits or opens pull requests on your behalf.

## Quick Start

1. **Start PostgreSQL 16 and Redis 7:**

   ```bash
   docker compose up -d postgres redis
   ```

   *(To build and run the Next.js app and long-lived BullMQ worker inside Docker as well, run `docker compose up -d --build`; see [docs/worker-deployment.md](docs/worker-deployment.md).)*

2. **Create `.env` from `.env.example`:**

   ```bash
   cp .env.example .env
   ```

   Set real random values for `NEXTAUTH_SECRET` and `ENCRYPTION_SECRET`, and configure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from a GitHub OAuth App (`http://localhost:3000/api/auth/callback/github`) if you want to sign in through the web UI.

3. **Install dependencies and sync the database schema:**

   ```bash
   npm install
   npm run db:push
   ```

   > `npm run db:push` creates all 30 models from `prisma/schema.prisma` for local development. (`npx prisma migrate deploy` applies the 11 committed SQL migrations covering 25 tables; see [Status](#status).)

4. **Run the web app AND the background worker:**

   ```bash
   npm run dev:all
   ```

   Or in two separate terminals:

   ```bash
   npm run dev
   npm run worker
   ```

   **Why the worker is required:** Repository scans are asynchronous jobs queued in PostgreSQL and BullMQ (`REDIS_URL`). Without `npm run worker` (or an authorized `GET /api/worker/process` request carrying `Authorization: Bearer $CRON_SECRET`), analyses remain in `queued` status and will not complete.

   To run the static analyzer directly against any local directory without starting PostgreSQL, Redis, or GitHub OAuth (and optionally emit a schema-validated SARIF 2.1.0 report for GitHub Code Scanning):

   ```bash
   npm run analyze:local -- .
   npm run analyze:local -- . --sarif ./arbor-results.sarif
   ```

   See [`docs/sarif-github-code-scanning.md`](docs/sarif-github-code-scanning.md) for the GitHub Actions workflow (`github/codeql-action/upload-sarif@v3`) and `gh api` upload commands that publish Arbor findings into GitHub's **Security -> Code scanning** tab.

6. **Export an A4 consultant audit report PDF** from any valid read-only share token:

   ```bash
   # One-time Chromium install on a standard developer machine:
   npx playwright install chromium

   # Start the app (npm run dev, or npm run build && npm run start),
   # create a read-only share link from a completed project analysis
   # (optionally setting "Prepared for <client name>"), then run:
   npm run report:pdf -- <share-token>
   # Optional flags:
   # npm run report:pdf -- <share-token> --out ./audit-report.pdf --base-url http://localhost:3000
   ```

   You can also open `http://localhost:3000/report/<share-token>` directly in a browser and print/save as A4 PDF. Expired or revoked share tokens return HTTP `404`.

## Tech Stack

- **Framework:** Next.js 15 (App Router, `15.5.27`), React 18 (`18.2.0`), TypeScript `5.9.3` (`strict: true`)
- **API:** tRPC v11 (`11.19.0`) + TanStack React Query v5 (`5.105.0`) + Zod (`3.22.4`)
- **Database:** PostgreSQL 16 + Prisma 5 (`5.22.0`)
- **Auth:** NextAuth.js v4 (GitHub OAuth; optional allowlisted admin credentials for non-production use)
- **Queue & Rate Limiting:** BullMQ + Redis 7 (`ioredis`)
- **Visualisation & UI:** React Flow, Recharts, Tailwind CSS, Radix UI

## Environment Variables

`src/lib/env.ts` validates the server environment contract with Zod at import time. Copy `.env.example` to `.env` for a complete template.

### Required (no default — app, worker, and `next build` fail without them)

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL (e.g. `postgresql://arbor:arbor@localhost:5432/arbor`) |
| `REDIS_URL` | Redis connection URL (e.g. `redis://localhost:6379`) |
| `NEXTAUTH_SECRET` | Non-empty secret used by NextAuth.js to sign/encrypt JWT sessions |
| `ENCRYPTION_SECRET` | Non-empty secret used (AES-256-GCM) to encrypt stored user BYOK AI provider keys and GitHub access tokens; rotating it invalidates previously stored keys |

### Optional (defaults defined in `src/lib/env.ts`)

| Variable | Default | Description |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | `""` | GitHub OAuth App Client ID (`githubConfigured` is `false` when empty) |
| `GITHUB_CLIENT_SECRET` | `""` | GitHub OAuth App Client Secret |
| `GITHUB_WEBHOOK_SECRET` | `""` | HMAC secret for verifying `/api/webhooks/github` deliveries |
| `LEMONSQUEEZY_API_KEY` | `""` | Lemon Squeezy API key for workspace checkout & customer billing portal (`billingConfigured` is `false` when empty) |
| `LEMONSQUEEZY_STORE_ID` | `""` | Lemon Squeezy store ID for the `$15/month` per-workspace Teams plan |
| `LEMONSQUEEZY_TEAMS_VARIANT_ID` | `""` | Lemon Squeezy product variant ID for the Teams workspace subscription |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | `""` | HMAC-SHA256 signing secret for verifying `/api/webhooks/lemonsqueezy` deliveries |
| `APP_URL` | `https://arborgit.vercel.app` | Canonical application base URL (set `http://localhost:3000` locally) |
| `CRON_SECRET` | `""` | Bearer token guarding the serverless fallback route `/api/worker/process` |
| `CLONE_BASE_DIR` | `/tmp/arbor-clones` | Temporary directory for shallow repository clones during analysis |
| `CLONE_TIMEOUT` | `60` | Git clone timeout in seconds |
| `MAX_REPO_SIZE_MB` | `500` | Maximum repository size budget (MB) |
| `MAX_FILES` | `5000` | Maximum files indexed per scan |
| `MAX_FILE_SIZE_KB` | `100` | Maximum size per parsed source file (KB) |
| `MAX_PARSE_FILES` | `2500` | Maximum source files parsed with Babel AST per scan |
| `ANALYSIS_TIMEOUT_MS` | `300000` | Overall per-analysis timeout in milliseconds |
| `ADMIN_EMAILS` | `""` | Allowlist of admin user emails (comma-, semicolon-, or whitespace-separated) |
| `ADMIN_GITHUB_USERNAMES` | `""` | Allowlist of admin GitHub usernames |
| `ADMIN_USERNAME` | `""` | Optional admin credential username — must remain empty in production |
| `ADMIN_PASSWORD` | `""` | Optional admin credential password — must remain empty in production |

### Read outside `src/lib/env.ts`

- `NEXTAUTH_URL` — read by NextAuth.js at runtime for callback URL resolution.
- `RESEND_API_KEY`, `EMAIL_FROM` — optional; read directly in `src/server/services/admin.ts` for admin email broadcasts.
- `REPORT_BASE_URL`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, `PLAYWRIGHT_CHROMIUM_ARGS` — optional CLI overrides read by `scripts/export-report.ts` (`npm run report:pdf`).

> **AI provider keys are not environment variables.** OpenAI and Anthropic keys are bring-your-own-key per user, encrypted in PostgreSQL via `ENCRYPTION_SECRET`.

## Source Layout

```text
src/
├── app/                  # Next.js 15 App Router pages & API route handlers
│   ├── (auth)/           # GitHub login & admin login pages
│   ├── (dashboard)/      # Authenticated workbench (/dashboard, /projects, /systems, /settings)
│   ├── (print)/          # Print-dedicated A4 consultant audit route (/report/[token])
│   ├── admin/            # Platform admin views (users, workspaces, audit, waitlist, system)
│   ├── api/              # NextAuth, tRPC, GitHub webhooks, badges, share JSON, SBOM, cron worker
│   └── share/[token]/    # Public read-only shared report page
├── components/           # UI components (dashboard, marketing, auth, Radix/CreateUI primitives)
├── lib/                  # Zod env schema (env.ts), Prisma, Redis, NextAuth, AES-256-GCM crypto, SSRF
├── server/
│   ├── analysis/         # Deterministic Babel AST parser, dependency/SBOM scanner, policy packs
│   ├── routers/          # tRPC v11 routers
│   └── services/         # Domain logic (projects, workspaces, PR checks, triage, sharing, BYOK AI)
├── types/                # Module ambient type declarations
├── worker/               # Standalone BullMQ worker, startup stale-job recovery, schedule dispatcher
└── middleware.ts         # Route protection & security headers
scripts/
├── analyze-dir.ts        # Standalone local directory AST/dependency analyzer (analyze:local)
└── export-report.ts      # Playwright headless Chromium A4 PDF exporter (report:pdf)
```

For phase-by-phase backend architecture notes, SARIF Code Scanning upload, worker container deployment, and verification tracking, see [`docs/sarif-github-code-scanning.md`](docs/sarif-github-code-scanning.md), [`docs/worker-deployment.md`](docs/worker-deployment.md), [`docs/backend-review-feature-roadmap.md`](docs/backend-review-feature-roadmap.md), and [`docs/typecheck-baseline.md`](docs/typecheck-baseline.md).

## Worker Deployment (Docker, Fly.io, Railway & Cron Fallback)

- **Docker Compose (`Dockerfile` + `docker-compose.yml`):** Run `docker compose up -d --build` to start `postgres`, `redis`, `app` (`npm run start`), and `worker` (`npm run worker`) as long-lived containers.
- **Fly.io or Railway:** Build from the root `Dockerfile` with start command `npm run worker`, pointing `REDIS_URL`, `DATABASE_URL`, and `ENCRYPTION_SECRET` at the **exact same instances** configured on your Next.js web deployment so queued jobs are picked up continuously. Step-by-step instructions and `fly.worker.toml` config live in [`docs/worker-deployment.md`](docs/worker-deployment.md).
- **Serverless cron fallback (`/api/worker/process`):** `vercel.json` retains the daily `0 3 * * *` UTC cron (`Authorization: Bearer $CRON_SECRET`, `maxDuration = 300`) as a zero-infrastructure fallback when no long-lived worker is active.

## Development & Verification

```bash
npm ci
npx prisma generate
npx prisma validate
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

## Status

- **Verified by local verification command:**
  - `npx prisma generate` & `npx prisma validate`: valid schema (`30` Prisma models, Prisma CLI `5.22.0`).
  - `npm run typecheck` (`tsc --noEmit` with TypeScript `5.9.3`, `strict: true`): `0` diagnostics.
  - `npm run lint` (ESLint CLI across `297` files, `--max-warnings 0`): `0` errors, `0` warnings.
  - `npm test -- --run` (Vitest + Testing Library): `65` test files, `307` tests passing.
  - `npm run build`: Next.js `15.5.27` production build succeeds (including `/report/[token]`, `/api/webhooks/lemonsqueezy`, and `/api/projects/[slug]/analyses/[analysisId]/sarif`).
  - `npm run analyze:local -- . --sarif <file>`: computes per-file Babel AST cyclomatic complexity crossed with `simple-git` `git log` churn (`hotspots`), per-top-level-directory bus factors + copy-ready `.github/CODEOWNERS` ownership map (`ownership`), and OASIS SARIF 2.1.0 validated at runtime against `sarif-schema-2.1.0.json` (`1.6s` cold analysis across 3 runs — within the `<20%` budget over baseline).
  - `npm run report:pdf -- <token>`: verified end-to-end against PostgreSQL + `next start` + headless Chromium, producing an 8-page A4 consultant audit PDF (`docs/examples/arbor-audit-mdadeel-arbor.pdf`) with cover metadata, deterministic top-5 recommended actions, severity-grouped `file:line` findings, dependency risk inventory, per-page commit SHA watermark, and HTTP `404` on expired/revoked tokens.
- **GitHub Actions CI (`verify` and `build` jobs):** `unverified` — `.github/workflows/ci.yml` is authored with `postgres:16` and `redis:7` service containers, `npx prisma migrate deploy`, typecheck, lint, tests, and production build, and the CI badge above remains commented out until a maintainer with `workflows` GitHub permission pushes `.github/workflows/ci.yml` and confirms both jobs green.
- **Unit-tested only (`unverified` against live external services):**
  - BullMQ job execution against live Redis (`ReportShareLink` / `Analysis` / `Project` SQL migrations and read-only report rendering were verified against live PostgreSQL).
  - GitHub OAuth sign-in, webhook signature delivery lifecycle, and pull-request Check Runs against live GitHub repositories.
  - Lemon Squeezy live store checkout creation, customer billing portal refresh, and live merchant webhook delivery (HMAC-SHA256 verification, `BillingWebhookEvent` replay idempotency, owner-only checkout/portal authorization, and server-side `Free` vs `Teams` plan limits are verified by unit tests).
  - Optional BYOK OpenAI / Anthropic finding explanations and review-only patch suggestions against live provider APIs.
  - Resend email delivery (`RESEND_API_KEY`), live OSV advisory queries, and official CycloneDX schema validation (SBOM checks are currently structural only).
- **Known gaps & unbuilt capabilities:**
  - **Migration drift:** `prisma/schema.prisma` defines `30` models, whereas the `11` SQL migrations in `prisma/migrations/` create `25` tables (`AdminEmail`, `ProjectGroup`, `ProjectGroupMember`, `SystemAnalysis`, `WaitlistLead`, and `User` admin/plan fields are not yet in a SQL migration; use `npm run db:push` on fresh local databases).
  - **Serverless fallback latency:** When deployed without the long-lived `worker` container (`Dockerfile` / `docker-compose.yml` / Fly.io / Railway), `vercel.json` triggers `/api/worker/process` once daily at `03:00 UTC` (`maxDuration = 300`).
  - **Container runtime execution:** `Dockerfile` and `docker-compose.yml` (`app` and `worker` services) are structurally validated by `src/worker/container-config.test.ts`, while live `docker build` / `docker compose up` image execution is `unverified` in sandbox environments without a Docker daemon.
  - **Browser E2E suite:** `@playwright/test` powers `npm run report:pdf`, but no `playwright.config` or automated UI E2E spec suite exists yet (`unverified`).

## Licence

Arbor is licensed under the [GNU Affero General Public License v3.0](LICENSE) (`AGPL-3.0`).

- **Self-hosting and modification are free** under the terms of the AGPL-3.0.
- **Network use:** Offering a modified version of Arbor as a network service requires publishing your complete corresponding source modifications under the AGPL-3.0.
- **Commercial licensing:** A commercial licence is available for white-label deployments or closed-source hosting — contact [shahnawasadeel@gmail.com](mailto:shahnawasadeel@gmail.com).
