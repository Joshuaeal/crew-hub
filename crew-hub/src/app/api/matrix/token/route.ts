import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { matrixServerName } from "@/lib/matrix-provision";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const base = process.env.MATRIX_UPSTREAM_URL?.trim();
  const adminToken = process.env.CREW_SYNAPSE_ADMIN_ACCESS_TOKEN?.trim();
  const serverName = matrixServerName();

  if (!base || !adminToken || !serverName) {
    return NextResponse.json({ error: "Matrix provisioning not configured" }, { status: 503 });
  }

  const userId = `@${session.username}:${serverName}`;
  const url = `${base.replace(/\/$/, "")}/_synapse/admin/v1/users/${encodeURIComponent(userId)}/login`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ valid_until_ms: Date.now() + 60_000 }),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Synapse HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch { /* ignore */ }
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { access_token } = await res.json() as { access_token: string };

  // Fetch device_id so Element doesn't create a ghost device on every load
  const whoami = await fetch(
    `${base.replace(/\/$/, "")}/_matrix/client/v3/account/whoami`,
    { headers: { Authorization: `Bearer ${access_token}` } },
  );
  let deviceId: string | undefined;
  if (whoami.ok) {
    const w = await whoami.json() as { device_id?: string };
    deviceId = w.device_id;
  }

  // Use the public crew-hub URL as homeserver since it proxies /_matrix — the internal
  // Docker URL (MATRIX_UPSTREAM_URL) is not reachable from the browser.
  const homeserverUrl =
    process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.trim() ||
    process.env.NEXT_PUBLIC_CREW_PUBLIC_URL?.trim() ||
    base;

  return NextResponse.json({ accessToken: access_token, userId, deviceId, homeserverUrl });
}
