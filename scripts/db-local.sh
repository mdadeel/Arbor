#!/usr/bin/env bash
# Local PostgreSQL 16 control (no Docker/sudo). Data lives in ~/devhub/pgdata.
# Usage: scripts/db-local.sh start|stop|status
set -euo pipefail

PG_BIN="$HOME/devhub/db/bin"
PGDATA="$HOME/devhub/pgdata"
LOG="$HOME/devhub/pg.log"

case "${1:-start}" in
  start)
    if "$PG_BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
      echo "postgres already running"
    else
      "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$LOG" -o "-p 5432" start
    fi
    ;;
  stop)
    "$PG_BIN/pg_ctl" -D "$PGDATA" stop -m fast
    ;;
  status)
    "$PG_BIN/pg_ctl" -D "$PGDATA" status
    ;;
  *)
    echo "usage: db-local.sh start|stop|status" >&2
    exit 1
    ;;
esac