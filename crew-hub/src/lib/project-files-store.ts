import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { ProjectFile } from "@/types/projects";

const dataDir = path.join(process.cwd(), ".data");
const filesIndex = path.join(dataDir, "project-files.json");
const PROJECT_FILES_DIR = "project-files";

function filesRoot(): string {
  return path.join(dataDir, PROJECT_FILES_DIR);
}

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export function assertAllowedUpload(mimeType: string, sizeBytes: number) {
  if (sizeBytes > MAX_FILE_SIZE)
    throw new Error(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB).`);
  if (!ALLOWED_MIME_TYPES.includes(mimeType))
    throw new Error("File type not allowed. Accepted: PDF, images, Word documents.");
}

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(filesIndex);
  } catch {
    await fs.writeFile(filesIndex, "[]", "utf-8");
  }
}

async function readAll(): Promise<ProjectFile[]> {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(filesIndex, "utf-8");
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as ProjectFile[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(rows: ProjectFile[]) {
  await ensureDataFile();
  await fs.writeFile(filesIndex, JSON.stringify(rows, null, 2), "utf-8");
}

export async function listProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const all = await readAll();
  return all.filter((f) => f.projectId === projectId);
}

export async function getProjectFile(fileId: string): Promise<ProjectFile | undefined> {
  const all = await readAll();
  return all.find((f) => f.id === fileId);
}

export async function writeProjectFile(
  projectId: string,
  buf: Buffer,
  originalName: string,
  docId: string
): Promise<{ storedRelative: string }> {
  const projectDir = path.join(filesRoot(), projectId);
  await fs.mkdir(projectDir, { recursive: true });
  const ext = path.extname(originalName).toLowerCase();
  const hash = createHash("sha256")
    .update(docId + originalName)
    .digest("hex")
    .slice(0, 8);
  const filename = `${hash}${ext}`;
  await fs.writeFile(path.join(projectDir, filename), buf);
  return { storedRelative: `${projectId}/${filename}` };
}

export async function saveProjectFileMeta(meta: ProjectFile): Promise<void> {
  const all = await readAll();
  all.push(meta);
  await writeAll(all);
}

export async function deleteProjectFile(fileId: string): Promise<boolean> {
  const all = await readAll();
  const entry = all.find((f) => f.id === fileId);
  if (!entry) return false;
  const abs = path.join(filesRoot(), entry.storedRelative);
  try {
    await fs.unlink(abs);
  } catch {
    // if file is already gone, continue
  }
  await writeAll(all.filter((f) => f.id !== fileId));
  return true;
}

export async function deleteAllProjectFiles(projectId: string): Promise<void> {
  const all = await readAll();
  const toDelete = all.filter((f) => f.projectId === projectId);
  for (const f of toDelete) {
    const abs = path.join(filesRoot(), f.storedRelative);
    try {
      await fs.unlink(abs);
    } catch {
      // ignore missing files
    }
  }
  await writeAll(all.filter((f) => f.projectId !== projectId));
}

export function getProjectFileAbsPath(storedRelative: string): string {
  return path.join(filesRoot(), storedRelative);
}
