#!/usr/bin/env bash
#
# TicketAll – deploy wrapper
# Ťahá aktuálny main, prebuilduje stack, počká na zdravý backend,
# vyčistí build cache a vypíše stav disku.
#
set -euo pipefail

REPO_DIR="/opt/maxiticket"
INFRA_DIR="${REPO_DIR}/infra"
ENV_FILE="${REPO_DIR}/.env"

# Health-check: backend 3001 nie je publikovaný na host a cesta má prefix 'v1',
# preto sa naň dopytujeme zvnútra docker siete cez jednorazový curl kontajner.
HEALTH_NETWORK="infra_internal"
HEALTH_URL="http://backend:3001/v1/health"
HEALTH_TIMEOUT=60   # max. celkové čakanie (s)
HEALTH_INTERVAL=3   # interval medzi pokusmi (s)

echo "==> [1/5] git pull origin main"
cd "${INFRA_DIR}"
git pull origin main

echo "==> [2/5] docker compose up -d --build"
docker compose --env-file "${ENV_FILE}" up -d --build

echo "==> [3/5] health-check backendu (${HEALTH_URL}, max ${HEALTH_TIMEOUT}s)"
# Malý curl image lokálne udržíme (builder prune ho neodstráni), tak len raz stiahneme.
docker image inspect curlimages/curl:latest >/dev/null 2>&1 || docker pull -q curlimages/curl:latest

waited=0
until docker run --rm --network "${HEALTH_NETWORK}" curlimages/curl:latest \
        --silent --fail --max-time 3 "${HEALTH_URL}" >/dev/null 2>&1; do
  if [ "${waited}" -ge "${HEALTH_TIMEOUT}" ]; then
    echo "❌ HEALTH CHECK FAILED – backend neodpovedal do ${HEALTH_TIMEOUT}s"
    echo "--- docker compose logs --tail=20 backend ---"
    docker compose --env-file "${ENV_FILE}" logs --tail=20 backend
    exit 1
  fi
  sleep "${HEALTH_INTERVAL}"
  waited=$((waited + HEALTH_INTERVAL))
done
echo "✅ Backend healthy (po ${waited}s)"

echo "==> [4/5] docker builder prune -f (čistenie build cache)"
docker builder prune -f

echo "==> [5/5] stav disku po deployi"
df -h /
echo "--- docker system df ---"
docker system df

echo "==> Deploy dokončený."
