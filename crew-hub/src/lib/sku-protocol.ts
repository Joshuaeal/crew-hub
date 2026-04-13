/**
 * Raconteur SKU protocol: [CAT]-[SUB]-[ITEM]-[OWNER]-[###]
 * Example: CAM-CIN-BMP4K-JA-001
 */

export const SKU_CATEGORY_CODES = [
  { code: "CAM", label: "Camera" },
  { code: "LEN", label: "Lenses" },
  { code: "LGT", label: "Lighting" },
  { code: "GRP", label: "Grip" },
  { code: "RIG", label: "Rigging" },
  { code: "AUD", label: "Audio" },
  { code: "VID", label: "Video / Broadcast" },
  { code: "COM", label: "Comms" },
  { code: "PWR", label: "Power" },
  { code: "MON", label: "Monitoring" },
  { code: "MOV", label: "Movement" },
  { code: "AIR", label: "Aerial" },
  { code: "NET", label: "IT / Network" },
  { code: "VEH", label: "Vehicles" },
] as const;

export type SkuCategoryCode = (typeof SKU_CATEGORY_CODES)[number]["code"];

/** Subcategories per category (code + label). */
export const SKU_SUBCATEGORY_BY_CAT: Record<SkuCategoryCode, { code: string; label: string }[]> = {
  CAM: [
    { code: "CIN", label: "Cinema Camera" },
    { code: "HYB", label: "Hybrid / Mirrorless" },
    { code: "OTH", label: "Other" },
  ],
  LEN: [
    { code: "ZOM", label: "Zoom" },
    { code: "PRM", label: "Prime" },
    { code: "OTH", label: "Other" },
  ],
  LGT: [
    { code: "COB", label: "COB Lights" },
    { code: "TUB", label: "Tubes" },
    { code: "MOV", label: "Moving Lights" },
    { code: "OTH", label: "Other" },
  ],
  GRP: [
    { code: "STD", label: "Stands" },
    { code: "RFL", label: "Reflect / Bounce" },
    { code: "CUT", label: "Flags / Cutters" },
    { code: "OTH", label: "Other" },
  ],
  RIG: [
    { code: "STD", label: "Standard" },
    { code: "BRD", label: "Brackets / mounts" },
    { code: "OTH", label: "Other" },
  ],
  AUD: [
    { code: "MIX", label: "Mixers" },
    { code: "MIC", label: "Microphones" },
    { code: "RF", label: "Wireless Systems" },
    { code: "OTH", label: "Other" },
  ],
  VID: [
    { code: "SWI", label: "Switchers" },
    { code: "SRV", label: "Servers" },
    { code: "OTH", label: "Other" },
  ],
  COM: [
    { code: "RAD", label: "Radios / comms kits" },
    { code: "IFB", label: "IFB / talent" },
    { code: "OTH", label: "Other" },
  ],
  PWR: [
    { code: "BAT", label: "Batteries / power distro" },
    { code: "AC", label: "AC / mains" },
    { code: "OTH", label: "Other" },
  ],
  MON: [
    { code: "OLED", label: "OLED / panels" },
    { code: "REF", label: "Reference / scopes" },
    { code: "OTH", label: "Other" },
  ],
  MOV: [
    { code: "DOL", label: "Dollies / sliders" },
    { code: "SLD", label: "Sliders" },
    { code: "GIM", label: "Gimbals" },
    { code: "OTH", label: "Other" },
  ],
  AIR: [
    { code: "DRN", label: "Drone" },
    { code: "LFT", label: "Lift / cable-cam" },
    { code: "OTH", label: "Other" },
  ],
  NET: [
    { code: "SW", label: "Switches" },
    { code: "WIFI", label: "Wi‑Fi / wireless" },
    { code: "OTH", label: "Other" },
  ],
  VEH: [
    { code: "VAN", label: "Van" },
    { code: "CAR", label: "Car / runabout" },
    { code: "OTH", label: "Other" },
  ],
};

const CAT_SET = new Set<string>(SKU_CATEGORY_CODES.map((c) => c.code));

export function isSkuCategoryCode(v: string): v is SkuCategoryCode {
  return CAT_SET.has(v);
}

export function categoryLabelForCode(code: string): string | undefined {
  return SKU_CATEGORY_CODES.find((c) => c.code === code)?.label;
}

/** Best-effort match from legacy free-text category to a CAT code (for editor defaults). */
export function guessSkuCategoryFromCategoryLabel(label: string): SkuCategoryCode | undefined {
  const t = label.trim().toLowerCase();
  if (!t) return undefined;
  for (const c of SKU_CATEGORY_CODES) {
    if (c.label.toLowerCase() === t) return c.code;
  }
  const hints: [string, SkuCategoryCode][] = [
    ["camera", "CAM"],
    ["lens", "LEN"],
    ["light", "LGT"],
    ["grip", "GRP"],
    ["rigg", "RIG"],
    ["audio", "AUD"],
    ["video", "VID"],
    ["broadcast", "VID"],
    ["comm", "COM"],
    ["power", "PWR"],
    ["monitor", "MON"],
    ["movement", "MOV"],
    ["dolly", "MOV"],
    ["slider", "MOV"],
    ["aerial", "AIR"],
    ["drone", "AIR"],
    ["network", "NET"],
    ["vehicle", "VEH"],
    ["van", "VEH"],
  ];
  for (const [k, code] of hints) {
    if (t.includes(k)) return code;
  }
  return undefined;
}

/**
 * Map Raconteur equipment CSV (Category + Item) to a CAT code.
 * Item keywords override vague "Core Systems" rows (e.g. Midas → AUD, router → NET).
 */
export function resolveSkuCategoryForEquipmentRow(
  csvCategory: string,
  itemName: string
): SkuCategoryCode {
  const t = itemName.toLowerCase();
  const catLower = csvCategory.trim().toLowerCase();

  if (/\b(midas|m32|aes50|soundgrid|stagebox)\b/i.test(itemName)) return "AUD";
  if (/\brf\b.*(mic|microphone)|microphone\s*system/i.test(t)) return "AUD";
  if (/\batem\b/i.test(t) || /\bndi\s*server\b/i.test(t)) return "VID";
  if (
    /\b(opnsense|mesh|wifi|managed\s*switch)\b/i.test(t) ||
    (/\brouter\b/i.test(t) && !/\batem\b/i.test(t))
  ) {
    return "NET";
  }
  if (/\b(mac\s*studio|touchscreen)\b/i.test(t) && catLower === "flyrack") return "MON";
  if (/\b(dji|avata|fpv)\b/i.test(t)) return "AIR";
  if (catLower === "vehicles" || /\b(4wd|production\s*vehicle)\b/i.test(t)) return "VEH";

  if (/\b(lenses?|primes?)\b/i.test(itemName)) return "LEN";

  const map: Record<string, SkuCategoryCode> = {
    cinema: "CAM",
    movement: "MOV",
    aerial: "AIR",
    lighting: "LGT",
    grip: "GRP",
    "core systems": "VID",
    flyrack: "MON",
    audio: "AUD",
    comms: "COM",
    vehicles: "VEH",
  };
  if (map[catLower]) return map[catLower];
  return guessSkuCategoryFromCategoryLabel(csvCategory) ?? "CAM";
}

/** Pick a valid SUB code from CAT + item wording (equipment register import). */
export function inferSkuSubcategoryForEquipment(cat: SkuCategoryCode, itemName: string): string {
  const t = itemName.toLowerCase();
  switch (cat) {
    case "CAM":
      return "CIN";
    case "LEN":
      if (t.includes("vintage") || /\bprimes?\b/.test(t)) return "PRM";
      if (t.includes("zoom") || t.includes("lens") || t.includes("sigma")) return "ZOM";
      return "OTH";
    case "MOV":
      if (t.includes("steadicam") || t.includes("easyrig")) return "DOL";
      if (t.includes("slider")) return "SLD";
      if (t.includes("ronin") || t.includes("gimbal")) return "GIM";
      return "OTH";
    case "AIR":
      return "DRN";
    case "LGT":
      if (t.includes("tube") || t.includes("pixel")) return "TUB";
      if (t.includes("moving") || t.includes("head") || t.includes("spotlight")) return "MOV";
      if (
        t.includes("cob") ||
        t.includes("rgb") ||
        t.includes("led") ||
        t.includes("bi-colour") ||
        t.includes("300w") ||
        t.includes("120w")
      ) {
        return "COB";
      }
      return "OTH";
    case "GRP":
      if (t.includes("flag") || t.includes("cutter")) return "CUT";
      if (t.includes("bounce") || t.includes("diffusion")) return "RFL";
      return "STD";
    case "VID":
      if (t.includes("atem") || t.includes("switcher")) return "SWI";
      if (t.includes("ndi")) return "SRV";
      return "OTH";
    case "NET":
      if (t.includes("mesh") || t.includes("wifi")) return "WIFI";
      if (t.includes("switch") || t.includes("router") || t.includes("opnsense")) return "SW";
      return "OTH";
    case "AUD":
      if (t.includes("rf") || t.includes("wireless")) return "RF";
      if (t.includes("midas") || t.includes("mixer") || t.includes("m32") || t.includes("stagebox") || t.includes("soundgrid")) {
        return "MIX";
      }
      return "OTH";
    case "COM":
      return "RAD";
    case "VEH":
      if (t.includes("4wd")) return "CAR";
      return "VAN";
    case "MON":
      return "OLED";
    default:
      return "OTH";
  }
}

/** 4–6 chars, A–Z / 0–9 only */
export function normalizeSkuItem(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.slice(0, 6);
}

/** 2–3 letters (owner initials) */
export function normalizeSkuOwnerCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
}

export function validateSkuItem(item: string): boolean {
  return item.length >= 4 && item.length <= 6 && /^[A-Z0-9]+$/.test(item);
}

export function validateSkuOwner(owner: string): boolean {
  return owner.length >= 2 && owner.length <= 3 && /^[A-Z]+$/.test(owner);
}

export function isValidSubForCategory(cat: SkuCategoryCode, sub: string): boolean {
  return SKU_SUBCATEGORY_BY_CAT[cat].some((s) => s.code === sub);
}

/** Build prefix without sequence: CAM-CIN-BMP4K-JA */
export function buildSkuBase(
  cat: SkuCategoryCode,
  sub: string,
  item: string,
  owner: string
): string {
  return `${cat}-${sub}-${item}-${owner}`;
}

/** Full SKU with 3-digit sequence */
export function composeSku(base: string, sequence: number): string {
  const n = Math.max(1, Math.min(999, Math.floor(sequence)));
  return `${base}-${String(n).padStart(3, "0")}`;
}

/**
 * Next sequence (1–999) for this base, scanning existing SKUs that match ^base-\d{3}$.
 * Optional excludeSkus (e.g. current row when editing) are ignored so the same number can be retained.
 */
export function nextSkuSequence(
  existingSkus: string[],
  base: string,
  excludeSkus?: string[]
): number {
  const excluded = new Set(
    (excludeSkus ?? []).filter(Boolean).map((s) => s.trim().toLowerCase())
  );
  const re = new RegExp(
    `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d{3})$`,
    "i"
  );
  let max = 0;
  for (const s of existingSkus) {
    const t = s.trim();
    if (excluded.has(t.toLowerCase())) continue;
    const m = t.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
  }
  return Math.min(999, max + 1);
}

export function parseRaconteurSku(s: string): {
  cat: SkuCategoryCode;
  sub: string;
  item: string;
  owner: string;
  seq: number;
} | null {
  const t = s.trim();
  const parts = t.split("-");
  if (parts.length !== 5) return null;
  const [cat, sub, item, owner, seqStr] = parts;
  if (!isSkuCategoryCode(cat)) return null;
  if (!isValidSubForCategory(cat, sub)) return null;
  if (!validateSkuItem(item)) return null;
  if (!validateSkuOwner(owner)) return null;
  if (!/^\d{3}$/.test(seqStr)) return null;
  const seq = parseInt(seqStr, 10);
  if (seq < 1 || seq > 999) return null;
  return { cat, sub, item, owner, seq };
}

export function validateRaconteurSkuFormat(s: string): boolean {
  return parseRaconteurSku(s) !== null;
}

export function allocateRaconteurSku(
  existingSkus: string[],
  cat: SkuCategoryCode,
  sub: string,
  item: string,
  owner: string,
  excludeSkus?: string[]
): string | null {
  const itemN = normalizeSkuItem(item);
  const ownerN = normalizeSkuOwnerCode(owner);
  if (!validateSkuItem(itemN) || !validateSkuOwner(ownerN)) return null;
  if (!isValidSubForCategory(cat, sub)) return null;
  const base = buildSkuBase(cat, sub, itemN, ownerN);
  const seq = nextSkuSequence(existingSkus, base, excludeSkus);
  return composeSku(base, seq);
}

/** Default SUB when migrating legacy data without a specific subcategory. */
export const MIGRATION_DEFAULT_SUB = "OTH";

/**
 * Owner segment for bulk migration: normalizes initials, or uses first/last initials, or `RC`.
 */
export function migrationDeriveOwnerCode(owner?: string | null): string {
  const direct = normalizeSkuOwnerCode(owner ?? "");
  if (validateSkuOwner(direct)) return direct;
  const raw = (owner ?? "").trim();
  if (!raw) return "RC";
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = words[0]!.replace(/[^a-zA-Z]/g, "").toUpperCase();
    const last = words[words.length - 1]!.replace(/[^a-zA-Z]/g, "").toUpperCase();
    const a = first[0];
    const b = last[0];
    if (a && b) return `${a}${b}`;
  }
  const letters = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (letters.length >= 2) return letters.slice(0, 3);
  return "RC";
}

/**
 * ITEM segment from name + stable id (4–6 chars) so short names stay unique across rows.
 */
export function migrationDeriveItemCode(name: string, stableId: string): string {
  const compact = normalizeSkuItem(name.replace(/\s/g, ""));
  if (compact.length >= 4) return compact.slice(0, 6);
  const idPad = normalizeSkuItem(stableId.replace(/-/g, "")).slice(0, 6);
  const merged = (compact + idPad).slice(0, 6);
  if (merged.length >= 4) return merged;
  return (merged + "XXXX").slice(0, 4);
}
