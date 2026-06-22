import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { deleteLineItem, getProjectBySlug, updateLineItem } from "@/lib/projects-store";

type Ctx = { params: { slug: string; itemId: string } };

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  let body: {
    catalogItemId?: string | null;
    description?: string;
    quantity?: number;
    unitPrice?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateLineItem>[2] = {};
  if ("catalogItemId" in body) patch.catalogItemId = body.catalogItemId ?? undefined;
  if (body.description !== undefined) patch.description = body.description;
  if (body.quantity !== undefined) patch.quantity = body.quantity;
  if (body.unitPrice !== undefined) patch.unitPrice = body.unitPrice;

  const project = await updateLineItem(ctx.params.slug, ctx.params.itemId, patch);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;
  const existing = await getProjectBySlug(ctx.params.slug);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const project = await deleteLineItem(ctx.params.slug, ctx.params.itemId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}
