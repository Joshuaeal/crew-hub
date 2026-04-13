import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";

type ResetRow = {
  userId: string;
  tokenHash: string;
  expiresAt: string;
};

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "password-resets.json");

async function ensureFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

async function readAll(): Promise<ResetRow[]> {
  await ensureFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as ResetRow[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(rows: ResetRow[]) {
  await ensureFile();
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf-8");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function hashEq(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Create a reset token; returns plaintext token (send once by email). */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const rows = (await readAll()).filter((r) => r.userId !== userId);
  rows.push({ userId, tokenHash, expiresAt });
  await writeAll(rows);
  return token;
}

/** Validate token, remove row, return user id (single use). */
export async function takeResetToken(token: string): Promise<string | null> {
  const rows = await readAll();
  const want = hashToken(token);
  const i = rows.findIndex((r) => hashEq(r.tokenHash, want));
  if (i < 0) return null;
  const row = rows[i];
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    rows.splice(i, 1);
    await writeAll(rows);
    return null;
  }
  const userId = row.userId;
  rows.splice(i, 1);
  await writeAll(rows);
  return userId;
}
