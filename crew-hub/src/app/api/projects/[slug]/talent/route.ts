import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { addTalent, getProjectBySlug } from "@/lib/projects-store";

type Ctx = { params: { slug: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_view", "projects_manage"]);
  if (!gate.ok) return gate.response;
  const project = await getProjectBySlug(ctx.params.slug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ talent: project.talent });
}

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  let body: {
    personId?: string;
    externalName?: string;
    externalContact?: string;
    role?: string;
    rate?: number;
    rateUnit?: string;
    confirmed?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const role = typeof body.role === "string" ? body.role.trim() : "";
  if (!role) return NextResponse.json({ error: "role is required" }, { status: 400 });

  const project = await addTalent(ctx.params.slug, {
    personId: typeof body.personId === "string" ? body.personId : undefined,
    externalName: typeof body.externalName === "string" ? body.externalName : undefined,
    externalContact: typeof body.externalContact === "string" ? body.externalContact : undefined,
    role,
    rate: typeof body.rate === "number" ? body.rate : undefined,
    rateUnit: body.rateUnit === "hourly" || body.rateUnit === "daily" ? body.rateUnit : undefined,
    confirmed: body.confirmed === true,
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}
