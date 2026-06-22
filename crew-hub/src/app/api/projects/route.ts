import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { createProject, readProjects } from "@/lib/projects-store";
import { getProjectTemplate } from "@/lib/project-templates-store";
import {
  PROJECT_CATEGORIES,
  PROJECT_SERVICE_TYPES,
  PROJECT_STATUSES,
  type ProjectCategory,
  type ProjectMilestone,
  type ProjectServiceType,
  type ProjectStatus,
} from "@/types/projects";

export async function GET() {
  const gate = await requireAnyPermission(["projects_view", "projects_manage"]);
  if (!gate.ok) return gate.response;
  const projects = await readProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  let body: {
    name?: string;
    category?: string;
    serviceTypes?: unknown;
    status?: string;
    startDate?: string;
    endDate?: string;
    clientId?: string;
    templateId?: string;
    milestones?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const category = (PROJECT_CATEGORIES as readonly string[]).includes(body.category ?? "")
    ? (body.category as ProjectCategory)
    : "Rent";

  const serviceTypes: ProjectServiceType[] = Array.isArray(body.serviceTypes)
    ? (body.serviceTypes as string[]).filter((s): s is ProjectServiceType =>
        (PROJECT_SERVICE_TYPES as readonly string[]).includes(s)
      )
    : [];

  const status: ProjectStatus = (PROJECT_STATUSES as readonly string[]).includes(body.status ?? "")
    ? (body.status as ProjectStatus)
    : "Draft";

  const templateId =
    typeof body.templateId === "string" && body.templateId.trim()
      ? body.templateId.trim()
      : undefined;

  let milestones: ProjectMilestone[] = [];
  if (Array.isArray(body.milestones) && body.milestones.length > 0) {
    milestones = (body.milestones as Array<{ title?: string; dueDate?: string; isTemplateDefault?: boolean }>)
      .filter((m) => typeof m.title === "string" && m.title.trim() && typeof m.dueDate === "string" && m.dueDate)
      .map((m, idx) => ({
        id: crypto.randomUUID(),
        title: (m.title as string).trim(),
        dueDate: m.dueDate as string,
        status: "Pending" as const,
        isTemplateDefault: m.isTemplateDefault === true,
        sortOrder: idx,
      }));
  } else if (templateId) {
    const tmpl = await getProjectTemplate(templateId);
    if (tmpl && body.startDate) {
      const start = new Date(body.startDate);
      milestones = tmpl.milestones
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((tm, idx) => {
          const due = new Date(start);
          due.setDate(due.getDate() + tm.offsetDaysFromStart);
          const m: ProjectMilestone = {
            id: crypto.randomUUID(),
            title: tm.title,
            dueDate: due.toISOString().slice(0, 10),
            status: "Pending",
            isTemplateDefault: true,
            sortOrder: idx,
          };
          return m;
        });
    }
  }

  const project = await createProject({
    name,
    category,
    serviceTypes,
    status,
    startDate: typeof body.startDate === "string" ? body.startDate : undefined,
    endDate: typeof body.endDate === "string" ? body.endDate : undefined,
    clientId: typeof body.clientId === "string" ? body.clientId : undefined,
    templateId,
    createdByEmail: gate.session.email,
    milestones,
  });

  return NextResponse.json({ project });
}
