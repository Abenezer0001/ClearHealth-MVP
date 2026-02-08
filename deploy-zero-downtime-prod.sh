#!/bin/bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
CADDYFILE_PATH="${CADDYFILE_PATH:-/etc/caddy/Caddyfile}"
SERVER_DOMAIN="${SERVER_DOMAIN:-linux.achievengine.com}"
SERVICE_NAME="${SERVICE_NAME:-backend}"
DOCKERFILE="${DOCKERFILE:-Dockerfile}"
PORT_A="${PORT_A:-5600}"
PORT_B="${PORT_B:-5601}"
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost}"
HEALTH_CHECK_PATH="${HEALTH_CHECK_PATH:-/api/health}"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-18}"
SLEEP_TIME="${SLEEP_TIME:-5}"
DEPLOY_STACK_NAME="${DEPLOY_STACK_NAME:-clearhealth-mvp-prod}"
NETWORK_NAME="${NETWORK_NAME:-${DEPLOY_STACK_NAME}_backend-network}"
REDIS_VOLUME_NAME="${REDIS_VOLUME_NAME:-${DEPLOY_STACK_NAME}_redis_data}"
DOPPLER_PROJECT="${DOPPLER_PROJECT:-clearhealth-mvp}"
DOPPLER_CONFIG="${DOPPLER_CONFIG:-prd}"

run_sudo() {
  if [ -n "${SUDO_PASSWORD:-}" ]; then
    echo "${SUDO_PASSWORD}" | sudo -S "$@"
  else
    sudo "$@"
  fi
}

echo "=========================================="
echo "Zero-Downtime Deployment (Production)"
echo "=========================================="

cd "$PROJECT_DIR"

CURRENT_PORT=$(awk -v domain="$SERVER_DOMAIN" '
  function cnt_open(s) { t=s; return gsub(/\{/, "", t) }
  function cnt_close(s){ t=s; return gsub(/\}/, "", t) }
  BEGIN { inblock=0; depth=0 }
  $0 ~ ("^" domain "[[:space:]]*\\{") && !inblock {
    inblock=1
    depth += cnt_open($0) - cnt_close($0)
    if (match($0, /localhost:([0-9]+)/, m)) { print m[1]; exit }
    next
  }
  inblock {
    if (/reverse_proxy/ && match($0, /localhost:([0-9]+)/, m)) { print m[1]; exit }
    depth += cnt_open($0) - cnt_close($0)
    if (depth<=0) { inblock=0 }
  }
' "$CADDYFILE_PATH")

if [ -z "${CURRENT_PORT}" ]; then
  echo "ERROR: Could not determine active port for ${SERVER_DOMAIN} from ${CADDYFILE_PATH}"
  echo "Expected reverse_proxy localhost:${PORT_A} or localhost:${PORT_B} in that domain block."
  exit 1
fi

if [ "$CURRENT_PORT" = "$PORT_A" ]; then
  NEW_PORT="$PORT_B"
elif [ "$CURRENT_PORT" = "$PORT_B" ]; then
  NEW_PORT="$PORT_A"
else
  echo "ERROR: Active port ${CURRENT_PORT} is outside expected set (${PORT_A}, ${PORT_B})."
  exit 1
fi

APP_SERVICE_NAME="${SERVICE_NAME}_${NEW_PORT}"

echo "Current port: ${CURRENT_PORT}"
echo "Deploying new revision on: ${NEW_PORT}"

cat > docker-compose.deploy.yml <<EOF
services:
  ${APP_SERVICE_NAME}:
    build:
      context: .
      dockerfile: ${DOCKERFILE}
    restart: always
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - DOPPLER_TOKEN=\${DOPPLER_TOKEN:-}
      - DOPPLER_PROJECT=${DOPPLER_PROJECT}
      - DOPPLER_CONFIG=${DOPPLER_CONFIG}
    command: ["/sbin/tini", "--", "sh", "-c", "export PORT=${NEW_PORT} && doppler run --project ${DOPPLER_PROJECT} --config ${DOPPLER_CONFIG} --preserve-env=PORT,NODE_ENV -- npm run start"]
    ports:
      - "127.0.0.1:${NEW_PORT}:${NEW_PORT}"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:${NEW_PORT}${HEALTH_CHECK_PATH}"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 15s
    volumes:
      - ./logs:/app/logs:rw
    networks:
      - backend-network
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    networks:
      - backend-network
    volumes:
      - redis_data:/data

networks:
  backend-network:
    name: ${NETWORK_NAME}
    external: true

volumes:
  redis_data:
    name: ${REDIS_VOLUME_NAME}
    external: true
EOF

docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1 || docker network create "${NETWORK_NAME}"
docker volume inspect "${REDIS_VOLUME_NAME}" >/dev/null 2>&1 || docker volume create "${REDIS_VOLUME_NAME}"

docker compose -f docker-compose.deploy.yml build --no-cache "${APP_SERVICE_NAME}"
docker compose -f docker-compose.deploy.yml up -d "${APP_SERVICE_NAME}"

attempt=1
until curl -fsS "${HEALTH_CHECK_URL}:${NEW_PORT}${HEALTH_CHECK_PATH}" >/dev/null 2>&1; do
  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "ERROR: New service failed health checks on port ${NEW_PORT}."
    docker compose -f docker-compose.deploy.yml logs --tail 150 "${APP_SERVICE_NAME}" || true
    docker compose -f docker-compose.deploy.yml stop "${APP_SERVICE_NAME}" || true
    docker compose -f docker-compose.deploy.yml rm -f "${APP_SERVICE_NAME}" || true
    rm -f docker-compose.deploy.yml
    exit 1
  fi
  echo "Health check attempt ${attempt}/${MAX_ATTEMPTS} failed; retrying in ${SLEEP_TIME}s..."
  sleep "$SLEEP_TIME"
  attempt=$((attempt + 1))
done

echo "New service healthy on ${NEW_PORT}."

RUNTIME_DIR="$PROJECT_DIR/.caddy_runtime"
mkdir -p "$RUNTIME_DIR"
TEMP_CADDYFILE="$RUNTIME_DIR/Caddyfile.${SERVER_DOMAIN//./_}"

awk -v domain="$SERVER_DOMAIN" -v oldp="$CURRENT_PORT" -v newp="$NEW_PORT" '
  function cnt_open(s) { t=s; return gsub(/\{/, "", t) }
  function cnt_close(s){ t=s; return gsub(/\}/, "", t) }
  BEGIN { inblock=0; depth=0 }
  $0 ~ ("^" domain "[[:space:]]*\\{") && !inblock {
    inblock=1
    depth += cnt_open($0) - cnt_close($0)
    if (/reverse_proxy/) { gsub("localhost:" oldp, "localhost:" newp) }
    print
    next
  }
  inblock {
    if (/reverse_proxy/) { gsub("localhost:" oldp, "localhost:" newp) }
    print
    depth += cnt_open($0) - cnt_close($0)
    if (depth<=0) { inblock=0 }
    next
  }
  { print }
' "$CADDYFILE_PATH" > "$TEMP_CADDYFILE"

if /usr/bin/caddy reload --config "$TEMP_CADDYFILE" --adapter caddyfile; then
  echo "Caddy reloaded via CLI."
elif /usr/bin/caddy adapt --config "$TEMP_CADDYFILE" --pretty > "$RUNTIME_DIR/caddy.json" 2>/dev/null \
  && curl -sf -H 'Content-Type: application/json' --data-binary @"$RUNTIME_DIR/caddy.json" http://localhost:2019/load >/dev/null; then
  echo "Caddy reloaded via admin API."
else
  echo "ERROR: Failed to reload Caddy; cleaning up new container."
  docker compose -f docker-compose.deploy.yml stop "${APP_SERVICE_NAME}" || true
  docker compose -f docker-compose.deploy.yml rm -f "${APP_SERVICE_NAME}" || true
  rm -f docker-compose.deploy.yml "$RUNTIME_DIR/caddy.json" "$TEMP_CADDYFILE"
  exit 1
fi

run_sudo cp "$TEMP_CADDYFILE" "$CADDYFILE_PATH"
echo "Updated ${CADDYFILE_PATH} to port ${NEW_PORT}."

if [ -n "$PUBLIC_HEALTH_URL" ]; then
  sleep 2
  curl -fsS "$PUBLIC_HEALTH_URL" >/dev/null && echo "Public health check passed: ${PUBLIC_HEALTH_URL}" || echo "Warning: public health check failed: ${PUBLIC_HEALTH_URL}"
fi

OLD_CONTAINERS=$(docker ps -q --filter "publish=${CURRENT_PORT}")
if [ -n "$OLD_CONTAINERS" ]; then
  echo "Stopping old containers on ${CURRENT_PORT}: ${OLD_CONTAINERS}"
  for container in $OLD_CONTAINERS; do
    docker stop "$container"
    docker rm "$container"
  done
fi

rm -f docker-compose.deploy.yml "$RUNTIME_DIR/caddy.json" "$TEMP_CADDYFILE" 2>/dev/null || true

echo "✅ Production deployment complete. Active port is now ${NEW_PORT}."
