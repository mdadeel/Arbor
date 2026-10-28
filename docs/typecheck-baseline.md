# Typecheck Baseline (`tsc --noEmit`)

- **Date:** 2026-10-28
- **Base commit:** `9d2552242ff6aed016ea4e57b69321f388817f3b` (`main`)
- **TypeScript:** `5.9.3` (`strict: true`, `tsconfig.json` unmodified)
- **Prisma CLI / Client:** `5.22.0` (satisfying `^5.10.0` in `package.json`)

## Commands Executed

```bash
npx prisma generate
npm run typecheck
```

## Baseline Diagnostic Count

**0 diagnostics** (exit code `0`, empty diagnostic list).

```text
> arbor@0.1.0 typecheck
> tsc --noEmit
```

Re-running `npm run typecheck` after `npm run build` (with `.next/types/**/*.ts` populated) also produces **0 diagnostics**.

## Why `docs/backend-review-feature-roadmap.md` Reported 105 Diagnostics

`docs/backend-review-feature-roadmap.md` recorded 105 diagnostics from an earlier session in which `prisma generate` failed while downloading engine binaries from `binaries.prisma.sh` and `tsc --noEmit` ran against an incomplete hand-written Prisma stub in `node_modules/.prisma/client`.

Generating the real Prisma client from `prisma/schema.prisma` (`node_modules/.prisma/client/index.d.ts`, 54,987 lines covering all 28 models) resolves every Prisma model and inference diagnostic without source casts or `tsconfig.json` changes.
