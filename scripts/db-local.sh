#!/usr/bin/env bash
# Local PostgreSQL 16 control (no Docker/sudo). Data lives in ~/devhub/pgdata.
# Usage: scripts/db-local.sh start|stop|status
set -euo pipefail

PG_BIN="$HOME/devhub/db/bin"
PGDATA="$HOME/devhub/pgdata"
LOG="$HOME/devhub/pg.log"

case "${1:-start}" in
  start)
    if (echo > /dev/tcp/127.0.0.1/5432) 2>/dev/null || (echo > /dev/tcp/127.0.0.1/5433) 2>/dev/null; then
      echo "postgres already running"
    elif [ -x "$PG_BIN/pg_ctl" ]; then
      "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$LOG" -o "-p 5433" start
    else
      echo "postgres not detected on 127.0.0.1:5432; start it with 'docker compose up -d' or configure DATABASE_URL"
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