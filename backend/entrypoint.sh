#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
python - <<'PY'
import os
import sys
import time

import psycopg

host = os.environ.get("POSTGRES_HOST", "db")
port = os.environ.get("POSTGRES_PORT", "5432")
user = os.environ.get("POSTGRES_USER", "postgres")
password = os.environ.get("POSTGRES_PASSWORD", "postgres")
dbname = os.environ.get("POSTGRES_DB", "inventory_db")

for attempt in range(60):
    try:
        with psycopg.connect(
            host=host, port=port, user=user, password=password, dbname=dbname,
            connect_timeout=3,
        ):
            print("PostgreSQL is available.")
            sys.exit(0)
    except psycopg.OperationalError:
        time.sleep(1)

print("PostgreSQL never became available.", file=sys.stderr)
sys.exit(1)
PY

if [ "${RUN_MIGRATIONS:-True}" = "True" ]; then
    echo "Applying migrations..."
    python manage.py migrate --noinput
fi

if [ "${COLLECT_STATIC:-False}" = "True" ]; then
    echo "Collecting static files..."
    python manage.py collectstatic --noinput
fi

exec "$@"
