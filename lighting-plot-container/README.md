# Lighting Plot Container

Self-hosted [Perastage](https://github.com/PeramatoG/Perastage) running headless inside a Linux container, exposed to a browser via noVNC over WebSocket.

## How it works

```
Perastage (wxWidgets/OpenGL)
    └── draws to Xvfb virtual display :1
            └── x11vnc reads the framebuffer → VNC on localhost:5900
                    └── websockify bridges VNC → WebSocket on 0.0.0.0:6080
                            └── noVNC (vnc.html) served at :6080 → Crew Hub iframe
```

Mesa llvmpipe provides software OpenGL — no GPU or display hardware required.

## Prerequisites

- Docker with Compose v2
- OrbStack (or Docker Desktop) on Apple Silicon

> **Platform note:** Perastage ships only an `x86_64` AppImage. The container runs under Rosetta 2 emulation via `--platform linux/amd64`. This works fine for 2D/3D lighting-plot work; performance is adequate.

## Quick start

```bash
# From repo root
cd lighting-plot-container

# Build the image (~350 MB once layers are cached)
docker compose build

# Start in background
docker compose up -d

# Open in browser to verify before wiring into Crew Hub
open "http://localhost:6080/vnc.html?autoconnect=true&resize=scale"
```

The noVNC session runs entirely inside the container and the virtual display. It never touches the Mac's physical display, WindowServer, or active desktop session.

## Crew Hub integration

Once the container is running, add the noVNC URL in Crew Hub's instance settings (`Setup → Instance → Lighting Plots URL`):

```
http://localhost:6080
```

The Lighting Plots module (`/lighting-plots`) will embed the noVNC client in a full-panel iframe. Users with the `lighting_plots` permission will see it in the sidebar.

## Data persistence

All Perastage user data (GDTF fixture library, MVR project files, preferences) is stored inside the `perastage_home` named volume under `/data/perastage/home`. This volume persists across container restarts and image upgrades.

To back up or export:

```bash
docker run --rm \
  -v perastage_home:/data \
  -v "$(pwd)":/backup \
  ubuntu \
  tar czf /backup/perastage-home-backup.tar.gz -C /data .
```

To restore:

```bash
docker run --rm \
  -v perastage_home:/data \
  -v "$(pwd)":/backup \
  ubuntu \
  tar xzf /backup/perastage-home-backup.tar.gz -C /data
```

## Updating Perastage

Change `PERASTAGE_VERSION` in the `Dockerfile` build arg, then rebuild:

```bash
docker compose build --no-cache
docker compose up -d
```

The named volume is preserved; only the application binary changes.

## Process management

All four processes (Xvfb, Perastage, x11vnc, websockify) run under supervisord with `autorestart=true`. If any process crashes, supervisord restarts it automatically. View logs:

```bash
docker exec perastage supervisorctl status
docker exec perastage tail -f /var/log/supervisor/perastage.log
```

## Troubleshooting

**Blank / black screen in noVNC:** Perastage may still be starting. Wait 5–10 seconds and reload.

**OpenGL errors in perastage.log:** Confirm `LIBGL_ALWAYS_SOFTWARE=1` is set and Mesa is installed (`docker exec perastage glxinfo | grep renderer` should show `llvmpipe`).

**AppImage extraction fails:** The `--appimage-extract` step requires the AppImage to be executable and runs the bundled `unsquashfs` without FUSE. If it fails, check that the download completed (`curl` exit code).

---

## GPL-3.0 notice

Perastage is licensed under the GNU General Public License v3.0. This container **runs Perastage unmodified as a separate process** — it does not link against, bundle, or distribute the Perastage source code. Under GPL-3.0, using a program as an unmodified service (SaaS / internal tool) does not trigger the copyleft obligation for the surrounding application.

**However**, if you ever:
- Distribute this Docker image (or any image containing the Perastage binary) to third parties, or
- Modify Perastage's source code,

you must comply with GPL-3.0: provide the corresponding source code and license notice alongside the binary. Crew Hub itself is not affected by Perastage's license.

For client-facing deployments, confirm the above with your legal team. The safest approach is always to keep the container internal (behind your firewall / VPN) rather than exposing it publicly.

See [LICENSE.txt](https://github.com/PeramatoG/Perastage/blob/main/LICENSE.txt) and [THIRD_PARTY_LICENSES.md](https://github.com/PeramatoG/Perastage/blob/main/THIRD_PARTY_LICENSES.md) in the Perastage repo.
