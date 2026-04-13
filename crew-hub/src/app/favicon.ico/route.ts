import { readInstanceSettings } from "@/lib/instance-settings-store";

export const dynamic = "force-dynamic";

function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1] || "application/octet-stream";
  const b64 = m[2] || "";
  try {
    const buf = Buffer.from(b64, "base64");
    return { mime, bytes: new Uint8Array(buf) };
  } catch {
    return null;
  }
}

export async function GET() {
  const s = await readInstanceSettings();
  const dataUrl = s.faviconDataUrl?.trim() || "";
  const parsed = dataUrl ? parseDataUrl(dataUrl) : null;
  if (!parsed) {
    // Fallback: nothing custom configured. (204 triggers undici/Next runtime errors in some builds.)
    return new Response("Not found", { status: 404 });
  }
  return new Response(parsed.bytes as unknown as BodyInit, {
    headers: {
      "content-type": parsed.mime,
      "cache-control": "no-store",
    },
  });
}

