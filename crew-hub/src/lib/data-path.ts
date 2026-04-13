import path from "path";

const dataRoot = path.join(process.cwd(), ".data");

/** Resolve a path stored relative to `.data/` — returns null if it escapes. */
export function resolveUnderData(relativePath: string): string | null {
  const rel = path.normalize(relativePath.trim()).replace(/^(\.\.(\/|\\|$))+/, "");
  if (rel.includes("..") || rel.startsWith("/")) return null;
  const full = path.join(dataRoot, rel);
  const root = path.resolve(dataRoot);
  if (!full.startsWith(root)) return null;
  return full;
}
