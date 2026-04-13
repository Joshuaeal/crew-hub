import bcrypt from "bcryptjs";
import { promises as fs } from "fs";
import path from "path";
import { matrixProvisioningEnabled, upsertMatrixUser } from "@/lib/matrix-provision";
import type { CrewRole } from "@/types/crew-role";
import {
  defaultPermissionsForRole,
  hasPermission,
  normalizePermissionList,
} from "@/types/permissions";

export type UserRecord = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: CrewRole;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  /** Shown in HR directory and labour invoice lines (invoice falls back to username). */
  displayName?: string;
  /** Crew on-hands rate: AUD per hour ex GST for billing labour lines. */
  crewHandsRateAudExGst?: number | null;
};

const dataDir = path.join(process.cwd(), ".data");
const usersFile = path.join(dataDir, "users.json");
const membersLegacy = path.join(dataDir, "members.json");

async function ensureDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readUsersRaw(): Promise<UserRecord[]> {
  await ensureDir();
  try {
    const raw = await fs.readFile(usersFile, "utf-8");
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as UserRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeUsers(users: UserRecord[]) {
  await ensureDir();
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2), "utf-8");
}

let initPromise: Promise<void> | null = null;

function now() {
  return new Date().toISOString();
}

function validateUsername(u: string): string {
  const s = u.trim().toLowerCase();
  if (!/^[a-z0-9_]{2,64}$/.test(s)) {
    throw new Error(
      "Username must be 2–64 characters: lowercase letters, digits, underscore only"
    );
  }
  return s;
}

function validateEmail(e: string): string {
  const s = e.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    throw new Error("Invalid email");
  }
  return s;
}

function normalizeDisplayName(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== "string") throw new Error("Invalid display name");
  const s = raw.trim();
  if (!s) return undefined;
  if (s.length > 120) throw new Error("Display name must be at most 120 characters");
  return s;
}

function normalizeHandsRate(raw: unknown): number | null | undefined {
  if (raw === null) return null;
  if (raw === undefined) return undefined;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
    throw new Error("Crew on-hands rate must be a non-negative number (AUD/h ex GST)");
  }
  return Math.round(raw * 100) / 100;
}

async function migrateLegacyMembersInto(users: UserRecord[]): Promise<UserRecord[]> {
  try {
    const raw = await fs.readFile(membersLegacy, "utf-8");
    const p = JSON.parse(raw) as unknown;
    const rows = Array.isArray(p) ? (p as { email: string; passwordHash: string }[]) : [];
    const existingEmails = new Set(users.map((u) => u.email));
    const existingUsernames = new Set(users.map((u) => u.username));
    for (const m of rows) {
      const email = typeof m.email === "string" ? m.email.trim().toLowerCase() : "";
      if (!email || existingEmails.has(email)) continue;
      let base = email.split("@")[0]?.replace(/[^a-z0-9_]/gi, "") || "user";
      if (base.length < 2) base = "user";
      let username = base.slice(0, 32);
      let n = 0;
      while (existingUsernames.has(username)) {
        n += 1;
        username = `${base.slice(0, 28)}_${n}`;
      }
      existingUsernames.add(username);
      existingEmails.add(email);
      const t = now();
      users.push({
        id: crypto.randomUUID(),
        username,
        email,
        passwordHash: m.passwordHash,
        role: "member",
        permissions: defaultPermissionsForRole("member"),
        createdAt: t,
        updatedAt: t,
      });
    }
  } catch {
    /* no legacy file */
  }
  return users;
}

function envAdminUser(): UserRecord | null {
  const email = process.env.CREW_ADMIN_EMAIL?.trim().toLowerCase();
  const hash = process.env.CREW_ADMIN_PASSWORD_HASH?.trim();
  if (!email || !hash) return null;
  let local = email.split("@")[0] || "admin";
  local = local.replace(/[^a-z0-9_]/gi, "");
  if (local.length < 2) local = "admin";
  const t = now();
  return {
    id: crypto.randomUUID(),
    username: local.slice(0, 64),
    email,
    passwordHash: hash,
    role: "admin",
    permissions: ["*"],
    createdAt: t,
    updatedAt: t,
  };
}

function envSubcontractorUser(): UserRecord | null {
  const email = process.env.CREW_SUBCONTRACTOR_EMAIL?.trim().toLowerCase();
  const hash = process.env.CREW_SUBCONTRACTOR_PASSWORD_HASH?.trim();
  if (!email || !hash) return null;
  let local = email.split("@")[0] || "sub";
  local = local.replace(/[^a-z0-9_]/gi, "");
  if (local.length < 2) local = "sub";
  const t = now();
  return {
    id: crypto.randomUUID(),
    username: local.slice(0, 64),
    email,
    passwordHash: hash,
    role: "subcontractor",
    permissions: defaultPermissionsForRole("subcontractor"),
    createdAt: t,
    updatedAt: t,
  };
}

async function bootstrapUserAsync(): Promise<UserRecord | null> {
  try {
    const username = process.env.CREW_BOOTSTRAP_USERNAME?.trim().toLowerCase();
    const email = process.env.CREW_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    const hashEnv = process.env.CREW_BOOTSTRAP_PASSWORD_HASH?.trim();
    const plain = process.env.CREW_BOOTSTRAP_PASSWORD?.trim();
    let passwordHash: string | undefined;
    if (hashEnv) passwordHash = hashEnv;
    else if (plain) passwordHash = await bcrypt.hash(plain, 10);
    if (!username || !email || !passwordHash) return null;
    validateUsername(username);
    validateEmail(email);
    const t = now();
    return {
      id: crypto.randomUUID(),
      username,
      email,
      passwordHash,
      role: "admin",
      permissions: ["*"],
      createdAt: t,
      updatedAt: t,
    };
  } catch {
    return null;
  }
}

/**
 * When CREW_SEED_FROM_ENV seeds an admin from CREW_BOOTSTRAP_* with a plain
 * CREW_BOOTSTRAP_PASSWORD, create the matching Synapse user if provisioning is enabled.
 */
async function provisionMatrixForEnvBootstrap(users: UserRecord[]) {
  if (process.env.CREW_SEED_FROM_ENV !== "1") return;
  const plain = process.env.CREW_BOOTSTRAP_PASSWORD?.trim();
  const wantUser = process.env.CREW_BOOTSTRAP_USERNAME?.trim().toLowerCase();
  if (!plain || !wantUser || !matrixProvisioningEnabled()) return;
  const row = users.find((u) => u.username === wantUser);
  if (!row) return;
  try {
    await upsertMatrixUser({
      localpart: row.username,
      password: plain,
      displayName: undefined,
      logoutDevices: false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[crew-hub] Matrix bootstrap sync failed:", msg);
  }
}

async function ensureInitialized() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const existing = await readUsersRaw();
    if (existing.length > 0) return;

    const collected: UserRecord[] = [];
    const emails = new Set<string>();
    const usernames = new Set<string>();

    function add(u: UserRecord | null) {
      if (!u) return;
      if (emails.has(u.email) || usernames.has(u.username)) return;
      emails.add(u.email);
      usernames.add(u.username);
      collected.push(u);
    }

    if (process.env.CREW_SEED_FROM_ENV === "1") {
      add(await bootstrapUserAsync());
      add(envAdminUser());
      add(envSubcontractorUser());
    }

    const merged = await migrateLegacyMembersInto(collected);
    if (merged.length > 0) {
      await writeUsers(merged);
      await provisionMatrixForEnvBootstrap(merged);
    }
  })();
  return initPromise;
}

let envPasswordSyncDone = false;
let hrMigrateDone = false;

/** One-time: grant `hr` to existing members so the native HR workspace is available without manual edits. */
async function migrateMemberHrPermission(users: UserRecord[]): Promise<UserRecord[]> {
  let changed = false;
  const out = users.map((u) => {
    if (u.role !== "member" || u.permissions.includes("*")) return u;
    if (hasPermission(u.permissions, "hr") || hasPermission(u.permissions, "hr_manage")) return u;
    changed = true;
    return {
      ...u,
      permissions: [...u.permissions, "hr"],
      updatedAt: now(),
    };
  });
  if (changed) await writeUsers(out);
  return changed ? out : users;
}

/** If CREW_ADMIN_EMAIL + CREW_ADMIN_PASSWORD are set, update that user's password hash (dev / recovery). */
async function syncAdminPasswordFromEnv(users: UserRecord[]): Promise<boolean> {
  const plain = process.env.CREW_ADMIN_PASSWORD?.trim();
  const email = process.env.CREW_ADMIN_EMAIL?.trim().toLowerCase();
  if (!plain || !email) return false;
  const i = users.findIndex((u) => u.email === email);
  if (i < 0) return false;
  if (await bcrypt.compare(plain, users[i].passwordHash)) return false;
  const hash = await bcrypt.hash(plain, 10);
  users[i] = { ...users[i], passwordHash: hash, updatedAt: now() };
  await writeUsers(users);
  return true;
}

export async function readUsers(): Promise<UserRecord[]> {
  await ensureInitialized();
  let users = await readUsersRaw();
  if (!hrMigrateDone) {
    hrMigrateDone = true;
    users = await migrateMemberHrPermission(users);
  }
  if (!envPasswordSyncDone) {
    envPasswordSyncDone = true;
    const changed = await syncAdminPasswordFromEnv(users);
    if (changed) users = await readUsersRaw();
  }
  return users;
}

export async function getUserById(id: string): Promise<UserRecord | undefined> {
  const users = await readUsers();
  return users.find((u) => u.id === id);
}

export async function findUserByIdentifier(raw: string): Promise<UserRecord | null> {
  await ensureInitialized();
  const q = raw.trim();
  if (!q) return null;
  const users = await readUsers();
  const lower = q.toLowerCase();
  const byEmail = users.find((u) => u.email === lower);
  if (byEmail) return byEmail;
  return users.find((u) => u.username === lower) ?? null;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  await ensureInitialized();
  const e = email.trim().toLowerCase();
  const users = await readUsers();
  return users.find((u) => u.email === e) ?? null;
}

export async function verifyUserPassword(
  user: UserRecord,
  plainPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, user.passwordHash);
}

export async function createUser(input: {
  username: string;
  email: string;
  password: string;
  role: CrewRole;
  permissions?: string[];
  displayName?: string;
  crewHandsRateAudExGst?: number | null;
}): Promise<UserRecord> {
  await ensureInitialized();
  const username = validateUsername(input.username);
  const email = validateEmail(input.email);
  const users = await readUsers();
  if (users.some((u) => u.username === username)) throw new Error("Username already taken");
  if (users.some((u) => u.email === email)) throw new Error("Email already in use");
  const passwordHash = await bcrypt.hash(input.password, 10);
  let perms =
    input.permissions !== undefined
      ? normalizePermissionList(input.permissions)
      : defaultPermissionsForRole(input.role);
  if (perms.length === 0) perms = defaultPermissionsForRole(input.role);
  const t = now();
  const displayName = normalizeDisplayName(input.displayName);
  const crewHandsRateAudExGst =
    input.crewHandsRateAudExGst === undefined
      ? undefined
      : normalizeHandsRate(input.crewHandsRateAudExGst);
  const row: UserRecord = {
    id: crypto.randomUUID(),
    username,
    email,
    passwordHash,
    role: input.role,
    permissions: perms,
    createdAt: t,
    updatedAt: t,
    ...(displayName !== undefined ? { displayName } : {}),
    ...(crewHandsRateAudExGst !== undefined ? { crewHandsRateAudExGst } : {}),
  };
  users.push(row);
  await writeUsers(users);
  return row;
}

export async function updateUser(
  id: string,
  patch: {
    username?: string;
    email?: string;
    password?: string;
    role?: CrewRole;
    permissions?: string[];
    displayName?: string | null;
    crewHandsRateAudExGst?: number | null;
  }
): Promise<UserRecord | null> {
  await ensureInitialized();
  const users = await readUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i < 0) return null;
  const u = { ...users[i] };

  if (patch.username !== undefined) {
    u.username = validateUsername(patch.username);
    if (users.some((x, j) => j !== i && x.username === u.username)) {
      throw new Error("Username already taken");
    }
  }
  if (patch.email !== undefined) {
    u.email = validateEmail(patch.email);
    if (users.some((x, j) => j !== i && x.email === u.email)) {
      throw new Error("Email already in use");
    }
  }
  if (patch.password !== undefined && patch.password.length > 0) {
    u.passwordHash = await bcrypt.hash(patch.password, 10);
  }
  if (patch.role !== undefined) u.role = patch.role;
  if (patch.permissions !== undefined) u.permissions = normalizePermissionList(patch.permissions);
  if (patch.displayName !== undefined) {
    if (patch.displayName === null || patch.displayName === "") {
      delete u.displayName;
    } else {
      u.displayName = normalizeDisplayName(patch.displayName);
    }
  }
  if (patch.crewHandsRateAudExGst !== undefined) {
    if (patch.crewHandsRateAudExGst === null) {
      u.crewHandsRateAudExGst = null;
    } else {
      u.crewHandsRateAudExGst = normalizeHandsRate(patch.crewHandsRateAudExGst) ?? null;
    }
  }

  u.updatedAt = now();
  users[i] = u;
  await writeUsers(users);
  return u;
}

export async function deleteUser(id: string): Promise<boolean> {
  await ensureInitialized();
  const users = await readUsers();
  const next = users.filter((u) => u.id !== id);
  if (next.length === users.length) return false;
  if (next.length === 0) throw new Error("Cannot delete the last user");
  await writeUsers(next);
  return true;
}

export async function setUserPasswordHash(userId: string, passwordHash: string): Promise<boolean> {
  const users = await readUsers();
  const i = users.findIndex((u) => u.id === userId);
  if (i < 0) return false;
  users[i] = { ...users[i], passwordHash, updatedAt: now() };
  await writeUsers(users);
  return true;
}
