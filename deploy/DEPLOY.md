# Deploy Crew Hub

All services are defined in `docker-compose.yml` at the repo root.

## Prerequisites

- Docker Engine + Docker Compose v2 (or Docker Desktop)
- Ports free on the host: `38471`, `8008`, `18088`

## Quick start

```bash
git clone https://github.com/Joshuaeal/crew-hub.git
cd crew-hub
cp .env.example .env
```

Edit `.env` — set at minimum:

```bash
CREW_SESSION_SECRET=your-long-random-secret
SYNAPSE_SERVER_NAME=your-domain.com   # or 'localhost' for local/LAN
```

Then start the stack:

```bash
docker compose up -d --build
```

Open `http://<server-ip>:38471`.

## First-run setup

1. Open the app and create an **admin account** on `/login` (only shown when no users exist yet).
2. You are redirected automatically to the **setup wizard** (`/admin/instance`).
3. In the wizard:
   - **Choose modules** — tick only what this company needs (Billing, Inventory, Shifts, HR, Comms, Subcontractor Portal)
   - Set company name, logo, and brand colour
   - Configure Matrix homeserver and Synapse admin URLs if needed
   - Set billing defaults (sender block, invoice number format, email sender)
4. Click **Complete setup →**

The dashboard opens showing only the enabled modules. Everything can be changed later at **Admin → Instance settings**.

## URLs (default)

| Service | URL | Notes |
|--------|-----|--------|
| Crew Hub | `http://<ip>:38471` | Main application |
| Synapse | `http://<ip>:8008` | Matrix homeserver |
| Synapse Admin | `http://<ip>:18088` | Synapse management UI |
| Whisper ASR | `http://<ip>:9000` | Speech-to-text (optional, see below) |

Matrix chat runs inside Crew Hub via `matrix-js-sdk` — no separate Element install needed.

## Whisper ASR (voice transcription, optional)

Crew Hub includes a live transcription feature that posts spoken audio as text into Matrix rooms. Transcription runs **entirely on your server** — no audio leaves your network.

Start the Whisper service:

```bash
docker compose up -d whisper-asr
```

Then use **Comms → Transcribe** in the app. Adjust the model size in `.env`:

```bash
WHISPER_ASR_MODEL=base.en   # tiny.en / base.en / small.en / medium.en
```

Larger models are more accurate but use more RAM. `base.en` is a good default.

## Adding users

Go to **Admin → Users** and create accounts. Assign permissions per module — enabling a module makes it visible, but users still need the relevant permission to access it.

## Reverse proxy / Cloudflare Tunnel

Point your public hostname at port `38471`. The app proxies `/_matrix` internally so only one public origin is needed.

Set in `.env` if using an external URL:

```bash
NEXT_PUBLIC_CREW_PUBLIC_URL=https://your-domain.com
```

## Data persistence / backups

Compose uses named Docker volumes:

- `crew_hub_data` — all app data (`/app/.data`)
- `synapse-data` — Matrix homeserver data

Back up both volumes, or switch to bind-mounts on your server for easier access.

## Updating

```bash
git pull
docker compose up -d --build
```

Settings and data in volumes survive rebuilds.

## Swarm / Stack (optional)

For multi-node Swarm deployments, see `deploy/STACK.md` and `deploy/stack.yml`.

## Troubleshooting

- **Matrix login fails**: check `MATRIX_UPSTREAM_URL` (must be reachable from the crew-hub container, e.g. `http://synapse:8008`) and `SYNAPSE_SERVER_NAME`.
- **Rebuild after changing `NEXT_PUBLIC_*` vars**: `docker compose up -d --build crew-hub`
- **esbuild platform error** (dev only): `rm -rf node_modules && npm ci` in `crew-hub/`
