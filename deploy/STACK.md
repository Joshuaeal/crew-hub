# Swarm / Stack deployment

This project can run as a **Docker Stack** (Swarm-ready) via `deploy/stack.yml`.

## Prerequisites

- Docker Swarm initialised (`docker swarm init`)
- Shared storage accessible from all swarm nodes (NFS recommended — see below)

## 1) Get the image

### Option A (recommended): pull from GHCR

The official image is published automatically on every push to `main`:

```bash
ghcr.io/joshuaeal/crew-hub:latest
```

No build step needed. The stack file uses this image by default.

### Option B: build locally (single-node swarm)

```bash
cd crew-hub
docker build -t crew/crew-hub:latest .
export CREW_HUB_IMAGE=crew/crew-hub
export CREW_HUB_TAG=latest
```

## 2) Configure environment

Create a `.env` file next to your deploy command (or export vars in your shell).

**Required:**

```bash
CREW_SESSION_SECRET=long-random-secret-here
SYNAPSE_SERVER_NAME=your-domain.com
```

**NFS shared storage** (required for multi-node swarm):

```bash
CREW_NFS_ADDR=your-nfs-server          # hostname or IP of NFS server
CREW_NFS_EXPORT_ROOT=/export/srv/data  # root path of NFS export
CREW_INSTANCE_ID=crew                  # sub-directory name for this instance
```

Ensure these directories exist on the NFS server before deploying:

```bash
sudo mkdir -p /your/nfs/export/crew/crew-hub-data
sudo mkdir -p /your/nfs/export/crew/synapse
```

**Optional:**

```bash
CREW_HUB_PORT=38471
SYNAPSE_PORT=8008
SYNAPSE_ADMIN_PORT=18088
WHISPER_ASR_PORT=9000
WHISPER_ASR_MODEL=base.en    # tiny.en / base.en / small.en / medium.en

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

NEXT_PUBLIC_CREW_PUBLIC_URL=https://your-domain.com
```

## 3) Deploy the stack

```bash
docker stack deploy -c deploy/stack.yml crew
```

## 4) First-run setup

1. Open `http://<any-node-ip>:38471`
2. Create the first admin account (`/login`)
3. The setup wizard opens automatically — choose modules, set branding, complete setup

## 5) Whisper ASR (optional)

The `whisper-asr` service is included in `stack.yml` but has `replicas: 0` by default. To enable:

```bash
docker service scale crew_whisper-asr=1
```

Or set `WHISPER_ASR_REPLICAS=1` before deploy and redeploy.

## 6) Useful commands

```bash
docker stack ps crew
docker service logs -f crew_crew-hub
docker service logs -f crew_synapse
docker service logs -f crew_whisper-asr
docker stack rm crew
```

## 7) Updating

Pull the new image and redeploy:

```bash
docker stack deploy -c deploy/stack.yml crew
```

Swarm will perform a rolling update (`start-first` order) with no downtime.
