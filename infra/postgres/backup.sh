#!/bin/bash
# Daily PostgreSQL backup – run via cron as deploy user
# cron: 0 3 * * * /opt/maxiticket/infra/postgres/backup.sh >> /var/log/pg-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="/opt/maxiticket/backups/postgres"
RETENTION_DAYS=14
DATE=$(date +%Y-%m-%d_%H-%M)
COMPOSE_DIR="/opt/maxiticket/infra"

mkdir -p "$BACKUP_DIR"

echo "[$DATE] Starting backup..."

docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-maxiticket}" "${POSTGRES_DB:-maxiticket}" \
  | gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"

echo "[$DATE] Backup saved: backup_$DATE.sql.gz"

# Remove backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[$DATE] Old backups cleaned (>${RETENTION_DAYS}d)"
