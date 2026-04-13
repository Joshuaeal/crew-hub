import { promises as fs } from "fs";
import path from "path";
import type { Shift } from "@/types/shift";
import { forStorage, normalizeShift } from "@/lib/shift-utils";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "shifts.json");

async function ensureFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

async function readShiftsRaw(): Promise<Shift[]> {
  await ensureFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as Shift[]) : [];
  } catch {
    return [];
  }
}

export async function readShifts(): Promise<Shift[]> {
  const raw = await readShiftsRaw();
  return raw.map((s) => normalizeShift(s));
}

export async function writeShifts(shifts: Shift[]) {
  await ensureFile();
  await fs.writeFile(file, JSON.stringify(shifts, null, 2), "utf-8");
}

export async function getShift(id: string): Promise<Shift | undefined> {
  const raw = await readShiftsRaw();
  const s = raw.find((x) => x.id === id);
  return s ? normalizeShift(s) : undefined;
}

export async function createShift(input: {
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  postedBy: string;
  crewing?: "open" | "assigned";
  slotsTotal?: number;
  assignedEmails?: string[];
}): Promise<Shift> {
  const all = await readShiftsRaw();
  const now = new Date().toISOString();
  const crewing = input.crewing ?? "open";

  if (crewing === "assigned") {
    const emails = (input.assignedEmails ?? [])
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length === 0) {
      throw new Error("assignedEmails required when crewing is assigned");
    }
    const row: Shift = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      startAt: input.startAt,
      endAt: input.endAt,
      postedBy: input.postedBy,
      crewing: "assigned",
      slotsTotal: 1,
      status: "filled",
      assignedEmails: emails,
      assignedTo: emails[0],
    };
    const stored = forStorage(normalizeShift(row));
    all.unshift(stored);
    await writeShifts(all);
    return normalizeShift(stored);
  }

  const slots = Math.max(1, Math.min(50, input.slotsTotal ?? 1));
  const row: Shift = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    startAt: input.startAt,
    endAt: input.endAt,
    postedBy: input.postedBy,
    crewing: "open",
    slotsTotal: slots,
    status: "open",
    claims: [],
  };
  const stored = forStorage(normalizeShift(row));
  all.unshift(stored);
  await writeShifts(all);
  return normalizeShift(stored);
}

export async function updateShift(id: string, patch: Partial<Shift>): Promise<Shift | null> {
  const all = await readShiftsRaw();
  const i = all.findIndex((s) => s.id === id);
  if (i < 0) return null;
  const current = normalizeShift(all[i]);
  const merged = normalizeShift({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  all[i] = forStorage(merged);
  await writeShifts(all);
  return merged;
}
