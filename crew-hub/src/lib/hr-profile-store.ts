import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type {
  HrDocumentMeta,
  HrEmployeeProfile,
  HrQualificationDoc,
} from "@/types/hr-profile";
import { emptyHrProfile } from "@/types/hr-profile";

const dataDir = path.join(process.cwd(), ".data");
const profilesFile = path.join(dataDir, "hr-profiles.json");

/** Root folder for uploaded WWCC, police checks, qualifications (local disk only). */
export const HR_DOCUMENTS_DIR_NAME = "hr-documents";

function documentsRoot(): string {
  return path.join(dataDir, HR_DOCUMENTS_DIR_NAME);
}

/** Absolute path to the HR documents directory (for admin display / ops). */
export function getHrDocumentsRootAbs(): string {
  return path.resolve(documentsRoot());
}

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readProfilesRaw(): Promise<Record<string, HrEmployeeProfile>> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(profilesFile, "utf-8");
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return {};
    return p as Record<string, HrEmployeeProfile>;
  } catch {
    return {};
  }
}

async function writeProfiles(profiles: Record<string, HrEmployeeProfile>) {
  await ensureDataDir();
  await fs.writeFile(profilesFile, JSON.stringify(profiles, null, 2), "utf-8");
}

export async function getHrProfile(userId: string): Promise<HrEmployeeProfile> {
  const all = await readProfilesRaw();
  const cur = all[userId];
  if (!cur) return emptyHrProfile();
  return migrateProfile(cur);
}

function migrateProfile(p: HrEmployeeProfile): HrEmployeeProfile {
  const base = emptyHrProfile();
  return {
    ...base,
    ...p,
    emergencyContacts:
      Array.isArray(p.emergencyContacts) && p.emergencyContacts.length > 0
        ? p.emergencyContacts.map((e) => ({
            name: e?.name ?? "",
            relationship: e?.relationship ?? "",
            phone: e?.phone ?? "",
          }))
        : base.emergencyContacts,
    qualifications: Array.isArray(p.qualifications) ? p.qualifications : [],
    wwcc: p.wwcc ?? null,
    policeCheck: p.policeCheck ?? null,
  };
}

export async function saveHrProfile(
  userId: string,
  patch: Partial<HrEmployeeProfile>
): Promise<HrEmployeeProfile> {
  const all = await readProfilesRaw();
  const prev = (await getHrProfile(userId)) as HrEmployeeProfile;
  const next: HrEmployeeProfile = {
    ...prev,
    ...patch,
    emergencyContacts:
      patch.emergencyContacts !== undefined ? patch.emergencyContacts : prev.emergencyContacts,
    qualifications: patch.qualifications !== undefined ? patch.qualifications : prev.qualifications,
    updatedAt: new Date().toISOString(),
  };
  all[userId] = next;
  await writeProfiles(all);
  return next;
}

export async function setProfileDocument(
  userId: string,
  slot: "wwcc" | "policeCheck",
  meta: HrDocumentMeta | null
): Promise<HrEmployeeProfile> {
  if (slot === "wwcc") return saveHrProfile(userId, { wwcc: meta });
  return saveHrProfile(userId, { policeCheck: meta });
}

export async function setQualifications(
  userId: string,
  quals: HrQualificationDoc[]
): Promise<HrEmployeeProfile> {
  return saveHrProfile(userId, { qualifications: quals });
}

export type DocumentLookup =
  | {
      userId: string;
      meta: HrDocumentMeta;
      kind: "wwcc" | "policeCheck";
    }
  | {
      userId: string;
      meta: HrQualificationDoc;
      kind: "qualification";
    };

export async function findDocumentById(docId: string): Promise<DocumentLookup | null> {
  const all = await readProfilesRaw();
  for (const [userId, prof] of Object.entries(all)) {
    const p = migrateProfile(prof);
    if (p.wwcc?.id === docId) return { userId, meta: p.wwcc, kind: "wwcc" };
    if (p.policeCheck?.id === docId) return { userId, meta: p.policeCheck, kind: "policeCheck" };
    for (const q of p.qualifications) {
      if (q.id === docId) return { userId, meta: q, kind: "qualification" };
    }
  }
  return null;
}

export async function ensureUserDocumentDir(userId: string): Promise<string> {
  const dir = path.join(documentsRoot(), userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_BYTES = 15 * 1024 * 1024;

export function assertAllowedUpload(mime: string, size: number) {
  if (size <= 0 || size > MAX_BYTES) {
    throw new Error("File must be between 1 byte and 15 MB");
  }
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error(
      "File type not allowed. Use PDF, JPEG, PNG, WebP, HEIC, or Word documents."
    );
  }
}

export function safeStoredFileName(originalName: string, docId: string): string {
  const base = path.basename(originalName).replace(/[^a-zA-Z0-9._-]+/g, "_");
  const short = base.length > 80 ? base.slice(-80) : base;
  const ext = path.extname(short) || "";
  const hash = createHash("sha256").update(docId + originalName).digest("hex").slice(0, 8);
  return `${hash}${ext || ".bin"}`;
}

export async function writeUserDocumentFile(
  userId: string,
  buffer: Buffer,
  originalName: string,
  docId: string
): Promise<{ storedRelative: string; absolutePath: string }> {
  const dir = await ensureUserDocumentDir(userId);
  const name = safeStoredFileName(originalName, docId);
  const abs = path.join(dir, name);
  await fs.writeFile(abs, buffer);
  const rel = path.join(userId, name).replace(/\\/g, "/");
  return { storedRelative: rel, absolutePath: abs };
}

export async function deleteStoredFileIfExists(storedRelative: string) {
  const abs = path.join(documentsRoot(), storedRelative.replace(/^[/\\]+/, ""));
  const root = path.resolve(documentsRoot());
  const resolved = path.resolve(abs);
  if (!resolved.startsWith(root)) return;
  try {
    await fs.unlink(resolved);
  } catch {
    /* missing */
  }
}
