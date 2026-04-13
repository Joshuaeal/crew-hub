/**
 * Provision / update Matrix (Synapse) accounts when Crew Hub users are managed.
 * Uses Synapse Admin API — works when public registration is disabled.
 *
 * Requires:
 * - MATRIX_UPSTREAM_URL — base URL the Next.js server can reach (e.g. http://synapse:8008)
 * - CREW_SYNAPSE_SERVER_NAME — same as Synapse server_name (MXID domain), e.g. localhost
 * - CREW_SYNAPSE_ADMIN_ACCESS_TOKEN — access token of a Synapse server admin (Element → Settings → Help → Access token)
 */

function synapseBaseUrl(): string | null {
  const u = process.env.MATRIX_UPSTREAM_URL?.trim();
  return u || null;
}

export function matrixServerName(): string {
  return (
    process.env.CREW_SYNAPSE_SERVER_NAME?.trim() ||
    process.env.SYNAPSE_SERVER_NAME?.trim() ||
    ""
  );
}

function adminAccessToken(): string | null {
  const t = process.env.CREW_SYNAPSE_ADMIN_ACCESS_TOKEN?.trim();
  return t || null;
}

/**
 * True when Matrix user provisioning is configured.
 *
 * Default: enabled when Synapse Admin API env is present.
 * Override:
 * - CREW_MATRIX_SYNC_ENABLED=0 disables provisioning even if env is set.
 * - CREW_MATRIX_SYNC_ENABLED=1 forces enabled (still requires env).
 */
export function matrixProvisioningEnabled(): boolean {
  const override = process.env.CREW_MATRIX_SYNC_ENABLED?.trim();
  if (override === "0") return false;
  const configured = Boolean(synapseBaseUrl() && adminAccessToken() && matrixServerName());
  if (override === "1") return configured;
  return configured;
}

export type UpsertMatrixUserOptions = {
  localpart: string;
  password: string;
  /** Shown as Matrix display name when set. */
  displayName?: string;
  /** When true, invalidates other Matrix sessions after password change (default false for new users). */
  logoutDevices?: boolean;
};

/**
 * Create or update a Synapse user so they can sign in to Element with the same localpart + password.
 * Crew usernames are already restricted to [a-z0-9_] — valid Matrix localparts.
 */
export async function upsertMatrixUser(
  opts: UpsertMatrixUserOptions,
): Promise<void> {
  const base = synapseBaseUrl();
  const token = adminAccessToken();
  const serverName = matrixServerName();
  if (!base || !token || !serverName) {
    throw new Error(
      "Matrix provisioning is not configured (set MATRIX_UPSTREAM_URL, CREW_SYNAPSE_SERVER_NAME, CREW_SYNAPSE_ADMIN_ACCESS_TOKEN)",
    );
  }

  const lp = opts.localpart.trim().toLowerCase();
  if (!lp) throw new Error("Invalid Matrix localpart");

  const userId = `@${lp}:${serverName}`;
  const url = `${base.replace(/\/$/, "")}/_synapse/admin/v2/users/${encodeURIComponent(userId)}`;

  const body: Record<string, unknown> = {
    password: opts.password,
    logout_devices: opts.logoutDevices === true,
    deactivated: false,
    locked: false,
  };
  if (opts.displayName?.trim()) {
    body.displayname = opts.displayName.trim().slice(0, 256);
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Synapse HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { error?: string; errcode?: string };
      if (typeof j.error === "string" && j.error) msg = j.error;
    } catch {
      if (text) msg = text.slice(0, 300);
    }
    throw new Error(msg);
  }
}

/**
 * Remove Matrix account after Crew user is removed (Synapse Admin API DELETE).
 * Best-effort — ignores errors (e.g. user never provisioned).
 */
export async function deleteMatrixUser(localpart: string): Promise<void> {
  const base = synapseBaseUrl();
  const token = adminAccessToken();
  const serverName = matrixServerName();
  if (!base || !token || !serverName) return;

  const lp = localpart.trim().toLowerCase();
  if (!lp) return;

  const userId = `@${lp}:${serverName}`;
  const url = `${base.replace(/\/$/, "")}/_synapse/admin/v2/users/${encodeURIComponent(userId)}`;

  await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
