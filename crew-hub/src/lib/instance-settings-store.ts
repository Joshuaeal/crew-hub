import { promises as fs } from "fs";
import path from "path";
import type { InstancePalette, InstanceSettings, ModuleId } from "@/types/instance";
import { defaultInstanceSettings, ALL_MODULES } from "@/types/instance";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "instance-settings.json");

async function ensureFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, JSON.stringify(defaultInstanceSettings(), null, 2), "utf-8");
  }
}

function isHexColor(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const t = s.trim();
  return /^#[0-9a-fA-F]{6}$/.test(t) || /^#[0-9a-fA-F]{3}$/.test(t);
}

function isDataUrl(s: unknown): s is string {
  return typeof s === "string" && s.startsWith("data:");
}

function isHttpUrl(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isLogoUrl(s: unknown): s is string {
  return isDataUrl(s) || isHttpUrl(s);
}

function parseUrlList(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    const out = raw
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => isHttpUrl(s))
      .slice(0, 6);
    return out.length ? out : undefined;
  }
  if (typeof raw === "string") {
    const out = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => isHttpUrl(s))
      .slice(0, 6);
    return out.length ? out : undefined;
  }
  return undefined;
}

function isInvoiceNumberFormat(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const t = raw.trim();
  if (!t) return false;
  if (t.length > 80) return false;
  // Must include a sequence token somewhere.
  if (!/\{SEQ(?::\d+)?\}/.test(t)) return false;
  return true;
}

function isVdoRoomPassword(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const t = raw.trim();
  if (!t) return false;
  if (t.length > 64) return false;
  // VDO docs recommend alphanumeric for password.
  if (!/^[a-zA-Z0-9]+$/.test(t)) return false;
  return true;
}

function isVdoRoomPrefix(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const t = raw.trim();
  if (!t) return false;
  if (t.length > 8) return false;
  if (!/^[a-zA-Z0-9]+$/.test(t)) return false;
  return true;
}

function parseInvoiceSequenceStart(raw: unknown): number | undefined {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i < 0) return undefined;
  if (i > 1_000_000) return undefined;
  return i;
}

export async function readInstanceSettings(): Promise<InstanceSettings> {
  await ensureFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const base = defaultInstanceSettings();
    if (!parsed || typeof parsed !== "object") return base;
    const o = parsed as Record<string, unknown>;
    const paletteRaw = (o.palette && typeof o.palette === "object"
      ? (o.palette as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const brand = isHexColor(paletteRaw.brand) ? paletteRaw.brand : base.palette.brand;
    const accent = isHexColor(paletteRaw.accent) ? paletteRaw.accent : base.palette.accent;
    const invoiceBase = isHexColor(paletteRaw.invoiceBase)
      ? paletteRaw.invoiceBase
      : base.palette.invoiceBase;
    return {
      companyName: typeof o.companyName === "string" ? o.companyName : base.companyName,
      invoiceLogoDataUrl:
        isLogoUrl(o.invoiceLogoDataUrl) ? (o.invoiceLogoDataUrl as string).trim() : undefined,
      faviconDataUrl: isLogoUrl(o.faviconDataUrl) ? (o.faviconDataUrl as string).trim() : undefined,
      matrixHomeserverUrl: isHttpUrl(o.matrixHomeserverUrl)
        ? (o.matrixHomeserverUrl as string).trim()
        : undefined,
      matrixClientUrl: isHttpUrl(o.matrixClientUrl) ? (o.matrixClientUrl as string).trim() : undefined,
      synapseAdminUrl: isHttpUrl(o.synapseAdminUrl) ? (o.synapseAdminUrl as string).trim() : undefined,
      affineUrl: isHttpUrl(o.affineUrl) ? (o.affineUrl as string).trim() : undefined,
      uiCss: typeof o.uiCss === "string" && o.uiCss.trim() ? o.uiCss : undefined,
      invoiceSenderBlock:
        typeof o.invoiceSenderBlock === "string" && o.invoiceSenderBlock.trim()
          ? o.invoiceSenderBlock
          : undefined,
      vdoNinjaUrls: parseUrlList(o.vdoNinjaUrls),
      vdoRoomPassword: isVdoRoomPassword(o.vdoRoomPassword)
        ? (o.vdoRoomPassword as string).trim()
        : undefined,
      vdoRoomPrefix: isVdoRoomPrefix(o.vdoRoomPrefix) ? (o.vdoRoomPrefix as string).trim() : undefined,
      invoiceNumberFormat: isInvoiceNumberFormat(o.invoiceNumberFormat)
        ? (o.invoiceNumberFormat as string).trim()
        : undefined,
      invoiceSequenceStart: parseInvoiceSequenceStart(o.invoiceSequenceStart),
      palette: { brand, ...(accent ? { accent } : {}), ...(invoiceBase ? { invoiceBase } : {}) },
      skuOwnerCode: typeof o.skuOwnerCode === "string" ? o.skuOwnerCode : base.skuOwnerCode,
      livekitUrl: (() => {
        if (typeof o.livekitUrl !== "string") return undefined;
        const t = o.livekitUrl.trim();
        if (!t) return undefined;
        try {
          const u = new URL(t);
          if (["ws:", "wss:", "http:", "https:"].includes(u.protocol)) return t;
        } catch { /* fall through */ }
        return undefined;
      })(),
      radioLatchingEnabled: o.radioLatchingEnabled === true ? true : undefined,
      radioChannels: (() => {
        if (!Array.isArray(o.radioChannels)) return undefined;
        const ch = (o.radioChannels as unknown[])
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((s) => s.trim())
          .slice(0, 20);
        return ch.length > 0 ? ch : undefined;
      })(),
      enabledModules: (() => {
        if (!Array.isArray(o.enabledModules)) return undefined;
        const mods = (o.enabledModules as unknown[])
          .filter((x): x is string => typeof x === "string")
          .filter((x) => ALL_MODULES.includes(x as ModuleId)) as ModuleId[];
        return mods.length > 0 ? mods : undefined;
      })(),
      // Backwards-compat: existing instances with a custom name are already set up.
      setupComplete:
        o.setupComplete === true ||
        (typeof o.companyName === "string" && o.companyName !== base.companyName),
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : base.updatedAt,
    };
  } catch {
    return defaultInstanceSettings();
  }
}

export async function updateInstanceSettings(
  patch: Partial<Omit<InstanceSettings, "updatedAt" | "palette">> & {
    palette?: Partial<InstancePalette>;
  }
): Promise<InstanceSettings> {
  const cur = await readInstanceSettings();
  const next: InstanceSettings = {
    ...cur,
    ...patch,
    palette: {
      ...cur.palette,
      ...(patch.palette ? patch.palette : {}),
    },
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(file, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

