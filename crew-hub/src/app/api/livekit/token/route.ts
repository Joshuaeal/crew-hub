import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getSession } from "@/lib/session";
import { readInstanceSettings } from "@/lib/instance-settings-store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { room, identity } = (await req.json()) as { room?: string; identity?: string };
  if (!room) {
    return NextResponse.json({ error: "room is required" }, { status: 400 });
  }

  // Use session identity if signed in, otherwise fall back to the provided name or a guest label
  const [session, settings] = await Promise.all([
    getSession(),
    readInstanceSettings().catch(() => null),
  ]);
  const apiKey = process.env.LIVEKIT_API_KEY ?? "devkey";
  const apiSecret = process.env.LIVEKIT_API_SECRET ?? "secret";
  const participantIdentity =
    identity?.trim() ||
    session?.username ||
    session?.email ||
    `guest-${Math.random().toString(36).slice(2, 7)}`;

  // Latching is available when the admin has enabled it AND the participant has a named identity
  // (logged-in session, or any manually entered display name). Auto-generated guest-XXXXX
  // identities (no name provided at all) stay PTT-only.
  const latchingGloballyEnabled = settings?.radioLatchingEnabled === true;
  const hasNamedIdentity = !!session?.username || !!(identity?.trim());
  const latchingAvailable = latchingGloballyEnabled && hasNamedIdentity;

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: participantIdentity,
    ttl: "8h",
  });

  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, identity: participantIdentity, latchingAvailable });
}
