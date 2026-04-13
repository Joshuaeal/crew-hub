import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { requirePermission } from "@/lib/api-auth";
import { resolveUnderData } from "@/lib/data-path";
import { readPayables } from "@/lib/payables-store";

type Ctx = { params: { id: string } };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  const { id } = ctx.params;
  const rows = await readPayables();
  const row = rows.find((r) => r.id === id);
  if (!row?.attachmentRelativePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const full = resolveUnderData(row.attachmentRelativePath);
  if (!full) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  try {
    const buf = await fs.readFile(full);
    const name = row.attachmentFilename || "attachment";
    const lower = name.toLowerCase();
    const ct = lower.endsWith(".pdf")
      ? "application/pdf"
      : lower.endsWith(".png")
        ? "image/png"
        : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
          ? "image/jpeg"
          : "application/octet-stream";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": ct,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
