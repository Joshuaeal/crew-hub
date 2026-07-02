import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";

const PLOTS_DIR = process.env.LIGHTING_PLOTS_DATA_DIR ?? "";
// Internal URL of the perastage open-file-server sidecar (crew_net).
const PERASTAGE_OPEN_URL = process.env.PERASTAGE_OPEN_URL ?? "http://perastage:6081/open";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "lighting_plots")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!PLOTS_DIR) {
    return NextResponse.json({ error: "Lighting plots storage not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as { projectId?: string; filename?: string };
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";

  if (!projectId || projectId.includes("/") || projectId.includes("..") ||
      !filename || filename.includes("/") || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const filePath = join(PLOTS_DIR, "projects", projectId, filename);

  try {
    const r = await fetch(PERASTAGE_OPEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
    });
    const data = await r.json();
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not reach Perastage container" }, { status: 502 });
  }
}
