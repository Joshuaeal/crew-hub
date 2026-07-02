import { NextRequest, NextResponse } from "next/server";
import { mkdir, readdir, symlink, unlink } from "fs/promises";
import { join } from "path";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";

// Root of the plots NFS share inside the crew-hub container.
// Mount the same NFS volume that the perastage container mounts.
// On avmacedon: /export/srv/crew/{instance}/plots
// In crew-hub container: /app/.plots (set via LIGHTING_PLOTS_DATA_DIR)
const PLOTS_DIR = process.env.LIGHTING_PLOTS_DATA_DIR ?? "";

function projectsDir() {
  return join(PLOTS_DIR, "projects");
}

export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "lighting_plots")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!PLOTS_DIR) {
    return NextResponse.json({ plotsByProjectId: {}, configured: false });
  }

  try {
    const dir = projectsDir();
    let entries: string[] = [];
    try {
      entries = await readdir(dir);
    } catch {
      // projects/ folder doesn't exist yet — that's fine
    }

    const plotsByProjectId: Record<string, { mvrCount: number }> = {};
    await Promise.all(
      entries.map(async (projectId) => {
        try {
          const files = await readdir(join(dir, projectId));
          const mvrCount = files.filter((f) => f.toLowerCase().endsWith(".mvr")).length;
          plotsByProjectId[projectId] = { mvrCount };
        } catch {
          // ignore unreadable subdirs
        }
      })
    );

    return NextResponse.json({ plotsByProjectId, configured: true });
  } catch {
    return NextResponse.json({ plotsByProjectId: {}, configured: true });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "lighting_plots")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!PLOTS_DIR) {
    return NextResponse.json({ error: "Lighting plots storage not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  if (!projectId || projectId.includes("/") || projectId.includes("..")) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  const folderPath = join(projectsDir(), projectId);
  await mkdir(folderPath, { recursive: true });

  // Create/update a symlink {sanitised-name} → {projectId} so Perastage
  // shows a human-readable folder name alongside the UUID folder.
  const rawName = typeof body.projectName === "string" ? body.projectName.trim() : "";
  if (rawName) {
    const safeName = rawName.replace(/[/\\:*?"<>|]/g, "_").slice(0, 100);
    const linkPath = join(projectsDir(), safeName);
    try {
      await unlink(linkPath);
    } catch {
      // doesn't exist yet — that's fine
    }
    await symlink(projectId, linkPath).catch(() => {
      // symlink creation is best-effort; don't fail the request
    });
  }

  return NextResponse.json({ ok: true, path: `projects/${projectId}` });
}
