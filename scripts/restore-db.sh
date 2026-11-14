#!/bin/bash
# Restore a dump made by backup-db.sh into the db container (DESTRUCTIVE).
# Usage: scripts/restore-db.sh <dump_file>
# Env:   DB_CONTAINER (default: financas-db)
# Recommended: test the backup in a scratch environment first.
set -euo pipefail

DUMP="${1:?usage: $0 <dump_file>}"
DB_CONTAINER="${DB_CONTAINER:-financas-db}"

if [ ! -f "$DUMP" ]; then
    echo "file not found: $DUMP" >&2
    exit 1
fi

echo "This will OVERWRITE objects in the database of container '$DB_CONTAINER' with: $DUMP"
read -r -p "Type 'restore' to continue: " ANSWER
if [ "$ANSWER" != "restore" ]; then
    echo "Aborted."
    exit 1
fi

# --clean --if-exists drops existing objects before recreating them.
docker exec -i "$DB_CONTAINER" sh -c \
    'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$DUMP"
echo "Restore finished."
