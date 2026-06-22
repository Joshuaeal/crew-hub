import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import {
  addTemplateMilestone,
  getProjectTemplate,
  replaceTemplateMilestones,
} from "@/lib/project-templates-store";
import type { ProjectTemplateMilestone } from "@/types/projects";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_view", "projects_manage"]);
  if (!gate.ok) return gate.response;
  const template = await getProjectTemplate(ctx.params.id);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ milestones: template.milestones });
}

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  let body: { title?: string; offsetDaysFromStart?: number; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  const offset = typeof body.offsetDaysFromStart === "number" ? body.offsetDaysFromStart : 0;

  const template = await addTemplateMilestone(ctx.params.id, {
    title,
    offsetDaysFromStart: offset,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
  });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template });
}

/** PUT replaces the full milestone list (for reordering) */
export async function PUT(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  let body: { milestones?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.milestones)) {
    return NextResponse.json({ error: "milestones array required" }, { status: 400 });
  }

  const milestones = body.milestones as ProjectTemplateMilestone[];
  const template = await replaceTemplateMilestones(ctx.params.id, milestones);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template });
}
