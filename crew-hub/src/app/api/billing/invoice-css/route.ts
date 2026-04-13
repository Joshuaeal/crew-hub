import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { readBillingSettings } from "@/lib/billing-settings-store";
import { combinedBillingCss } from "@/lib/billing-document-html";

export async function GET() {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;
  const settings = await readBillingSettings();
  const effectiveCss = combinedBillingCss(settings);
  return NextResponse.json({ effectiveCss });
}

