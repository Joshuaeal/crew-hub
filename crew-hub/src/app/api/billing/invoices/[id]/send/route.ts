import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { getBillingInvoice, updateBillingInvoice } from "@/lib/billing-store";
import { readBillingSettings } from "@/lib/billing-settings-store";
import { readInstanceSettings } from "@/lib/instance-settings-store";
import { sendBillingEmail, isSmtpConfigured } from "@/lib/mail";
import { billingDocumentFullHtml } from "@/lib/billing-render";

function resolveFrom(
  doc: { sendFromEmail?: string },
  settings: { defaultFromEmail: string }
): string {
  const v =
    doc.sendFromEmail?.trim() ||
    settings.defaultFromEmail?.trim() ||
    process.env.SMTP_FROM?.trim();
  if (!v) throw new Error("No From address: set document, Billing settings, or SMTP_FROM");
  return v;
}

type Ctx = { params: { id: string } };

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "SMTP not configured (SMTP_HOST, SMTP_FROM, …)" },
      { status: 503 }
    );
  }

  let body: { to?: string; from?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const doc = await getBillingInvoice(ctx.params.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const to =
    (typeof body.to === "string" && body.to.trim()) || doc.customerEmail?.trim();
  if (!to) {
    return NextResponse.json(
      { error: "Recipient email required (set customer email or pass to)" },
      { status: 400 }
    );
  }

  const settings = await readBillingSettings();
  const publicBase =
    process.env.NEXT_PUBLIC_CREW_PUBLIC_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "";
  const baseUrl = publicBase
    ? publicBase.startsWith("http")
      ? publicBase
      : `https://${publicBase}`
    : "";

  const from = (typeof body.from === "string" && body.from.trim()) || resolveFrom(doc, settings);
  const label = doc.kind === "quote" ? "Quote" : "Invoice";
  const subject = `${label} ${doc.number} — ${doc.customerName}`;
  const instance = await readInstanceSettings();
  const html = billingDocumentFullHtml(doc, settings, baseUrl, instance);
  const text = `${label} ${doc.number}\n${doc.customerName}\n\nSee HTML version.`;

  try {
    await sendBillingEmail({ to, from, subject, html, text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let updated = doc;
  if (doc.status === "draft") {
    const next = await updateBillingInvoice(doc.id, { status: "sent" });
    if (next) updated = next;
  }

  return NextResponse.json({ ok: true, item: updated });
}
