# Crew Hub

Self-hosted team workspace for production companies. Deploy it, run the setup wizard, choose which modules to enable, and hand it to the team.

## What's included

| Module | Features |
|---|---|
| Invoicing & Billing | Invoices, quotes, clients, catalog, payables |
| Inventory | Stock, checkout, jobs, approvals |
| Shifts & Scheduling | Shift list, calendar, crew management |
| HR | Directory, leave requests, document storage |
| Communications | Matrix channels, production video (VDO.Ninja), live voice transcription |
| Subcontractor Portal | Separate login, invoice intake |

Enable only what each company needs. Everything is toggled from the setup wizard on first run — no config files to edit.

## Requirements

- Docker Engine + Docker Compose v2 (or Docker Desktop)

## Deploy

No repo clone needed — just grab the two config files and start:

```bash
curl -O https://raw.githubusercontent.com/Joshuaeal/crew-hub/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/Joshuaeal/crew-hub/main/.env.example
cp .env.example .env
```

Edit `.env` — at minimum set:

```bash
CREW_SESSION_SECRET=your-long-random-secret
SYNAPSE_SERVER_NAME=your-domain.com   # or 'localhost' for local/LAN
```

Then:

```bash
docker compose up -d
```

Docker pulls the pre-built image from GHCR automatically. Open `http://<server-ip>:38471`.

## First-run setup

1. Open the app and create an **admin account** (`/login` — only shown when no users exist)
2. You will be redirected to the **setup wizard** automatically
3. **Choose your modules** — tick only what this deployment needs
4. Set company name, logo, brand colour
5. Optionally configure Matrix homeserver, VDO.Ninja, billing defaults
6. Click **Complete setup →**

Done. The dashboard opens and only the enabled modules appear in navigation.

To add users: **Admin → Users** — assign permissions per module.

## Optional: voice transcription (Whisper)

Speech-to-text transcription of Matrix channels via local Whisper AI. No audio leaves your server.

```bash
docker compose up -d whisper-asr
```

Then use **Comms → Transcribe** in the app. Adjust the model in `.env`:

```bash
WHISPER_ASR_MODEL=base.en   # tiny.en / base.en / small.en / medium.en
```

## Access

| URL | Service |
|---|---|
| `http://<ip>:38471` | Crew Hub |
| `http://<ip>:18088` | Synapse Admin |
| `http://<ip>:9000` | Whisper ASR (if running) |

**LAN**: Docker publishes on all interfaces — use the server's LAN IP from any machine on the network.

**Reverse proxy / Cloudflare Tunnel**: point your public hostname at port `38471`. The app proxies `/_matrix` internally so only one public origin is needed.

## Backups

Persistent state is in Docker volumes:

- `crew_hub_data` — all app data (`.data/` directory)
- `synapse-data` — Matrix homeserver data

Back up both volumes, or switch to bind mounts for easier access.

## Updating

```bash
docker compose pull
docker compose up -d
```

Docker pulls the latest image from GHCR. Settings and data are in volumes — they survive updates.
