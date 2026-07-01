export type ModuleId =
  | "billing"
  | "inventory"
  | "shifts"
  | "hr"
  | "comms"
  | "subcontractors"
  | "projects"
  | "socials"
  | "affine";

export const ALL_MODULES: ModuleId[] = [
  "billing",
  "inventory",
  "shifts",
  "hr",
  "comms",
  "subcontractors",
  "projects",
  "socials",
  "affine",
];

export type InstancePalette = {
  /** Primary accent (buttons, links). Hex like #f4c430 */
  brand: string;
  /** Optional secondary accent. */
  accent?: string;
  /**
   * Invoice base / sheet colour (background, panels). Hex like #0b1220.
   * When unset, invoices fall back to a neutral dark base.
   */
  invoiceBase?: string;
  /** Invoice text / foreground colour. Hex like #e2e8f0. */
  invoiceText?: string;
};

export type InstanceSettings = {
  companyName: string;
  /** PNG/JPG/SVG data URL for invoices/emails. */
  invoiceLogoDataUrl?: string;
  /** PNG/JPG/ICO/SVG data URL for browser icon. */
  faviconDataUrl?: string;
  /** Matrix Client-Server API base URL (Synapse). Example: https://crew.alegrevisual.com */
  matrixHomeserverUrl?: string;
  /** Matrix web client to embed (Element / etc). */
  matrixClientUrl?: string;
  /** URL of the synapse-admin UI to embed. Example: https://crew.alegrevisual.com/synapse-admin */
  synapseAdminUrl?: string;
  /**
   * Optional CSS override applied to the Crew Hub UI (advanced).
   * Useful for changing dashboard tile colours, gradients, spacing, etc.
   */
  uiCss?: string;
  /**
   * Optional "sender" block shown on invoices (multiline).
   * Example:
   * Alegre Visual
   * 1 Caspian St Kialla
   * T: +61 404 560 744
   * E: josh@alegrevisual.com
   * ABN 54955049478
   */
  invoiceSenderBlock?: string;
  /** VDO.Ninja base URL(s) (comma-separated in UI). */
  vdoNinjaUrls?: string[];
  /** VDO.Ninja room password (used in generated links as &password=...). */
  vdoRoomPassword?: string;
  /** VDO.Ninja room id prefix (defaults to `rc`). */
  vdoRoomPrefix?: string;
  /**
   * Invoice number template.
   * Supported tokens: {KIND}, {YYYY}, {YY}, {SEQ} or {SEQ:4}.
   * Example: INV-{YYYY}-{SEQ:4}
   */
  invoiceNumberFormat?: string;
  /**
   * Optional starting sequence number when no existing invoices match the current format.
   * Example: 208 will yield ...0208 (or ...00208 depending on {SEQ:pad}).
   */
  invoiceSequenceStart?: number;
  palette: InstancePalette;
  /** Optional defaults for SKU generation/imports. */
  skuOwnerCode?: string;
  /**
   * Which feature modules are enabled for this instance.
   * Undefined (or empty) means all modules are enabled — default/backwards-compatible.
   */
  enabledModules?: ModuleId[];
  /**
   * Public URL of the self-hosted Collabora Online instance (e.g. https://collabora.yourdomain.com).
   * Used as the WOPI client editor for project file attachments.
   */
  collaboraUrl?: string;
  /**
   * Public URL of the self-hosted AFFiNE workspace (e.g. https://affine.yourdomain.com).
   * Used for both the /workspace embed and inline project board links.
   * Must be set before AFFiNE auth bridging will work.
   */
  affineUrl?: string;
  /**
   * AFFiNE admin email for server-side account provisioning.
   * Used by /api/affine/session to create per-user AFFiNE accounts automatically.
   * Store this in env (AFFINE_ADMIN_EMAIL) rather than instance settings for production.
   */
  /**
   * LiveKit server WebSocket URL for radio comms.
   * Example: ws://localhost:7880 or wss://livekit.yourdomain.com
   */
  livekitUrl?: string;
  /** Base URL of the omlx machine's LLM API used to generate structured meeting note summaries. */
  omlxUrl?: string;
  /** Optional API key sent as Authorization: Bearer for the omlx endpoint. */
  omlxApiKey?: string;
  /** Model name to use for summarisation (defaults to Qwen2.5-7B-Instruct-4bit). */
  omlxModel?: string;
  /** Radio channel names shown in the comms radio page (comma-separated label:roomName pairs or just labels). */
  radioChannels?: string[];
  /**
   * When true, users whose display name matches a known username can select Latching mic mode.
   * When false or undefined, everyone is locked to PTT.
   */
  radioLatchingEnabled?: boolean;
  /**
   * Set to true after the admin completes the initial setup wizard.
   * When false, the dashboard redirects admins to /admin/instance.
   */
  setupComplete?: boolean;
  updatedAt: string;
};

export function defaultInstanceSettings(): InstanceSettings {
  return {
    companyName: "Crew Hub",
    palette: { brand: "#5b8cff", accent: "#22c55e", invoiceBase: "#0b1220" },
    skuOwnerCode: "CREW",
    setupComplete: false,
    updatedAt: new Date().toISOString(),
  };
}

