import { promises as fs } from "fs";
import path from "path";
import type { DashboardLayout } from "@/types/dashboard";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "dashboard-layouts.json");

async function ensureFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

async function readAll(): Promise<DashboardLayout[]> {
  await ensureFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as DashboardLayout[]) : [];
  } catch {
    return [];
  }
}

export async function getDashboardLayout(userId: string): Promise<DashboardLayout | null> {
  const all = await readAll();
  return all.find((l) => l.user_id === userId) ?? null;
}

export async function saveDashboardLayout(
  userId: string,
  widgets: DashboardLayout["widgets"],
): Promise<DashboardLayout> {
  const all = await readAll();
  const now = new Date().toISOString();
  const existing = all.find((l) => l.user_id === userId);
  const layout: DashboardLayout = {
    id: existing?.id ?? crypto.randomUUID(),
    user_id: userId,
    updated_at: now,
    widgets,
  };
  const idx = all.findIndex((l) => l.user_id === userId);
  if (idx >= 0) {
    all[idx] = layout;
  } else {
    all.push(layout);
  }
  await ensureFile();
  await fs.writeFile(file, JSON.stringify(all, null, 2), "utf-8");
  return layout;
}
