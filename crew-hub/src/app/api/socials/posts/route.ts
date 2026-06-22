import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { createSocialPost, isValidPlatformId, readSocialPosts } from "@/lib/socials-store";

export async function GET() {
  const gate = await requireAnyPermission(["socials_view", "socials_manage"]);
  if (!gate.ok) return gate.response;
  const posts = await readSocialPosts();
  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const gate = await requireAnyPermission(["socials_manage"]);
  if (!gate.ok) return gate.response;

  let body: { platformId?: string; postedAt?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const platformId = typeof body.platformId === "string" ? body.platformId : "";
  if (!isValidPlatformId(platformId))
    return NextResponse.json({ error: "Invalid platformId" }, { status: 400 });

  const postedAt = typeof body.postedAt === "string" ? body.postedAt.trim() : "";
  if (!postedAt) return NextResponse.json({ error: "postedAt is required" }, { status: 400 });

  const post = await createSocialPost({
    platformId,
    postedAt,
    note: typeof body.note === "string" ? body.note : undefined,
    loggedBy: gate.session.email,
  });

  return NextResponse.json({ post });
}
