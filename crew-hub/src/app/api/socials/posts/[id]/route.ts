import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { deleteSocialPost, updateSocialPost } from "@/lib/socials-store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAnyPermission(["socials_manage"]);
  if (!gate.ok) return gate.response;

  const { id } = await params;

  let body: { postedAt?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: { postedAt?: string; note?: string | undefined } = {};
  if (typeof body.postedAt === "string") patch.postedAt = body.postedAt.trim();
  if ("note" in body) patch.note = typeof body.note === "string" ? body.note : undefined;

  const post = await updateSocialPost(id, patch);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ post });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAnyPermission(["socials_manage"]);
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const ok = await deleteSocialPost(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
