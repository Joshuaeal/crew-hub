import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { getSession } from "@/lib/session";
import { resolveUnderData } from "@/lib/data-path";
import { getInvoiceById } from "@/lib/invoices-store";
import { hasPermission } from "@/types/permissions";

type Ctx = { params: { id: string } };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session?.email || !hasPermission(session.permissions, "invoices_subcontractor")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = ctx.params;
  const inv = await getInvoiceById(id);
  if (!inv || inv.subcontractorEmail.toLowerCase() !== session.email.toLowerCase()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!inv.attachmentRelativePath) {
    return NextResponse.json({ error: "No attachment" }, { status: 404 });
  }

  const full = resolveUnderData(inv.attachmentRelativePath);
  if (!full) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  try {
    const buf = await fs.readFile(full);
    const name = inv.attachmentFilename || "invoice";
    const ext = name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": ext,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
