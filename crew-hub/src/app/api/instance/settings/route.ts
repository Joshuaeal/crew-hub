import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readInstanceSettings, updateInstanceSettings } from "@/lib/instance-settings-store";
import type { InstancePalette } from "@/types/instance";
import { hasPermission } from "@/types/permissions";

export const dynamic = "force-dynamic";

function isInvoiceNumberFormat(s: string): boolean {
  const t = s.trim();
  if (!t) return true; // allow blank (meaning default)
  return /\{SEQ(?::\d+)?\}/.test(t);
}

function parseNonNegativeInt(raw: unknown): number | undefined {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i < 0) return undefined;
  if (i > 1_000_000) return undefined;
  return i;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!hasPermission(session.permissions, "users_manage") && session.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const settings = await readInstanceSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!hasPermission(session.permissions, "users_manage") && session.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const palettePatch: Partial<InstancePalette> | undefined =
    patch.palette && typeof patch.palette === "object"
      ? (patch.palette as Partial<InstancePalette>)
      : undefined;

  if (typeof patch.invoiceNumberFormat === "string" && !isInvoiceNumberFormat(patch.invoiceNumberFormat)) {
    return NextResponse.json(
      { error: "Invoice number format must include {SEQ} (or {SEQ:4})." },
      { status: 400 }
    );
  }

  const next = await updateInstanceSettings({
    companyName: typeof patch.companyName === "string" ? patch.companyName : undefined,
    invoiceLogoDataUrl:
      typeof patch.invoiceLogoDataUrl === "string" ? patch.invoiceLogoDataUrl : undefined,
    faviconDataUrl: typeof patch.faviconDataUrl === "string" ? patch.faviconDataUrl : undefined,
    matrixHomeserverUrl:
      typeof patch.matrixHomeserverUrl === "string" ? patch.matrixHomeserverUrl : undefined,
    matrixClientUrl: typeof patch.matrixClientUrl === "string" ? patch.matrixClientUrl : undefined,
    synapseAdminUrl: typeof patch.synapseAdminUrl === "string" ? patch.synapseAdminUrl : undefined,
    uiCss: typeof patch.uiCss === "string" ? patch.uiCss : undefined,
    invoiceSenderBlock:
      typeof patch.invoiceSenderBlock === "string" ? patch.invoiceSenderBlock : undefined,
    vdoNinjaUrls:
      typeof patch.vdoNinjaUrls === "string" || Array.isArray(patch.vdoNinjaUrls)
        ? (patch.vdoNinjaUrls as unknown as string[])
        : undefined,
    vdoRoomPassword:
      typeof patch.vdoRoomPassword === "string" ? patch.vdoRoomPassword : undefined,
    vdoRoomPrefix: typeof patch.vdoRoomPrefix === "string" ? patch.vdoRoomPrefix : undefined,
    invoiceNumberFormat:
      typeof patch.invoiceNumberFormat === "string" ? patch.invoiceNumberFormat : undefined,
    invoiceSequenceStart:
      patch.invoiceSequenceStart !== undefined ? parseNonNegativeInt(patch.invoiceSequenceStart) : undefined,
    palette: palettePatch,
    skuOwnerCode: typeof patch.skuOwnerCode === "string" ? patch.skuOwnerCode : undefined,
    enabledModules: Array.isArray(patch.enabledModules) ? (patch.enabledModules as string[] as import("@/types/instance").ModuleId[]) : undefined,
    setupComplete: patch.setupComplete === true ? true : undefined,
    livekitUrl: typeof patch.livekitUrl === "string" ? patch.livekitUrl : undefined,
    radioChannels: Array.isArray(patch.radioChannels) ? (patch.radioChannels as string[]) : undefined,
    radioLatchingEnabled: typeof patch.radioLatchingEnabled === "boolean" ? patch.radioLatchingEnabled : undefined,
    affineUrl: typeof patch.affineUrl === "string" ? patch.affineUrl : undefined,
  });

  return NextResponse.json({ settings: next });
}

