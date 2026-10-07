#!/usr/bin/env bash
set -euo pipefail

echo "Applying database migrations..."
bun packages/db/src/migrate.ts

exec "$@"
