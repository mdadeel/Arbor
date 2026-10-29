#!/bin/sh
set -eu

# Optional inline schema sync toggle for single-container PaaS deployments.
# In Docker Compose, the dedicated `migrate` one-shot service reconciles all 30
# Prisma models once (`npx prisma db push --skip-generate`) before `app` and
# `worker` start so fresh self-hosted PostgreSQL instances work out of the box.
if [ "${ARBOR_RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[arbor:entrypoint] Reconciling Prisma database schema..."
  npx prisma db push --skip-generate
fi

exec "$@"
