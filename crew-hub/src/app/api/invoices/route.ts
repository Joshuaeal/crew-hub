import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getSession } from "@/lib/session";
import { resolveUnderData } from "@/lib/data-path";
import {
  appendInvoice,
  getInvoiceById,
  listInvoicesForEmail,
  updateInvoiceById,
} from "@/lib/invoices-store";
import { createPayable } from "@/lib/payables-store";
import { hasPermission } from "@/types/permissions";

const MAX_BYTES = 12 * 1024 * 1024;

function safeFilename(name: string): string {
  const s = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return s || "invoice.bin";
}

export async function GET() {
  const session = await getSession();
  if (
    !session?.email ||
    !hasPermission(session.permissions, "invoices_subcontractor")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const items = await listInvoicesForEmail(session.email);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (
    !session?.email ||
    !hasPermission(session.permissions, "invoices_subcontractor")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json(
      {
        error:
          "Use multipart/form-data with fields: reference, amountAudIncGst (AUD inc GST), dueDate (YYYY-MM-DD), optional attachment file and notes",
      },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form" }, { status: 400 });
  }

  const reference = String(form.get("reference") ?? "").trim();
  const amountRaw = String(form.get("amountAudIncGst") ?? "").trim();
  const dueRaw = String(form.get("dueDate") ?? "").trim();
  const dueDate = dueRaw.includes("T") ? dueRaw.slice(0, 10) : dueRaw;
  const notes = String(form.get("notes") ?? "").trim() || undefined;
  const file = form.get("attachment");

  if (!reference) {
    return NextResponse.json(
      { error: "reference is required" },
      { status: 400 },
    );
  }
  const amountAudIncGst = parseFloat(amountRaw);
  if (!Number.isFinite(amountAudIncGst) || amountAudIncGst < 0) {
    return NextResponse.json(
      {
        error:
          "amountAudIncGst must be a non-negative number (AUD including GST)",
      },
      { status: 400 },
    );
  }
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return NextResponse.json(
      { error: "due date is required as YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const rounded = Math.round(amountAudIncGst * 100) / 100;

  const row = await appendInvoice({
    subcontractorEmail: session.email,
    reference,
    amountAudIncGst: rounded,
    currency: "AUD",
    dueDate,
    notes,
  });

  let attachmentRelativePath: string | undefined;
  let attachmentFilename: string | undefined;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Attachment must be 12 MB or smaller" },
        { status: 400 },
      );
    }
    const safe = safeFilename(file.name);
    attachmentRelativePath = path.posix.join(
      "subcontractor-invoices",
      row.id,
      safe,
    );
    const full = resolveUnderData(attachmentRelativePath);
    if (!full) {
      return NextResponse.json(
        { error: "Could not store attachment" },
        { status: 500 },
      );
    }
    await fs.mkdir(path.dirname(full), { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(full, buf);
    attachmentFilename = file.name;
  }

  const payable = await createPayable({
    title: `Subcontractor: ${reference}`,
    vendor: session.email,
    amountAudIncGst: rounded,
    dueDate,
    status: "pending_approval",
    notes: notes ? `Subcontractor: ${notes}` : undefined,
    linkedSubcontractorInvoiceId: row.id,
    attachmentFilename,
    attachmentRelativePath,
    createdByEmail: session.email,
  });

  await updateInvoiceById(row.id, {
    attachmentFilename,
    attachmentRelativePath,
    payableId: payable.id,
  });

  const item = await getInvoiceById(row.id);
  return NextResponse.json({ item, payableId: payable.id });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (
    !session?.email ||
    !hasPermission(session.permissions, "invoices_subcontractor")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const invoiceId = String(body.id ?? "").trim();

  if (!invoiceId) {
    return NextResponse.json(
      { error: "Invoice ID is required" },
      { status: 400 },
    );
  }

  const inv = await getInvoiceById(invoiceId);
  if (!inv) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Only allow deletion of own invoices
  if (inv.subcontractorEmail.toLowerCase() !== session.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Not authorized to delete this invoice" },
      { status: 403 },
    );
  }

  // Delete the attachment if it exists (record remains; it is "soft-cleared")

  // Delete the attachment if it exists
  if (inv.attachmentRelativePath) {
    const full = resolveUnderData(inv.attachmentRelativePath);
    if (full) {
      try {
        await fs.unlink(full);
      } catch {
        /* Ignore file not found errors */
      }
    }
  }

  await updateInvoiceById(invoiceId, {
    attachmentFilename: undefined,
    attachmentRelativePath: undefined,
    payableId: undefined,
  });

  return NextResponse.json({ message: "Invoice deleted", deleted: true });
}
