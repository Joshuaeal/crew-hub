/**
 * VDO.Ninja URL helpers — room IDs must be 1–49 alphanumeric (see &room / &director docs).
 * https://docs.vdo.ninja/advanced-settings/setup-parameters/room
 */

const MAX_ROOM = 49;

/** Stable id per Matrix-style alias (prefix keeps namespaces clear). */
export function vdoRoomIdFromAlias(alias: string, prefix?: string): string {
  const alnum = alias.replace(/[^a-zA-Z0-9]/g, "");
  const p = (prefix || "rc").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "rc";
  const id = `${p}${alnum}`;
  return id.slice(0, MAX_ROOM) || `${p}default`;
}

export type VdoLinkSet = {
  roomId: string;
  /** Guest / group room join */
  join: string;
  /** Director control */
  director: string;
  /** Clean feed for OBS Browser Source (room monitor) */
  obsEmbed: string;
  /** Full iframe tag for embedding elsewhere */
  iframeHtml: string;
};

/**
 * Default room password for all generated links (VDO `&password` — alphanumeric, see Ninja docs).
 * Override with `NEXT_PUBLIC_VDO_NINJA_ROOM_PASSWORD` (rebuild required for Docker).
 */
export function getVdoRoomPasswordFromEnv(): string {
  return (
    process.env.NEXT_PUBLIC_VDO_NINJA_ROOM_PASSWORD?.trim() || "storyteller"
  );
}

function passwordQuery(password: string | undefined): string {
  const p = password?.trim();
  if (!p) return "";
  return `&password=${encodeURIComponent(p)}`;
}

export function buildVdoLinks(
  baseUrl: string,
  roomId: string,
  password?: string,
): VdoLinkSet {
  const b = baseUrl.replace(/\/$/, "");
  const r = encodeURIComponent(roomId);
  const pq = passwordQuery(password);
  const join = `${b}/?room=${r}${pq}`;
  const director = `${b}/?director=${r}${pq}`;
  const obsEmbed = `${b}/?scene&room=${r}${pq}`;
  const iframeHtml = `<iframe src="${obsEmbed}" title="VDO.Ninja" allow="camera; microphone; fullscreen; display-capture; autoplay" style="width:100%;height:100%;border:0;min-height:360px"></iframe>`;
  return { roomId, join, director, obsEmbed, iframeHtml };
}

/** Parse env: comma-separated list, or single NEXT_PUBLIC_VDO_NINJA_URL. */
export function getVdoNinjaBasesFromEnv(): string[] {
  const multi = process.env.NEXT_PUBLIC_VDO_NINJA_URLS?.trim();
  if (multi) {
    const parts = multi
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts;
  }
  const single =
    process.env.NEXT_PUBLIC_VDO_NINJA_URL?.trim() || "https://vdo.ninja";
  return [single];
}

/**
 * When `NEXT_PUBLIC_VDO_NINJA_URLS` lists multiple bases, **order matters**:
 * - Index **0** = preferred on **LAN / offline** (e.g. `http://192.168.1.50:3456` self-hosted VDO).
 * - Index **1** = preferred when the **hub** is opened on a **public hostname** (off-site / internet), e.g. `https://vdo.ninja` or your cloud instance.
 *
 * Same room IDs work on both if both run compatible VDO.Ninja builds; participants pick the URL they can reach.
 */
export function getDefaultVdoBaseIndex(
  bases: string[],
  hubHostname: string,
  onLine: boolean,
): number {
  if (bases.length <= 1) return 0;

  const host = hubHostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  const privateHub =
    host === "localhost" ||
    host === "::1" ||
    host.startsWith("127.") ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);

  if (!onLine || privateHub) return 0;
  return Math.min(1, bases.length - 1);
}
