#!/bin/bash
# ATARAXIA PostgreSQL Backup — corre diario a las 3am via cron
# Guarda 7 días de backups en /opt/backups/

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/ATARAXIA/.env}"
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-ataraxia}"
CONTAINER="${POSTGRES_CONTAINER:-ataraxia-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
DATE=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/ataraxia-$DATE.sql.gz"

mkdir -p "$BACKUP_DIR"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"

# Eliminar backups de más de 7 días
find "$BACKUP_DIR" -name "ataraxia-*.sql.gz" -mtime +7 -delete

echo "✓ Backup guardado: $FILE ($(du -sh "$FILE" | cut -f1))"
logger -t ataraxia-backup "Backup completado: $FILE"
