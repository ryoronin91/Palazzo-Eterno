#!/usr/bin/env bash
# Palazzo Eterno Custode 1.2: PostgreSQL archive encrypted before upload.
set -Eeuo pipefail
umask 077

: "${CUSTODE_BACKUP_DATABASE_URL:?Secret CUSTODE_BACKUP_DATABASE_URL non configurato}"
: "${CUSTODE_AGE_RECIPIENT:?Variabile CUSTODE_AGE_RECIPIENT non configurata}"

if [[ ! "$CUSTODE_AGE_RECIPIENT" =~ ^age1[a-z0-9]{20,}$ ]]; then
  echo 'ERRORE: destinatario age non valido' >&2
  exit 2
fi

command -v docker >/dev/null || { echo 'Docker non disponibile' >&2; exit 2; }
command -v age >/dev/null || { echo 'age non disponibile' >&2; exit 2; }
command -v sha256sum >/dev/null || { echo 'sha256sum non disponibile' >&2; exit 2; }

ROOT="${GITHUB_WORKSPACE:-$(pwd)}"
OUT="$ROOT/custode-backup"
mkdir -p "$OUT"
WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="palazzo-eterno-${STAMP}.dump.age"

# postgres:17 is aligned with Palazzo Eterno's PostgreSQL 17 server.
# The database URL is passed as an environment variable, not as a command argument.
# If any schema/table is inaccessible, pg_dump fails and no backup is uploaded.
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --volume "$WORK:/backup" \
  --env CUSTODE_BACKUP_DATABASE_URL \
  postgres:17 sh -ec '
    pg_dump --dbname="$CUSTODE_BACKUP_DATABASE_URL" \
      --format=custom --compress=6 --no-owner --no-privileges \
      --file=/backup/database.dump
    pg_restore --list /backup/database.dump >/backup/contents.list
    test -s /backup/database.dump
    grep -Eq "TABLE DATA|TABLE" /backup/contents.list
  '

# Verify the archive before destroying plaintext, then encrypt the whole database.
age --encrypt --recipient "$CUSTODE_AGE_RECIPIENT" \
  --output "$OUT/$NAME" "$WORK/database.dump"
test -s "$OUT/$NAME"
sha256sum "$OUT/$NAME" > "$OUT/$NAME.sha256"
echo "Backup cifrato creato: $NAME ($(wc -c < "$OUT/$NAME") byte)"
echo 'Verifica archivio pg_restore --list superata.'
echo 'NOTA: il controllo dell archivio NON equivale a un test completo di ripristino.'
