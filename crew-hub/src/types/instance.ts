export type ModuleId =
  | "billing"
  | "inventory"
  | "shifts"
  | "hr"
  | "comms"
  | "subcontractors";

export const ALL_MODULES: ModuleId[] = [
  "billing",
  "inventory",
  "shifts",
  "hr",
  "comms",
  "subcontractors",
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

