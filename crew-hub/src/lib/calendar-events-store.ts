import { promises as fs } from "fs";
import path from "path";
import type { CrewCalendarEvent } from "@/types/calendar-event";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "calendar-events.json");

async function ensureFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

function normalizeEvent(raw: unknown): CrewCalendarEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const startAt = typeof o.startAt === "string" ? o.startAt : "";
  const endAt = typeof o.endAt === "string" ? o.endAt : "";
  if (!id || !title || !startAt || !endAt) return null;
  return {
    id,
    title,
    description: typeof o.description === "string" ? o.description : undefined,
    location: typeof o.location === "string" ? o.location : undefined,
    startAt,
    endAt,
    allDay: o.allDay === true,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
    createdByEmail: typeof o.createdByEmail === "string" ? o.createdByEmail : "system",
  };
}

export async function readCalendarEvents(): Promise<CrewCalendarEvent[]> {
  await ensureFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const p = JSON.parse(raw) as unknown;
    const arr = Array.isArray(p) ? p : [];
    return arr.map(normalizeEvent).filter((x): x is CrewCalendarEvent => x !== null);
  } catch {
    return [];
  }
}

async function writeAll(rows: CrewCalendarEvent[]) {
  await ensureFile();
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf-8");
}

export async function getCalendarEvent(id: string): Promise<CrewCalendarEvent | undefined> {
  const all = await readCalendarEvents();
  return all.find((e) => e.id === id);
}

export async function createCalendarEvent(input: {
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  createdByEmail: string;
}): Promise<CrewCalendarEvent> {
  const all = await readCalendarEvents();
  const now = new Date().toISOString();
  const row: CrewCalendarEvent = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    location: input.location?.trim() || undefined,
    startAt: input.startAt,
    endAt: input.endAt,
    allDay: input.allDay,
    createdAt: now,
    updatedAt: now,
    createdByEmail: input.createdByEmail,
  };
  all.unshift(row);
  await writeAll(all);
  return row;
}

export async function updateCalendarEvent(
  id: string,
  patch: Partial<{
    title: string;
    description: string | undefined;
    location: string | undefined;
    startAt: string;
    endAt: string;
    allDay: boolean;
  }>
): Promise<CrewCalendarEvent | null> {
  const all = await readCalendarEvents();
  const i = all.findIndex((e) => e.id === id);
  if (i < 0) return null;
  const cur = all[i];
  const now = new Date().toISOString();
  all[i] = {
    ...cur,
    title: patch.title !== undefined ? patch.title.trim() : cur.title,
    description: patch.description !== undefined ? patch.description?.trim() || undefined : cur.description,
    location: patch.location !== undefined ? patch.location?.trim() || undefined : cur.location,
    startAt: patch.startAt !== undefined ? patch.startAt : cur.startAt,
    endAt: patch.endAt !== undefined ? patch.endAt : cur.endAt,
    allDay: patch.allDay !== undefined ? patch.allDay : cur.allDay,
    updatedAt: now,
  };
  await writeAll(all);
  return all[i];
}

export async function deleteCalendarEvent(id: string): Promise<boolean> {
  const all = await readCalendarEvents();
  const next = all.filter((e) => e.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
