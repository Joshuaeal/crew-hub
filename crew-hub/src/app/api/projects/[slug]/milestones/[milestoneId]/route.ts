import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { deleteMilestone, getProjectBySlug, updateMilestone } from "@/lib/projects-store";

type Ctx = { params: { slug: string; milestoneId: string } };

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  let body: {
    title?: string;
    dueDate?: string;
    status?: string;
    sortOrder?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateMilestone>[2] = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.dueDate !== undefined) patch.dueDate = body.dueDate;
  if (body.status === "Pending" || body.status === "Done") patch.status = body.status;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;

  const project = await updateMilestone(ctx.params.slug, ctx.params.milestoneId, patch);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;
  const existing = await getProjectBySlug(ctx.params.slug);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const project = await deleteMilestone(ctx.params.slug, ctx.params.milestoneId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}
