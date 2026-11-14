#!/bin/bash
# Backup the Postgres database (custom format) from the db container.
# Usage: scripts/backup-db.sh <target_dir> [keep=14]
# Env:   DB_CONTAINER (default: financas-db)
set -euo pipefail

TARGET_DIR="${1:?usage: $0 <target_dir> [keep]}"
KEEP="${2:-14}"
DB_CONTAINER="${DB_CONTAINER:-financas-db}"

if ! [[ "$KEEP" =~ ^[0-9]+$ ]] || [ "$KEEP" -lt 1 ]; then
    echo "keep must be a positive integer" >&2
    exit 1
fi

umask 077
mkdir -p "$TARGET_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$TARGET_DIR/financas-$STAMP.dump"
TMP="$OUT.partial"

# Credentials are read from the container's own environment (never passed here).
if ! docker exec "$DB_CONTAINER" sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$TMP"; then
    rm -f "$TMP"
    echo "pg_dump failed" >&2
    exit 1
fi
chmod 600 "$TMP"
mv "$TMP" "$OUT"
echo "Backup written: $OUT"

# Retention: keep only the newest $KEEP dumps (timestamped names sort chronologically).
{ ls -1 "$TARGET_DIR"/financas-*.dump 2>/dev/null || true; } | sort -r | tail -n +"$((KEEP + 1))" | while read -r old; do
    rm -f -- "$old"
    echo "Removed old backup: $old"
done
