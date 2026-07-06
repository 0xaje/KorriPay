#!/bin/sh
set -e

# Load environment configs
if [ -f ./backend/.env ]; then
  . ./backend/.env
fi

if [ -z "$1" ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[Restore Error] Backup file $BACKUP_FILE does not exist."
  exit 1
fi

echo "[Restore] Restoring PostgreSQL database from $BACKUP_FILE..."

if [ -n "$DATABASE_URL" ]; then
  UNCOMPRESSED_FILE="./backups/temp_restore.sql"
  gunzip -c "$BACKUP_FILE" > "$UNCOMPRESSED_FILE"
  
  # Run SQL script through psql connection
  psql "$DATABASE_URL" -f "$UNCOMPRESSED_FILE"
  
  rm -f "$UNCOMPRESSED_FILE"
  echo "[Restore] Database successfully restored."
else
  echo "[Restore Error] DATABASE_URL is not set in environment or backend/.env."
  exit 1
fi
