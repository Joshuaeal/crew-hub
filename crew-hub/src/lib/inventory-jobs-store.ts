import { promises as fs } from "fs";
import path from "path";
import type { InventoryJob } from "@/types/inventory";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "inventory-jobs.json");

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

export async function readInventoryJobs(): Promise<InventoryJob[]> {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as InventoryJob[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(rows: InventoryJob[]) {
  await ensureDataFile();
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf-8");
}

export async function getInventoryJob(id: string): Promise<InventoryJob | undefined> {
  const all = await readInventoryJobs();
  return all.find((r) => r.id === id);
}

export async function createInventoryJob(input: {
  name: string;
  notes?: string;
  createdByEmail: string;
}): Promise<InventoryJob> {
  const all = await readInventoryJobs();
  const now = new Date().toISOString();
  const row: InventoryJob = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    createdByEmail: input.createdByEmail,
  };
  all.unshift(row);
  await writeAll(all);
  return row;
}

export async function updateInventoryJob(
  id: string,
  patch: Partial<{ name: string; notes: string | undefined }>
): Promise<InventoryJob | null> {
  const all = await readInventoryJobs();
  const i = all.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const cur = all[i];
  const now = new Date().toISOString();
  all[i] = {
    ...cur,
    name: patch.name !== undefined ? patch.name.trim() : cur.name,
    notes: patch.notes !== undefined ? patch.notes?.trim() || undefined : cur.notes,
    updatedAt: now,
  };
  await writeAll(all);
  return all[i];
}

export async function deleteInventoryJob(id: string): Promise<boolean> {
  const all = await readInventoryJobs();
  const next = all.filter((r) => r.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
