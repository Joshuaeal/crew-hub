# Crew Hub

Self-hosted team workspace. Deploy it for a company, tick which features they need, and hand it over.

## Modules

Enable or disable any of these per-instance from the setup wizard:

| Module | What it includes |
|---|---|
| **Invoicing & Billing** | Invoices, quotes, clients, catalog, payables |
| **Inventory** | Stock management, checkout, jobs, approval workflows |
| **Shifts & Scheduling** | Shift list, schedule calendar, crew management |
| **HR** | Staff directory, leave requests, HR document storage |
| **Communications** | Matrix channels, VDO.Ninja production video, live transcription (Whisper) |
| **Subcontractor Portal** | Separate login, invoice PDF intake, production video access |

Disabled modules are hidden from navigation. Users still need the relevant permission assigned — enabling a module makes it available, not automatic.

---

## Quick start (Docker)

```bash
git clone <this-repo>
cd <repo>
cp .env.example .env
# Edit .env — set CREW_SESSION_SECRET at minimum
docker compose up -d --build
```

Open `http://<your-server-ip>:38471`.

On first login, create an administrator account. You will be taken directly to the **setup wizard** where you can:

1. **Choose modules** — tick only what this company needs
2. **Set company name and branding** — logo, brand colour, accent colour
3. **Configure service URLs** — Matrix homeserver, Synapse admin, VDO.Ninja
4. **Set billing defaults** — sender block, invoice number format, email sender
5. **Complete setup** — saves everything and opens the dashboard

All of this can be changed later at **Admin → Instance settings**.

---

## Key environment variables

```bash
# Required
CREW_SESSION_SECRET=long-random-secret

# Matrix / Synapse (used inside Docker — do not use 127.0.0.1)
MATRIX_UPSTREAM_URL=http://synapse:8008
SYNAPSE_SERVER_NAME=your-domain.com

# Whisper ASR (speech-to-text transcription, optional)
# WHISPER_ASR_URL=http://whisper-asr:9000
# WHISPER_ASR_MODEL=base.en
```

See `.env.example` for the full list.

---

## Services (Docker Compose)

| Service | Default port | Purpose |
|---|---|---|
| `crew-hub` | 38471 | Main web app (Next.js) |
| `synapse` | 8008 | Matrix homeserver |
| `synapse-admin` | 18088 | Synapse admin UI |
| `whisper-asr` | 9000 | Speech-to-text (optional) |

To start Whisper transcription: `docker compose up -d whisper-asr`

---

## Setting up for a new company

1. Clone / fork this repo
2. `cp .env.example .env` and set `CREW_SESSION_SECRET` + `SYNAPSE_SERVER_NAME`
3. `docker compose up -d --build`
4. Open the app, create admin account
5. Go through the setup wizard — enable the modules they need, set their branding
6. Click **Complete setup →**
7. Create user accounts via **Admin → Users**, assign permissions per module

---

## User permissions

Each module is gated by a permission key:

| Module | Permission |
|---|---|
| Billing | `billing` |
| Inventory | `inventory` / `inventory_request` |
| Shifts | `shifts` / `shifts_manage` |
| HR | `hr` / `hr_manage` |
| Comms | `comms` |
| Subcontractor portal | `invoices_subcontractor` |
| Admin panel | `users_manage` / `shifts_manage` |

Assign these in **Admin → Users**.

---

## Local development (without Docker)

```bash
cd crew-hub
cp .env.example .env.local
npm install
npm run dev
```

Requires Node.js 18.17+. The Docker setup uses Node 20.

### Password hashes

```bash
node -e "require('bcryptjs').hash('your-password', 10).then(console.log)"
```

Use single-quoted hashes in `.env` when pasting into Docker Compose.

### Platform mismatch (`esbuild`)

If `npm run` fails with a Linux vs macOS esbuild error (common after copying from Docker):

```bash
rm -rf node_modules && npm ci
```

Always run `npm install` on the machine where you execute Node.
