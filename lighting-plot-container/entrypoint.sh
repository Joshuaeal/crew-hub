#!/bin/bash
set -e

# Mount NFS data volume if configured.
# Running inside the container avoids Mac/OrbStack NFS stack limitations.
NFS_ADDR="${PERASTAGE_NFS_ADDR:-}"
NFS_PATH="${PERASTAGE_NFS_PATH:-}"
MOUNT_TARGET=/data/perastage/home

if [ -n "$NFS_ADDR" ] && [ -n "$NFS_PATH" ]; then
  echo "[entrypoint] Mounting NFS ${NFS_ADDR}:${NFS_PATH} → ${MOUNT_TARGET}"
  mkdir -p "$MOUNT_TARGET"
  if mount -t nfs -o "nfsvers=3,nolock,soft,timeo=30,retrans=3,port=2049" \
    "${NFS_ADDR}:${NFS_PATH}" "$MOUNT_TARGET" 2>&1; then
    echo "[entrypoint] NFS mounted OK"
  else
    echo "[entrypoint] WARNING: NFS mount failed — falling back to local storage"
    echo "[entrypoint] Source IP inside container:"
    ip route get "${NFS_ADDR}" 2>/dev/null || true
  fi
else
  echo "[entrypoint] No NFS configured — using local data directory"
  mkdir -p "$MOUNT_TARGET"
fi

exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
