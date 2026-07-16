#!/bin/sh
set -e

echo "Applying database schema migrations..."
npx prisma migrate dev
echo "Migrations applied successfully."
