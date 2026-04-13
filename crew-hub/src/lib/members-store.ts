import bcrypt from "bcryptjs";
import { promises as fs } from "fs";
import path from "path";

type MemberRecord = {
  email: string;
  passwordHash: string;
};

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "members.json");

async function ensureFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

export async function readMembers(): Promise<MemberRecord[]> {
  await ensureFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as MemberRecord[]) : [];
  } catch {
    return [];
  }
}

export async function addMember(email: string, plainPassword: string): Promise<MemberRecord> {
  await ensureFile();
  const list = await readMembers();
  const normalized = email.trim().toLowerCase();
  if (list.some((m) => m.email === normalized)) {
    throw new Error("Member already exists");
  }
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  const row: MemberRecord = { email: normalized, passwordHash };
  list.push(row);
  await fs.writeFile(file, JSON.stringify(list, null, 2), "utf-8");
  return row;
}

export async function verifyMemberPassword(
  email: string,
  password: string
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();

  const envEmail = process.env.CREW_MEMBER_EMAIL?.trim().toLowerCase();
  const envHash = process.env.CREW_MEMBER_PASSWORD_HASH?.trim();
  if (envEmail && envHash && normalized === envEmail) {
    return bcrypt.compare(password, envHash);
  }

  const list = await readMembers();
  const row = list.find((m) => m.email === normalized);
  if (!row) return false;
  return bcrypt.compare(password, row.passwordHash);
}

export async function hasAnyMemberAuth(): Promise<boolean> {
  if (
    process.env.CREW_MEMBER_EMAIL?.trim() &&
    process.env.CREW_MEMBER_PASSWORD_HASH?.trim()
  ) {
    return true;
  }
  const list = await readMembers();
  return list.length > 0;
}
