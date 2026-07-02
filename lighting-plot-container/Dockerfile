# Perastage headless container
# Runs Perastage (wxWidgets/OpenGL lighting plot tool) via Xvfb + x11vnc,
# bridged to a browser over noVNC/websockify on port 6080.
#
# Build: docker build --platform linux/amd64 -t perastage-novnc .
# Run:   see docker-compose.yml
#
# IMPORTANT — Platform note:
# Perastage only ships an x86_64 AppImage. On Apple Silicon (OrbStack),
# build and run with --platform linux/amd64 (Rosetta emulation). 2D/3D
# rendering uses Mesa llvmpipe (software GL), so no GPU required.

FROM --platform=linux/amd64 ubuntu:24.04

ARG PERASTAGE_VERSION=1.4.0
ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:1 \
    LIBGL_ALWAYS_SOFTWARE=1 \
    MESA_GL_VERSION_OVERRIDE=4.5 \
    XDG_RUNTIME_DIR=/tmp/xdg-runtime \
    HOME=/data/perastage/home

# --- System packages ---
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Virtual display
    xvfb \
    # VNC server
    x11vnc \
    # noVNC + websocket bridge
    novnc \
    websockify \
    # Process supervisor
    supervisor \
    # Mesa software OpenGL (llvmpipe — runs headless, no GPU)
    libgl1-mesa-dri \
    libegl1 \
    libegl-mesa0 \
    libglu1-mesa \
    # GTK3 / X11 runtime (wxWidgets backend for Perastage)
    libgtk-3-0 \
    libgdk-pixbuf-2.0-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libglib2.0-0 \
    # X11 client libs
    libx11-6 \
    libxext6 \
    libxrender1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    libxkbcommon0 \
    libxkbcommon-x11-0 \
    # XCB libs (xcb-based GL + input)
    libxcb1 \
    libxcb-glx0 \
    libxcb-icccm4 \
    libxcb-image0 \
    libxcb-keysyms1 \
    libxcb-randr0 \
    libxcb-render0 \
    libxcb-render-util0 \
    libxcb-shape0 \
    libxcb-shm0 \
    libxcb-xfixes0 \
    libxcb-xinerama0 \
    libxcb-xkb1 \
    libxcb-cursor0 \
    # Font support (wxWidgets needs fontconfig)
    fontconfig \
    libfreetype6 \
    fonts-dejavu-core \
    # Kiosk window manager — auto-maximizes the single app window to fill the display
    matchbox-window-manager \
    # NFS client — container mounts NFS itself at startup (no host-level mount needed)
    nfs-common \
    # Misc runtime
    libcurl4 \
    libssl3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# --- Download and extract Perastage AppImage ---
# --appimage-extract unpacks the squashfs without FUSE (works inside Docker).
RUN curl -fsSL \
    "https://github.com/PeramatoG/Perastage/releases/download/v${PERASTAGE_VERSION}/Perastage-${PERASTAGE_VERSION}-x86_64.AppImage" \
    -o /tmp/Perastage.AppImage \
    && chmod +x /tmp/Perastage.AppImage \
    && cd /tmp && /tmp/Perastage.AppImage --appimage-extract \
    && mv /tmp/squashfs-root /opt/perastage \
    && rm /tmp/Perastage.AppImage

# --- Data directories ---
# /data/perastage/home is the container user's HOME; Perastage writes its
# config, GDTF library, and project files under XDG paths within it.
# Mount a named volume here to persist data across container restarts.
RUN mkdir -p /data/perastage/home /tmp/xdg-runtime \
    && chmod 700 /tmp/xdg-runtime

COPY supervisord.conf /etc/supervisor/conf.d/perastage.conf
COPY entrypoint.sh /opt/entrypoint.sh
COPY perastage-wrapper.sh /opt/perastage-wrapper.sh
COPY open-file-server.py /opt/open-file-server.py
RUN chmod +x /opt/entrypoint.sh /opt/perastage-wrapper.sh

# noVNC browser UI is served by websockify at :6080
# open-file-server listens on :6081 (internal, crew_net only)
EXPOSE 6080 6081

ENTRYPOINT ["/opt/entrypoint.sh"]
