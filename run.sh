#!/usr/bin/env bash
# Starts the Kanairo-Klean API from a fresh clone.
#   ./run.sh          install if needed, create missing tables, start the API
#   ./run.sh --seed   also reset the database to the demo data (DELETES existing rows)
set -e
cd "$(dirname "$0")/server"

if [ ! -f .env ]; then
  echo "server/.env is missing. Copy server/.env.example to server/.env and fill it in (see README)." >&2
  exit 1
fi

[ -d node_modules ] || npm ci

npm run db:schema          # adds missing tables/columns, keeps existing data
if [ "$1" = "--seed" ]; then
  npm run db:seed          # clears and replaces the local tables
fi

npm start
