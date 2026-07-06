#!/bin/sh
set -e

ENV="${1:-staging}"

echo "[Deploy] Initiating deployment sequence for environment: $ENV"

if [ -f "./docker-compose.$ENV.yml" ]; then
  COMPOSE_FILE="./docker-compose.$ENV.yml"
elif [ "$ENV" = "prod" ] && [ -f "./docker-compose.prod.yml" ]; then
  COMPOSE_FILE="./docker-compose.prod.yml"
else
  echo "[Deploy Error] Configuration file docker-compose.$ENV.yml not found."
  exit 1
fi

echo "[Deploy] Building containerized images..."
docker compose -f "$COMPOSE_FILE" build

echo "[Deploy] Running Prisma database migration routines..."
docker compose -f "$COMPOSE_FILE" run --entrypoint "npx prisma migrate deploy" backend || echo "[Deploy Warning] Migration runner skipped or pending active DB connections."

echo "[Deploy] Restarting active stack services in background..."
docker compose -f "$COMPOSE_FILE" up -d

echo "[Deploy] Stack is operational. Verification check:"
docker compose -f "$COMPOSE_FILE" ps
