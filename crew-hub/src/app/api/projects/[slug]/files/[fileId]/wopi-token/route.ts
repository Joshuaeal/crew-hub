import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { getProjectBySlug } from "@/lib/projects-store";
import { getProjectFile } from "@/lib/project-files-store";
import { createWopiToken } from "@/lib/wopi-token";
import { readInstanceSettings } from "@/lib/instance-settings-store";

export const dynamic = "force-dynamic";

type Ctx = { params: { slug: string; fileId: string } };

export async function POST(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_view", "projects_manage"]);
  if (!gate.ok) return gate.response;

  const project = await getProjectBySlug(ctx.params.slug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta = await getProjectFile(ctx.params.fileId);
  if (!meta || meta.projectId !== project.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = await readInstanceSettings();
  if (!settings.collaboraUrl)
    return NextResponse.json({ error: "Collabora not configured" }, { status: 503 });

  const token = await createWopiToken(ctx.params.fileId);

  // WOPISrc must be reachable by the Collabora server (not the browser).
  // Use CREW_WOPI_BASE_URL (internal service URL) when set, otherwise fall back to public URL.
  const wopiBase =
    process.env.CREW_WOPI_BASE_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_CREW_PUBLIC_URL?.replace(/\/$/, "") ??
    "http://crew-hub:3000";

  const wopiSrc = `${wopiBase}/api/wopi/files/${ctx.params.fileId}`;

  // Collabora editor URL — browser opens this iframe
  const collaboraBase = settings.collaboraUrl.replace(/\/$/, "");
  const editorUrl = `${collaboraBase}/browser/dist/cool.html?WOPISrc=${encodeURIComponent(wopiSrc)}&access_token=${encodeURIComponent(token)}`;

  return NextResponse.json({ editorUrl, filename: meta.filename });
}
