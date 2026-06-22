import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import {
  deleteProjectTemplate,
  getProjectTemplate,
  updateProjectTemplate,
} from "@/lib/project-templates-store";
import { PROJECT_CATEGORIES, PROJECT_SERVICE_TYPES, type ProjectCategory, type ProjectServiceType } from "@/types/projects";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_view", "projects_manage"]);
  if (!gate.ok) return gate.response;
  const template = await getProjectTemplate(ctx.params.id);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  let body: {
    name?: string;
    description?: string | null;
    defaultCategory?: string | null;
    defaultServiceTypes?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateProjectTemplate>[1] = {};
  if (body.name !== undefined) patch.name = body.name;
  if ("description" in body) patch.description = body.description ?? undefined;
  if ("defaultCategory" in body) {
    patch.defaultCategory =
      typeof body.defaultCategory === "string" &&
      (PROJECT_CATEGORIES as readonly string[]).includes(body.defaultCategory)
        ? (body.defaultCategory as ProjectCategory)
        : undefined;
  }
  if (body.defaultServiceTypes !== undefined && Array.isArray(body.defaultServiceTypes)) {
    patch.defaultServiceTypes = (body.defaultServiceTypes as string[]).filter(
      (s): s is ProjectServiceType => (PROJECT_SERVICE_TYPES as readonly string[]).includes(s)
    );
  }

  const template = await updateProjectTemplate(ctx.params.id, patch);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;
  const ok = await deleteProjectTemplate(ctx.params.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
