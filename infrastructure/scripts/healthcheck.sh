#!/bin/sh
set -e

API_URL=${API_URL:-"http://localhost:3001/health"}

echo "Checking API Gateway health status at $API_URL..."
if curl -s -f "$API_URL" > /dev/null; then
  echo "API Gateway is healthy."
  exit 0
else
  echo "API Gateway health check failed."
  exit 1
fi
