import { promises as fs } from "fs";
import path from "path";
import type { BillingSettings } from "@/types/billing";
import { defaultBillingSettings } from "@/types/billing";

const dataDir = path.join(process.cwd(), ".data");
const settingsFile = path.join(dataDir, "billing-settings.json");

async function ensureFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(settingsFile);
  } catch {
    await fs.writeFile(settingsFile, JSON.stringify(defaultBillingSettings(), null, 2), "utf-8");
  }
}

export async function readBillingSettings(): Promise<BillingSettings> {
  await ensureFile();
  try {
    const raw = await fs.readFile(settingsFile, "utf-8");
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return defaultBillingSettings();
    const o = p as Record<string, unknown>;
    const base = defaultBillingSettings();
    return {
      defaultTerms: typeof o.defaultTerms === "string" ? o.defaultTerms : base.defaultTerms,
      defaultFromEmail: typeof o.defaultFromEmail === "string" ? o.defaultFromEmail : base.defaultFromEmail,
      followUpIntervalDays: Array.isArray(o.followUpIntervalDays)
        ? (o.followUpIntervalDays as unknown[]).filter((x): x is number => typeof x === "number" && x > 0)
        : base.followUpIntervalDays,
      globalInvoiceCss: typeof o.globalInvoiceCss === "string" ? o.globalInvoiceCss : base.globalInvoiceCss,
    };
  } catch {
    return defaultBillingSettings();
  }
}

export async function updateBillingSettings(patch: Partial<BillingSettings>): Promise<BillingSettings> {
  const cur = await readBillingSettings();
  const next: BillingSettings = {
    ...cur,
    ...patch,
    followUpIntervalDays:
      patch.followUpIntervalDays !== undefined
        ? patch.followUpIntervalDays.filter((n) => n > 0)
        : cur.followUpIntervalDays,
  };
  await fs.writeFile(settingsFile, JSON.stringify(next, null, 2), "utf-8");
  return next;
}
