import { NextResponse } from "next/server";
import { readBillingInvoices, advanceFollowUp } from "@/lib/billing-store";
import { readBillingSettings } from "@/lib/billing-settings-store";
import { sendBillingEmail, isSmtpConfigured } from "@/lib/mail";
import { billingFollowUpText } from "@/lib/billing-render";

/**
 * Call on a schedule (e.g. hourly cron) with ?token= matching CREW_BILLING_CRON_SECRET.
 * Sends due follow-up emails for sent documents with follow-ups enabled.
 */
export async function GET(request: Request) {
  const secret = process.env.CREW_BILLING_CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CREW_BILLING_CRON_SECRET not set" }, { status: 503 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("token") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isSmtpConfigured()) {
    return NextResponse.json({ error: "SMTP not configured", sent: 0 }, { status: 503 });
  }

  const settings = await readBillingSettings();
  const all = await readBillingInvoices();
  const now = Date.now();
  const publicBase =
    process.env.NEXT_PUBLIC_CREW_PUBLIC_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "";
  const baseUrl = publicBase
    ? publicBase.startsWith("http")
      ? publicBase
      : `https://${publicBase}`
    : "";

  let sent = 0;
  const errors: string[] = [];

  for (const doc of all) {
    if (doc.status !== "sent" || !doc.followUpEnabled) continue;
    if (!doc.nextFollowUpAt) continue;
    if (new Date(doc.nextFollowUpAt).getTime() > now) continue;
    const to = doc.customerEmail?.trim();
    if (!to) {
      errors.push(`${doc.number}: no customer email`);
      continue;
    }

    let from: string;
    try {
      from =
        doc.sendFromEmail?.trim() ||
        settings.defaultFromEmail?.trim() ||
        process.env.SMTP_FROM?.trim() ||
        "";
      if (!from) throw new Error("no From");
    } catch {
      errors.push(`${doc.number}: no From address`);
      continue;
    }

    const { subject, text, html } = billingFollowUpText(doc, settings, baseUrl);
    try {
      await sendBillingEmail({ to, from, subject, text, html });
      await advanceFollowUp(doc);
      sent += 1;
    } catch (e) {
      errors.push(`${doc.number}: ${e instanceof Error ? e.message : "send failed"}`);
    }
  }

  return NextResponse.json({ ok: true, sent, errors });
}
