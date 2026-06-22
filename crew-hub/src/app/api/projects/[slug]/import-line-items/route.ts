import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { addLineItem, getProjectBySlug } from "@/lib/projects-store";

type Ctx = { params: { slug: string } };

type LineItemRow = {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  catalogItemId?: string;
};

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  const project = await getProjectBySlug(ctx.params.slug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { rows?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "rows must be a non-empty array" }, { status: 400 });
  }

  const results: { ok: boolean; error?: string }[] = [];

  for (const raw of body.rows as LineItemRow[]) {
    const description =
      typeof raw.description === "string" ? raw.description.trim() : "";
    if (!description) {
      results.push({ ok: false, error: "description is required" });
      continue;
    }

    const quantity =
      typeof raw.quantity === "number" && isFinite(raw.quantity) ? raw.quantity : NaN;
    if (isNaN(quantity)) {
      results.push({ ok: false, error: "quantity must be a number" });
      continue;
    }

    const unitPrice =
      typeof raw.unitPrice === "number" && isFinite(raw.unitPrice) ? raw.unitPrice : NaN;
    if (isNaN(unitPrice)) {
      results.push({ ok: false, error: "unitPrice must be a number" });
      continue;
    }

    try {
      await addLineItem(ctx.params.slug, {
        description,
        quantity,
        unitPrice,
        catalogItemId:
          typeof raw.catalogItemId === "string" && raw.catalogItemId
            ? raw.catalogItemId
            : undefined,
      });
      results.push({ ok: true });
    } catch (e) {
      results.push({ ok: false, error: e instanceof Error ? e.message : "Insert failed" });
    }
  }

  return NextResponse.json({ results });
}
