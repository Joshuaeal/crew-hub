import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { addMilestone, getProjectBySlug } from "@/lib/projects-store";

type Ctx = { params: { slug: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_view", "projects_manage"]);
  if (!gate.ok) return gate.response;
  const project = await getProjectBySlug(ctx.params.slug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ milestones: project.milestones });
}

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  let body: { title?: string; dueDate?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  const dueDate = typeof body.dueDate === "string" ? body.dueDate : "";
  if (!dueDate) return NextResponse.json({ error: "dueDate is required" }, { status: 400 });

  const project = await addMilestone(ctx.params.slug, { title, dueDate });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}
