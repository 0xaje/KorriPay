#!/bin/sh
set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "Initiating database backup..."
echo "Simulating pg_dump for PostgreSQL..."
echo "-- KorriPay DB Backup" > "$BACKUP_FILE"
echo "Backup saved successfully: $BACKUP_FILE"
