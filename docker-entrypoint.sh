#!/bin/sh
# First-run seeding for the Casebook container.
#
# The image ships a synthetic demo database and its uploaded files at /app/seed-data. If the
# mounted data volume has no database yet, copy the seed in so the instance starts populated;
# after that the volume is the source of truth and this script leaves it untouched. The data
# volume is the only persistent state: back it up to keep an instance.
set -e

DATABASE_FILE="${DATABASE_FILE:-./data/casebook.db}"

if [ ! -f "$DATABASE_FILE" ]; then
  echo "No database at $DATABASE_FILE — seeding from the bundled synthetic dataset."
  mkdir -p "$(dirname "$DATABASE_FILE")"
  cp -a /app/seed-data/. "$(dirname "$DATABASE_FILE")/"
else
  echo "Existing database at $DATABASE_FILE — leaving it in place."
fi

exec "$@"
