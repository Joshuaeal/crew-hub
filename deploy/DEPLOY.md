# Deploy the full Crew stack

All containerized services are defined in `docker-compose.yml` at the repo root.

## Prerequisites

- `git`
- Docker Desktop or Docker Engine + Compose v2
- Ports **free** on localhost: `38471`, `8008` (Synapse)

## Quick start (Docker Compose)

```bash
git clone https://github.com/Joshuaeal/Crew-Hub.git
cd Crew-Hub
cp .env.example .env
docker compose up -d --build
```

## Fresh-instance first run

1. Open Crew Hub:
   - local: `http://127.0.0.1:38471`
   - LAN: `http://<server-ip>:38471` (e.g. `http://192.168.1.10:38471`)
2. Create the first **admin** account on `/login` (only possible when no users exist yet).
3. Go to `/setup` to configure:
   - company name + logo (shows on invoices)
   - email sender defaults
   - invoice terms / global CSS

## URLs (default)

| Service | URL | Notes |
|--------|-----|--------|
| Crew Hub | http://127.0.0.1:38471 | Billing, channels (Matrix SDK), shifts, **HR** (directory & leave), admin tools |
| Synapse | http://127.0.0.1:8008 | Matrix homeserver; **Channels** in Crew uses `NEXT_PUBLIC_MATRIX_HOMESERVER_URL` / `MATRIX_UPSTREAM_URL` |

**Element Web** is no longer part of the compose file; Matrix chat runs inside Crew via `matrix-js-sdk`.

### CORS

If the browser blocks login to Synapse from Crew Hub, configure Synapse (or a reverse proxy) to allow your Crew origin for client API requests.

## Reverse proxy / Cloudflare Tunnel

- Set `NEXT_PUBLIC_CREW_PUBLIC_URL` in `.env` to your external URL (used in invoice email links).
- If using Synapse Admin from inside the hub, set `NEXT_PUBLIC_SERVICE_SYNAPSE_URL` to a reachable URL from your browser.

## Data persistence / backups

Compose uses named volumes:

- `crew_hub_data` → Crew Hub data (`/app/.data`)
- `synapse-data` → Matrix Synapse data (`/data`)

Back up these volumes (or migrate to bind-mounts on your server).

## HR (people & leave)

Built into Crew Hub — see **`deploy/ORANGEHRM.md`** (filename kept for old links).

## Swarm / Stack (optional)

If you want Swarm, use `deploy/stack.yml` + `deploy/STACK.md`.

## Troubleshooting

- **Matrix login fails**: create a user on Synapse first; check CORS and Matrix proxy env vars.
- **Rebuild Hub** after changing `NEXT_PUBLIC_*`: `docker compose up -d --build crew-hub`.
