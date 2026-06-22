import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import {
  claimOpenTalentSlot,
  deleteTalent,
  getProjectBySlug,
  updateTalent,
} from "@/lib/projects-store";

type Ctx = { params: { slug: string; talentId: string } };

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_view", "projects_manage"]);
  if (!gate.ok) return gate.response;

  const { session } = gate;
  const canManage =
    session.permissions.includes("projects_manage") || session.permissions.includes("*");

  let body: {
    personId?: string | null;
    externalName?: string | null;
    externalContact?: string | null;
    role?: string;
    rate?: number | null;
    confirmed?: boolean;
    requestStatus?: string;
    claim?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Crew member claiming an open slot
  if (body.claim === true) {
    const result = await claimOpenTalentSlot(
      ctx.params.slug,
      ctx.params.talentId,
      session.userId
    );
    if (result.error || !result.project) {
      return NextResponse.json(
        { error: result.error ?? "Not found" },
        { status: result.error === "Not found" ? 404 : 409 }
      );
    }
    return NextResponse.json({ project: result.project });
  }

  // Crew member responding to a request (accept/decline their own entry)
  if ("requestStatus" in body && !canManage) {
    const project = await getProjectBySlug(ctx.params.slug);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const entry = project.talent.find((t) => t.id === ctx.params.talentId);
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (entry.personId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const status = body.requestStatus;
    if (status !== "accepted" && status !== "declined") {
      return NextResponse.json({ error: "Invalid requestStatus" }, { status: 400 });
    }
    const updated = await updateTalent(ctx.params.slug, ctx.params.talentId, {
      requestStatus: status,
    });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ project: updated });
  }

  // Admin-only fields
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const patch: Parameters<typeof updateTalent>[2] = {};
  if ("personId" in body) patch.personId = body.personId ?? undefined;
  if ("externalName" in body) patch.externalName = body.externalName ?? undefined;
  if ("externalContact" in body) patch.externalContact = body.externalContact ?? undefined;
  if (body.role !== undefined) patch.role = body.role;
  if ("rate" in body) patch.rate = body.rate ?? undefined;
  if (body.confirmed !== undefined) patch.confirmed = body.confirmed;
  if ("requestStatus" in body) {
    const s = body.requestStatus;
    patch.requestStatus =
      s === "pending" || s === "accepted" || s === "declined" ? s : undefined;
  }

  const project = await updateTalent(ctx.params.slug, ctx.params.talentId, patch);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;
  const existing = await getProjectBySlug(ctx.params.slug);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const project = await deleteTalent(ctx.params.slug, ctx.params.talentId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}
