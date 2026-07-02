import { NextRequest, NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";

const PLOTS_DIR = process.env.LIGHTING_PLOTS_DATA_DIR ?? "";

function projectDir(projectId: string) {
  return join(PLOTS_DIR, "projects", projectId);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "lighting_plots")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!PLOTS_DIR) {
    return NextResponse.json({ files: [] });
  }

  const { projectId } = params;
  if (!projectId || projectId.includes("/") || projectId.includes("..")) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  try {
    const dir = projectDir(projectId);
    const entries = await readdir(dir);
    const files = await Promise.all(
      entries.map(async (name) => {
        const info = await stat(join(dir, name));
        return { name, sizeBytes: info.size, modifiedAt: info.mtime.toISOString() };
      })
    );
    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return NextResponse.json({ files });
  } catch {
    return NextResponse.json({ files: [] });
  }
}


