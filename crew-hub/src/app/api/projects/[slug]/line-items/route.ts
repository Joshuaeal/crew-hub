import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { addLineItem, getProjectBySlug } from "@/lib/projects-store";

type Ctx = { params: { slug: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_view", "projects_manage"]);
  if (!gate.ok) return gate.response;
  const project = await getProjectBySlug(ctx.params.slug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lineItems: project.lineItems });
}

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  let body: {
    catalogItemId?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) return NextResponse.json({ error: "description is required" }, { status: 400 });

  const quantity = typeof body.quantity === "number" && body.quantity > 0 ? body.quantity : 1;
  const unitPrice = typeof body.unitPrice === "number" ? body.unitPrice : 0;

  const project = await addLineItem(ctx.params.slug, {
    catalogItemId: typeof body.catalogItemId === "string" ? body.catalogItemId : undefined,
    description,
    quantity,
    unitPrice,
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}
