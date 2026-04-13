#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Creating .env from .env.example — edit secrets for production."
  cp .env.example .env
fi

if grep -q 'replace-with-a-long-random-secret-min-16-chars' .env 2>/dev/null; then
  SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|^CREW_SESSION_SECRET=.*|CREW_SESSION_SECRET=${SECRET}|" .env
  else
    sed -i "s|^CREW_SESSION_SECRET=.*|CREW_SESSION_SECRET=${SECRET}|" .env
  fi
  echo "Generated CREW_SESSION_SECRET in .env"
fi

# matrixdotorg/synapse no longer creates homeserver.yaml from env vars alone; without it the
# container exits in a loop and nothing listens on 8008. Generate once into the volume first.
echo "Checking Synapse config…"
set +e
docker compose run --rm -T --entrypoint /bin/sh synapse -c 'test -f /data/homeserver.yaml' 2>/dev/null
synapse_cfg_ok=$?
set -e
if [[ "$synapse_cfg_ok" -ne 0 ]]; then
  echo "Generating Synapse homeserver.yaml (first run; see docker/README in Synapse repo)…"
  docker compose run --rm -T synapse generate
fi

echo "Building and starting stack…"
docker compose up -d --build

PORT="${CREW_HUB_PORT:-38471}"
ADMIN_PORT="${SYNAPSE_ADMIN_PORT:-18088}"
echo ""
echo "Crew Hub:        http://127.0.0.1:${PORT}  (HR: /hr)"
echo "Synapse (API):   http://127.0.0.1:8008"
echo "Synapse Admin:   http://127.0.0.1:${ADMIN_PORT}  (embed /synapse; set Homeserver to hub URL or :8008)"
echo ""
