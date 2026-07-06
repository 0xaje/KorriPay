#!/bin/sh
set -e

# Load environment configs
if [ -f ./backend/.env ]; then
  . ./backend/.env
fi

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/korripay_backup_$TIMESTAMP.sql"

echo "[Backup] Starting PostgreSQL database backup..."
if [ -n "$DATABASE_URL" ]; then
  pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
  gzip "$BACKUP_FILE"
  echo "[Backup] Successfully saved database backup to ${BACKUP_FILE}.gz"
else
  echo "[Backup Error] DATABASE_URL is not set in environment or backend/.env."
  exit 1
fi
