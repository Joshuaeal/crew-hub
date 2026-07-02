import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, basename } from "path";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";

const PLOTS_DIR = process.env.LIGHTING_PLOTS_DATA_DIR ?? "";

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string; filename: string } }
) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "lighting_plots")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!PLOTS_DIR) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { projectId, filename } = params;
  const safeFilename = basename(decodeURIComponent(filename));
  if (
    !projectId || projectId.includes("/") || projectId.includes("..") ||
    !safeFilename || safeFilename.includes("/") || safeFilename.includes("..")
  ) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const filePath = join(PLOTS_DIR, "projects", projectId, safeFilename);
    const data = await readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
