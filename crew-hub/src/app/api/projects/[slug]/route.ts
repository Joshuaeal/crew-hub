import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { deleteProject, getProjectBySlug, updateProject } from "@/lib/projects-store";
import { deleteAllProjectFiles } from "@/lib/project-files-store";
import {
  PROJECT_CATEGORIES,
  PROJECT_SERVICE_TYPES,
  PROJECT_STATUSES,
  type ProjectCategory,
  type ProjectServiceType,
  type ProjectStatus,
} from "@/types/projects";

type Ctx = { params: { slug: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_view", "projects_manage"]);
  if (!gate.ok) return gate.response;
  const project = await getProjectBySlug(ctx.params.slug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  let body: {
    name?: string;
    category?: string;
    serviceTypes?: unknown;
    status?: string;
    startDate?: string | null;
    endDate?: string | null;
    clientId?: string | null;
    affineDocUrl?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateProject>[1] = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.category !== undefined && (PROJECT_CATEGORIES as readonly string[]).includes(body.category))
    patch.category = body.category as ProjectCategory;
  if (body.serviceTypes !== undefined && Array.isArray(body.serviceTypes))
    patch.serviceTypes = (body.serviceTypes as string[]).filter((s): s is ProjectServiceType =>
      (PROJECT_SERVICE_TYPES as readonly string[]).includes(s)
    );
  if (body.status !== undefined && (PROJECT_STATUSES as readonly string[]).includes(body.status))
    patch.status = body.status as ProjectStatus;
  if ("startDate" in body) patch.startDate = body.startDate ?? undefined;
  if ("endDate" in body) patch.endDate = body.endDate ?? undefined;
  if ("clientId" in body) patch.clientId = body.clientId ?? undefined;
  if ("affineDocUrl" in body) patch.affineDocUrl = body.affineDocUrl ?? undefined;

  const updated = await updateProject(ctx.params.slug, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;
  const project = await getProjectBySlug(ctx.params.slug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteAllProjectFiles(project.id);
  const ok = await deleteProject(ctx.params.slug);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
