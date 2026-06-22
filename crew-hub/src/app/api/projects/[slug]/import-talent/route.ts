import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { addTalent, getProjectBySlug } from "@/lib/projects-store";

type Ctx = { params: { slug: string } };

type TalentRow = {
  personId?: string;
  externalName?: string;
  externalContact?: string;
  role?: string;
  rate?: number;
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

  for (const raw of body.rows as TalentRow[]) {
    const role = typeof raw.role === "string" ? raw.role.trim() : "";
    if (!role) {
      results.push({ ok: false, error: "role is required" });
      continue;
    }

    const personId = typeof raw.personId === "string" && raw.personId ? raw.personId : undefined;
    const externalName =
      !personId && typeof raw.externalName === "string" && raw.externalName
        ? raw.externalName.trim()
        : undefined;

    if (!personId && !externalName) {
      results.push({ ok: false, error: "name is required" });
      continue;
    }

    try {
      await addTalent(ctx.params.slug, {
        personId,
        externalName,
        externalContact:
          typeof raw.externalContact === "string" && raw.externalContact
            ? raw.externalContact.trim()
            : undefined,
        role,
        rate: typeof raw.rate === "number" && isFinite(raw.rate) ? raw.rate : undefined,
        confirmed: false,
      });
      results.push({ ok: true });
    } catch (e) {
      results.push({ ok: false, error: e instanceof Error ? e.message : "Insert failed" });
    }
  }

  return NextResponse.json({ results });
}
