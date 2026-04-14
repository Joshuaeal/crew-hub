import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { room, identity } = (await req.json()) as { room?: string; identity?: string };
  if (!room) {
    return NextResponse.json({ error: "room is required" }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY ?? "devkey";
  const apiSecret = process.env.LIVEKIT_API_SECRET ?? "secret";
  const participantIdentity = identity ?? session.username ?? session.email ?? "user";

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
  return NextResponse.json({ token, identity: participantIdentity });
}
