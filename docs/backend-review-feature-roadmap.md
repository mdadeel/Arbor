# Backend Review & Feature Roadmap

**Implementation snapshot:** substantial code for Phases 0–5 is present on the Arena working branch. **No phase is marked release-complete.** Code presence, unit-test coverage, integration verification, and acceptance completion are tracked separately below.

**Goal:** harden access control and operational reliability, then expand analysis into a faster, more accurate, and more actionable code-health workflow. Preserve Arbor's existing responsive UI and use the Create UI component library for UI work.

## Status definitions

- **Code present:** an implementation exists in this checkout; this is not a claim that it is production-ready.
- **Unit-tested:** automated tests cover some specified behavior. Unit tests do not verify generated Prisma types, migrations against PostgreSQL, queue behavior against Redis, or live third-party integrations.
- **Integration-verified:** the feature has been exercised with the generated Prisma client and its real backing services. This remains blocked for the current checkout.
- **Complete:** all phase acceptance criteria, integration checks, and relevant operational/security review have evidence. No phase currently meets this bar.

## Review priorities

| Priority | Area | Direction |
| --- | --- | --- |
| P0 | Authorization and tenant boundaries | Enforce workspace roles and current project access in services, not only in UI/router assumptions. Revalidate cached and historical paths after membership changes. Protect admin data and impersonation with fresh account status. |
| P0 | Invitations and audit data | Avoid storing bearer invite secrets in plaintext; bind acceptance to the invited email and make it single-use. Restrict workspace audit reads to authorized roles. |
| P0 | Analysis reliability and resource use | Queue long system scans, make processing recoverable/idempotent, and apply shared per-user quotas to analysis entry points. |
| P1 | Webhook/PR workflow | Verify GitHub webhook signatures, deduplicate deliveries, persist PR analysis state, and publish actionable Check Runs. |
| P1 | Analysis usefulness | Add configurable policy packs, triage workflows, clearer evidence-linked finding guidance, and visual context for score/finding changes. |
| P2 | Lifecycle and ecosystem coverage | Add trends, notifications, scheduled scans, shareable reports, dependency/SBOM coverage, and additional AI/provider options with safe patch suggestions. |

## Phase 0 — Authorization and reliability fixes

**Code status:** present, including the latest workspace-project access review.
**Verification status:** unit tests and lint pass; database-backed behavior and generated-client typechecking are not verified.
**Release status:** incomplete.

Implementation in the working tree includes:

- Central workspace membership, role, and project-access checks; project references in groups are scoped to the caller's personal projects or current workspace memberships.
- Current-membership checks on project list/detail/recent-analysis caches, commit lookup, audit reads, health aggregation, global search (including documents), system groups, and notifications. Former workspace creators do not retain access solely because they created a shared project.
- Workspace project reads for current members and editor-role gates for mutations in project, environment, health-sync, documentation, API-spec, policy, triage, sharing, and patch-suggestion paths. Workspace audit reads require an authorized audit role.
- One-time workspace invitations store a SHA-256 token hash, bind acceptance to the normalized invited email, atomically claim pending invitations, and do not overwrite an existing membership role. General workspace responses omit invitations.
- Fine-grained administrative permissions, current database checks for suspended users and impersonation targets, and bounded impersonation state.
- Queued system analysis, atomic state transitions, transaction-backed result persistence, retry/recovery handling, stale-run cleanup, and reuse of an already-pending run.
- A shared 10-per-hour analysis budget across manual, project-creation, and system analysis; separate project-creation limits; waitlist request/rate bounds; and constrained AI input, provider/model allowlists, request rates, timeouts, output size, and parsed response shape.

### Phase 0 acceptance criteria

- Unauthorized workspace/project access fails before data mutation or disclosure, including after membership removal and cache reuse.
- Invitations are email-bound and single-use; only a token hash is persisted.
- Suspended accounts and unauthorized admins cannot use protected surfaces or impersonate users.
- Queued system runs can be processed and recovered without duplicate active work.
- Analysis, waitlist, and AI endpoints reject oversized or over-budget requests.
- Automated tests and lint pass; generated-Prisma typecheck and database-backed routes/workers are verified when the Prisma engine and services are available.

## Phase 1 — GitHub pull-request health checks

**Code status:** webhook delivery tracking, PR analysis lifecycle, Check Run handling, and worker integration are present.
**Verification status:** unit coverage exists for signatures, delivery handling, Check Run helpers, service behavior, and recovery; live GitHub App/repository integration is not verified.
**Release status:** incomplete.

Implementation in the working tree includes:

1. HMAC validation, delivery-ID checks, and bounded webhook request bodies.
2. Persisted delivery IDs and idempotent/reclaimable handling for retryable deliveries.
3. A `PullRequestAnalysis` lifecycle linked to project and analysis records.
4. Queued analysis and GitHub Check Run creation/update, summaries, and finding annotations.
5. Worker failure/recovery handling and stale/closed pull-request check finalization.

**Acceptance:** duplicate deliveries do not duplicate analyses or Check Runs; invalid signatures are rejected; completed checks include traceable results and actionable annotations; required GitHub App permissions and live repository behavior are verified.

## Phase 2 — Policy packs and triage

**Code status:** versioned policy settings, analysis snapshots, triage history, finding guidance, and related UI are present.
**Verification status:** policy and triage unit tests pass; database persistence and end-to-end UI behavior are not integration-verified.
**Release status:** incomplete.

Implementation in the working tree includes versioned security, accessibility, and maintainability policy packs; workspace/project overrides; immutable effective-policy snapshots; triage states and assignment/history; stable finding fingerprints; and richer explanation, impact, recommendation, evidence, confidence, and file/line context. Visual components use the Create UI library where applicable. AST import resolution uses the supplied repository root when present and falls back to path guessing only when it is absent; a regression test covers a nested-package alias case.

**Acceptance:** policy changes are reproducible and auditable; triage persists across scans; finding explanations are evidence-linked and useful to developers; responsive charts/visuals remain legible and do not obscure the findings.

## Phase 3 — Trends, notifications, scheduled scans, and sharing

**Code status:** trend snapshots/views, notification preferences and delivery, scheduling, and expiring/revocable report links are present.
**Verification status:** unit tests cover trend compatibility, deduplication, schedule helpers, recovery, and report access; database/Redis/cron and share-link deployments are not verified.
**Release status:** incomplete.

Implementation includes branch/version/policy-compatible trends; current-workspace-membership-scoped notifications; scheduled scan claiming and worker recovery; and share links stored as token hashes with expiration/revocation and a limited public report projection.

**Acceptance:** trends compare compatible scan versions; notifications are deduplicated and never reach former workspace members; schedules recover after worker restarts; shared reports disclose only explicitly authorized data and respect revocation/expiration.

## Phase 4 — Dependency and supply-chain analysis

**Code status:** supported-manifest/lockfile parsing, normalized inventory, advisory matching, CycloneDX generation, and report UI are present.
**Verification status:** parser, advisory failure behavior, and custom structural SBOM checks have unit coverage; live advisory freshness and validation with the official CycloneDX schema are not verified.
**Release status:** incomplete.

The implementation records inventory completeness/truncation and advisory source/freshness metadata, and keeps inventory results available when the advisory provider is unavailable. The current SBOM check is custom structural validation, not official-schema validation.

**Acceptance:** supported ecosystems are documented; generated SBOMs validate against the selected official standard; advisory findings are traceable and distinguish stale/unknown data; provider outages degrade clearly without hiding inventory limitations.

## Phase 5 — Multiple providers and safe AI patch suggestions

**Code status:** OpenAI/Anthropic provider selection, encrypted BYOK usage, constrained responses, and review-only patch suggestions are present.
**Verification status:** unit tests cover AI parsing/diff validation and rate limits; provider credentials, live model behavior, and repository-level test/static-check execution are not verified.
**Release status:** incomplete.

Suggestions are bounded to a source file pinned to the analyzed commit, validate unified-diff format/applicability, and are stored for review; the implementation does not write to repositories or open pull requests. Marking a suggestion accepted is a review state, not an automatic repository mutation.

**Acceptance:** provider failures degrade gracefully; suggestions are bounded, review-only by default, and accurately disclose validation limits; no secret or repository mutation occurs without explicit user action; feasible repository tests/static checks run before claiming a patch is validated.

## Validation snapshot

Latest local validation in this checkout:

- `npm test -- --run`: **52 test files, 259 tests passed**.
- `npm run lint`: **passed with no ESLint warnings or errors**. The script still invokes deprecated `next lint`; migration to the ESLint CLI remains follow-up work.
- `npm run typecheck`: **fails with 105 diagnostics** using the incomplete Prisma client stub currently in `node_modules/.prisma/client`. Most diagnostics are missing Prisma-generated inference/model types; a clean typecheck with the actual schema-generated client is unverified, not passed.
- Prisma client generation previously failed while fetching `schema-engine.gz.sha256` from `binaries.prisma.sh` because of a TLS/network disconnect. `npm run build` and Prisma-backed schema/migration validation therefore remain unverified.
- Production dependency audit: **0 vulnerabilities**. Full `npm audit`: **15 development-dependency vulnerabilities** (5 moderate, 8 high, 2 critical); the remaining advisories are in development-tooling chains.
- The preview's root page returned HTTP 200 with placeholder environment values and a temporary Prisma stub. This does not validate database-backed behavior. PostgreSQL, Redis, OAuth/GitHub credentials, and live provider integrations are not configured in this workspace.
- No official CycloneDX-schema validation or end-to-end PostgreSQL/Redis/third-party integration test has been performed.
- Direct integration to `main` has not occurred. Keep this work on the fixed Arena branch and do not represent any phase as complete until the corresponding acceptance and integration evidence is available.
