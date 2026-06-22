import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { createProjectTemplate, readProjectTemplates } from "@/lib/project-templates-store";
import { PROJECT_CATEGORIES, PROJECT_SERVICE_TYPES, type ProjectCategory, type ProjectServiceType } from "@/types/projects";

export async function GET() {
  const gate = await requireAnyPermission(["projects_view", "projects_manage"]);
  if (!gate.ok) return gate.response;
  const templates = await readProjectTemplates();
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  let body: {
    name?: string;
    description?: string;
    defaultCategory?: string;
    defaultServiceTypes?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const defaultCategory =
    typeof body.defaultCategory === "string" &&
    (PROJECT_CATEGORIES as readonly string[]).includes(body.defaultCategory)
      ? (body.defaultCategory as ProjectCategory)
      : undefined;

  const defaultServiceTypes: ProjectServiceType[] = Array.isArray(body.defaultServiceTypes)
    ? (body.defaultServiceTypes as string[]).filter((s): s is ProjectServiceType =>
        (PROJECT_SERVICE_TYPES as readonly string[]).includes(s)
      )
    : [];

  const template = await createProjectTemplate({
    name,
    description: typeof body.description === "string" ? body.description : undefined,
    defaultCategory,
    defaultServiceTypes,
  });
  return NextResponse.json({ template });
}
