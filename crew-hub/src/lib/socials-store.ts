import { promises as fs } from "fs";
import path from "path";
import type { SocialPost, SocialPlatformId } from "@/types/socials";
import { SOCIAL_PLATFORMS } from "@/types/socials";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "socials-posts.json");

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

export async function readSocialPosts(): Promise<SocialPost[]> {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SocialPost[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(rows: SocialPost[]) {
  await ensureDataFile();
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf-8");
}

const validPlatformIds = new Set<string>(SOCIAL_PLATFORMS.map((p) => p.id));

export function isValidPlatformId(id: string): id is SocialPlatformId {
  return validPlatformIds.has(id);
}

export async function createSocialPost(input: {
  platformId: SocialPlatformId;
  postedAt: string;
  note?: string;
  loggedBy: string;
}): Promise<SocialPost> {
  const all = await readSocialPosts();
  const row: SocialPost = {
    id: crypto.randomUUID(),
    platformId: input.platformId,
    postedAt: input.postedAt,
    note: input.note?.trim() || undefined,
    loggedBy: input.loggedBy,
    createdAt: new Date().toISOString(),
  };
  all.unshift(row);
  await writeAll(all);
  return row;
}

export async function updateSocialPost(
  id: string,
  patch: Partial<{ postedAt: string; note: string | undefined }>
): Promise<SocialPost | null> {
  const all = await readSocialPosts();
  const i = all.findIndex((p) => p.id === id);
  if (i < 0) return null;
  const cur = all[i]!;
  all[i] = {
    ...cur,
    ...(patch.postedAt !== undefined ? { postedAt: patch.postedAt } : {}),
    ...("note" in patch ? { note: patch.note?.trim() || undefined } : {}),
  };
  await writeAll(all);
  return all[i]!;
}

export async function deleteSocialPost(id: string): Promise<boolean> {
  const all = await readSocialPosts();
  const next = all.filter((p) => p.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
