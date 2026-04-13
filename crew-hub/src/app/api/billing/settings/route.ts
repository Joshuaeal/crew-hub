import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { readBillingSettings, updateBillingSettings } from "@/lib/billing-settings-store";
import type { BillingSettings } from "@/types/billing";

export async function GET() {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;
  const settings = await readBillingSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  let body: Partial<BillingSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Partial<BillingSettings> = {};
  if (typeof body.defaultTerms === "string") patch.defaultTerms = body.defaultTerms;
  if (typeof body.defaultFromEmail === "string") patch.defaultFromEmail = body.defaultFromEmail;
  if (Array.isArray(body.followUpIntervalDays)) {
    patch.followUpIntervalDays = body.followUpIntervalDays.filter(
      (n): n is number => typeof n === "number" && n > 0
    );
  }
  if (typeof body.globalInvoiceCss === "string") patch.globalInvoiceCss = body.globalInvoiceCss;

  const settings = await updateBillingSettings(patch);
  return NextResponse.json({ settings });
}
