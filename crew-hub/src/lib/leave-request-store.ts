import { promises as fs } from "fs";
import path from "path";
import type { LeaveRequest, LeaveRequestStatus } from "@/types/leave-request";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "leave-requests.json");

async function ensureFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

export async function readLeaveRequests(): Promise<LeaveRequest[]> {
  await ensureFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as LeaveRequest[]) : [];
  } catch {
    return [];
  }
}

async function writeRows(rows: LeaveRequest[]) {
  await ensureFile();
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf-8");
}

export async function createLeaveRequest(input: {
  requestedByEmail: string;
  requestedByUsername: string;
  startAt: string;
  endAt: string;
  kind: LeaveRequest["kind"];
  note?: string;
}): Promise<LeaveRequest> {
  const all = await readLeaveRequests();
  const now = new Date().toISOString();
  const row: LeaveRequest = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    requestedByEmail: input.requestedByEmail,
    requestedByUsername: input.requestedByUsername,
    startAt: input.startAt,
    endAt: input.endAt,
    kind: input.kind,
    note: input.note?.trim() || undefined,
    status: "pending",
  };
  all.unshift(row);
  await writeRows(all);
  return row;
}

export async function updateLeaveRequestStatus(
  id: string,
  status: LeaveRequestStatus,
  decidedByEmail: string
): Promise<LeaveRequest | null> {
  const all = await readLeaveRequests();
  const i = all.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const now = new Date().toISOString();
  all[i] = {
    ...all[i],
    status,
    decidedByEmail,
    decidedAt: now,
    updatedAt: now,
  };
  await writeRows(all);
  return all[i];
}
