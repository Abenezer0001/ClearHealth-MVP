#!/bin/bash
set -euo pipefail

TARGET_ENV="${TARGET_ENV:-staging}"

if [ "$TARGET_ENV" = "production" ] || [ "$TARGET_ENV" = "prod" ]; then
  exec ./deploy-zero-downtime-prod.sh
fi

exec ./deploy-zero-downtime-staging.sh
