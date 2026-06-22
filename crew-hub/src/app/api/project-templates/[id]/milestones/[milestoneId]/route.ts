import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import {
  deleteTemplateMilestone,
  getProjectTemplate,
  updateTemplateMilestone,
} from "@/lib/project-templates-store";

type Ctx = { params: { id: string; milestoneId: string } };

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  let body: { title?: string; offsetDaysFromStart?: number; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateTemplateMilestone>[2] = {};
  if (body.title !== undefined) patch.title = body.title;
  if (typeof body.offsetDaysFromStart === "number")
    patch.offsetDaysFromStart = body.offsetDaysFromStart;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;

  const template = await updateTemplateMilestone(ctx.params.id, ctx.params.milestoneId, patch);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;
  const existing = await getProjectTemplate(ctx.params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const template = await deleteTemplateMilestone(ctx.params.id, ctx.params.milestoneId);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template });
}
