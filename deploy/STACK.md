# Swarm / Stack deployment

This project can run as a **single Docker Stack** (Swarm-ready) via `deploy/stack.yml`.

## Shared storage requirement (NFS)

Swarm nodes must be able to mount the same NFS export. This stack uses **NFS-backed Docker volumes**
(so tasks can float without relying on host bind mounts).

Defaults (override in `.env`):

- `CREW_NFS_ADDR=avmacedon`
- `CREW_NFS_EXPORT_ROOT=/export/srv/config`
- `CREW_HUB_PORT=38471`
- `SYNAPSE_PORT=8008`
- `SYNAPSE_ADMIN_PORT=18088`

This stack currently mounts the NFS export using **NFSv3** options (matches common NAS exports).

Make sure the export contains these directories on the NFS server:

```bash
sudo mkdir -p /export/srv/config/crew/crew-fresh/crew-hub-data
sudo mkdir -p /export/srv/config/crew/crew-fresh/synapse
```

## 1) Enable Swarm (once per server)

```bash
docker swarm init
```

## 2) Build & publish the `crew-hub` image

Swarm services require an **image** available to the swarm nodes.

### Option A (recommended): push to a registry

From your workstation or CI:

```bash
cd /path/to/Crew/crew-hub
docker build -t your-registry.example.com/crew/crew-hub:latest .
docker push your-registry.example.com/crew/crew-hub:latest
```

Then set:

```bash
export CREW_HUB_IMAGE=your-registry.example.com/crew/crew-hub
export CREW_HUB_TAG=latest
```

### Option B (single-node swarm): build locally on the server

If your swarm is **one machine**, you can build on that machine and use a local image name:

```bash
cd /path/to/Crew/crew-hub
docker build -t crew/crew-hub:latest .
```

## 3) Configure environment

Create a `.env` next to your stack deploy command (or export vars in your shell). Minimum:

- `CREW_SESSION_SECRET` (16+ chars)
- `SYNAPSE_SERVER_NAME` and `CREW_SYNAPSE_SERVER_NAME` (usually the same)

Optional (email sending):

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

## 4) First-time Synapse config

Synapse writes config under the `synapse_data` volume. On first start it will bootstrap `/data`.
If you need to generate a homeserver config manually, do it on the host before stack deploy, or use the Synapse container tooling.

## 5) Deploy the stack

From repo root:

```bash
docker stack deploy -c deploy/stack.yml crew
```

## 6) Useful commands

```bash
docker stack ps crew
docker service logs -f crew_crew-hub
docker service logs -f crew_synapse
```

