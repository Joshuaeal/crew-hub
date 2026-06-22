import { getSession } from "@/lib/session";
import { matrixProvisioningEnabled, matrixServerName } from "@/lib/matrix-provision";
import { getMatrixClientBaseUrlFromRequest } from "@/lib/service-urls";
import { headers } from "next/headers";
import { CommsApp } from "@/components/CommsApp";

async function fetchMatrixToken(username: string): Promise<{
  accessToken: string;
  deviceId?: string;
} | null> {
  const base = process.env.MATRIX_UPSTREAM_URL?.trim();
  const adminToken = process.env.CREW_SYNAPSE_ADMIN_ACCESS_TOKEN?.trim();
  const serverName = matrixServerName();
  if (!base || !adminToken || !serverName) return null;

  const apiBase = base.replace(/\/$/, "");
  const userId = `@${username}:${serverName}`;

  async function getToken(): Promise<string | null> {
    const res = await fetch(
      `${apiBase}/_synapse/admin/v1/users/${encodeURIComponent(userId)}/login`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ valid_until_ms: Date.now() + 60_000 }),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const { access_token } = await res.json() as { access_token: string };
    return access_token;
  }

  try {
    let accessToken = await getToken();

    // User doesn't exist in Synapse yet — provision them with a random password
    // (they'll always auto-login via admin impersonation, never need to type it)
    if (!accessToken) {
      const randomPassword = crypto.randomUUID() + crypto.randomUUID();
      await fetch(
        `${apiBase}/_synapse/admin/v2/users/${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ password: randomPassword, deactivated: false, locked: false }),
          cache: "no-store",
        },
      );
      accessToken = await getToken();
    }

    if (!accessToken) return null;

    let deviceId: string | undefined;
    const whoami = await fetch(
      `${apiBase}/_matrix/client/v3/account/whoami`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
    );
    if (whoami.ok) {
      const w = await whoami.json() as { device_id?: string };
      deviceId = w.device_id;
    }
    return { accessToken, deviceId };
  } catch {
    return null;
  }
}

export default async function CommsPage() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() || "http";

  const serverName = matrixServerName();
  const homeserver = getMatrixClientBaseUrlFromRequest(host ?? null, proto);

  const session = await getSession();
  const autoAuth =
    session && matrixProvisioningEnabled()
      ? await fetchMatrixToken(session.username)
      : null;

  const initialAuth = autoAuth && session
    ? {
        accessToken: autoAuth.accessToken,
        userId: `@${session.username}:${serverName}`,
        deviceId: autoAuth.deviceId,
        homeserverUrl: homeserver,
      }
    : undefined;

  return (
    <CommsApp
      defaultHomeserver={homeserver}
      matrixDomain={serverName}
      matrixSyncEnabled={matrixProvisioningEnabled()}
      matrixUsesHubProxy={Boolean(process.env.MATRIX_UPSTREAM_URL?.trim())}
      preferredRoomId={process.env.CREW_MATRIX_DEFAULT_ROOM_ID?.trim() || undefined}
      initialAuth={initialAuth}
    />
  );
}
