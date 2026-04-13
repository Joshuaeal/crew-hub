/** Public URLs for embedded service iframes. */
export const serviceUrls = {
  /** synapse-admin UI (not raw Synapse :8008). */
  synapseAdmin: process.env.NEXT_PUBLIC_SERVICE_SYNAPSE_URL ?? "",
  /** Element Web (or another Matrix web client) to embed for Channels. */
  matrixClient:
    process.env.NEXT_PUBLIC_SERVICE_MATRIX_CLIENT_URL?.trim() ||
    "https://app.element.io",
};

function stripPort(host: string): string {
  const h = host.trim();
  if (!h) return "";
  // ipv6 in brackets
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    if (end >= 0) return h.slice(0, end + 1);
    return h;
  }
  // host:port
  const idx = h.lastIndexOf(":");
  if (idx > -1 && /^\d+$/.test(h.slice(idx + 1))) return h.slice(0, idx);
  return h;
}

export function getSynapseAdminUrlFromRequest(
  forwardedHost: string | null,
  forwardedProto: string | null
): string {
  const explicit = (process.env.NEXT_PUBLIC_SERVICE_SYNAPSE_URL ?? "").trim();
  if (explicit) return explicit;
  const host = forwardedHost?.trim();
  if (!host) return "";
  const proto = forwardedProto?.trim() || "http";
  const base = stripPort(host);
  const port = Number.parseInt(process.env.SYNAPSE_ADMIN_PORT ?? "18088", 10) || 18088;
  return `${proto}://${base}:${port}`;
}

/**
 * Synapse base URL reachable from the **Next.js server** (Docker service name, localhost, etc.).
 * When set, `next.config.mjs` rewrites `/_matrix/*` and `/.well-known/matrix/*` to this host so the
 * browser talks to the hub origin only — avoids CORS / mixed-content "fetch failed" on the Matrix client.
 */
export function getMatrixUpstreamUrl(): string | null {
  const u = process.env.MATRIX_UPSTREAM_URL?.trim();
  return u || null;
}

/** True when Matrix requests should use the hub's public origin (proxy), not a cross-origin Synapse URL. */
export function matrixUsesHubProxy(): boolean {
  return Boolean(getMatrixUpstreamUrl());
}

/** Matrix Client-Server API (Synapse). Used when not proxying via the hub. */
export function getMatrixHomeserverUrl() {
  return (
    process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.trim() ||
    "http://localhost:8008"
  );
}

/** Default homeserver base URL for the Comms UI (server-rendered default). */
export function getMatrixClientBaseUrlFromRequest(
  forwardedHost: string | null,
  forwardedProto: string | null,
): string {
  if (matrixUsesHubProxy()) {
    const host = forwardedHost?.trim();
    if (host) {
      const proto = forwardedProto?.trim() || "http";
      return `${proto}://${host}`;
    }
  }
  return getMatrixHomeserverUrl();
}
