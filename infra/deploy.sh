#!/usr/bin/env bash
#
# TicketAll – deploy wrapper
# Ťahá aktuálny main, prebuilduje stack, vyčistí build cache a vypíše stav disku.
#
set -euo pipefail

REPO_DIR="/opt/maxiticket"
INFRA_DIR="${REPO_DIR}/infra"
ENV_FILE="${REPO_DIR}/.env"

echo "==> [1/4] git pull origin main"
cd "${INFRA_DIR}"
git pull origin main

echo "==> [2/4] docker compose up -d --build"
docker compose --env-file "${ENV_FILE}" up -d --build

echo "==> [3/4] docker builder prune -f (čistenie build cache)"
docker builder prune -f

echo "==> [4/4] stav disku po deployi"
df -h /
echo "--- docker system df ---"
docker system df

echo "==> Deploy dokončený."
