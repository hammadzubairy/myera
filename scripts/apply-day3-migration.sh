#!/usr/bin/env bash
# Apply Day 3 SQL. Requires DATABASE_URL or SUPABASE_DB_URL (postgres connection string).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="$ROOT/supabase/migrations/20261020000000_day3_notifications_admin.sql"
URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [[ -z "$URL" ]]; then
  echo "Set SUPABASE_DB_URL (or DATABASE_URL) to your Supabase Postgres URI, then re-run."
  echo "Or paste $SQL into https://supabase.com/dashboard/project/ewmnfzwmmpjmvmxhtdba/sql"
  exit 1
fi
psql "$URL" -v ON_ERROR_STOP=1 -f "$SQL"
echo "Day 3 migration applied."
