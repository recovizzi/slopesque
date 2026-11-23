#!/bin/sh
# On the machine, as the deploy account (pnpm deploy:prod and the Release workflow run it): the stack with this image,
# started and checked. Usage: sh deploy.sh <image> [pull]
#   docker-compose.prod.yml, plus docker-compose.proxy.yml when infra/.env names the proxy's network (PROXY_NETWORK).
set -eu
cd "$(dirname "$0")"
test -f .env || { echo "Il manque infra/.env : pnpm deploy:prod --init"; exit 1; }
files="-f docker-compose.prod.yml"
if grep -qE '^PROXY_NETWORK=.+' .env; then files="$files -f docker-compose.proxy.yml"; fi
export SERVER_IMAGE="$1"
if [ "${2:-}" = pull ]; then docker compose $files --env-file .env pull server; fi
docker compose $files --env-file .env up -d --wait --no-build --remove-orphans
port=$(grep -E '^PUBLIC_PORT=' .env | cut -d= -f2)
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:${port:-23180}/api/health" > /dev/null 2>&1; then echo "✓ serveur en bonne santé ($SERVER_IMAGE)"; break; fi
  [ "$i" = 10 ] && { echo "✖ le serveur ne répond pas sur le port local ${port:-23180}"; docker compose $files --env-file .env logs --tail 40 server; exit 1; }
  sleep 2
done
# the last 3 images of the server kept, the older ones removed
docker images --format '{{.Repository}}:{{.Tag}}' | grep -E 'slopesque-server:' | grep -vx "$SERVER_IMAGE" | sort -r | tail -n +3 | xargs -r docker rmi > /dev/null 2>&1 || true
