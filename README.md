# Arbor

The developer portal that understands your codebase.

Connect a GitHub repo. Get a full architectural audit in ~30 seconds. No YAML. No AI. No configuration.

## Quick Start

```bash
docker compose up -d
npm install
npm run db:migrate
npm run dev
```

## Tech Stack

- Next.js 14 (App Router)
- TypeScript strict mode
- tRPC
- PostgreSQL + Prisma
- NextAuth.js (GitHub OAuth)
- BullMQ + Redis
- React Flow + Recharts

## Development

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

## Architecture

See `.ai/architecture.md` and `docs/architecture/` for the full system design.
