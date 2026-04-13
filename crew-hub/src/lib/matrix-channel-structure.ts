/**
 * Intended Matrix (Element) room layout for Raconteur / Crew production ops.
 * Matrix has no Discord-style “categories” in the protocol — use Spaces, topics, or naming.
 * Voice: Matrix is text-first; voice is typically Element Call or a widget in the same room.
 */

export type MatrixTextChannel = {
  kind: "text";
  /** Local alias (becomes #alias:your-server) — lowercase, [a-z0-9._=-] */
  alias: string;
  /** Human title */
  title: string;
  description: string;
  /** Create per job / duplicate — provisioning may skip or create a template */
  template?: boolean;
};

export type MatrixVoiceChannel = {
  kind: "voice";
  /** Local alias for the room (Element shows the display name) */
  alias: string;
  /** Room display name */
  name: string;
  description: string;
  /** Shown in UI / topic */
  useCases: string[];
};

export type MatrixChannelCategory = {
  id: string;
  title: string;
  blurb?: string;
  /** Finance / sensitive — prefer invite-only when seeding */
  restricted?: boolean;
  text: MatrixTextChannel[];
  voice: MatrixVoiceChannel[];
};

export const MATRIX_VOICE_NOTE =
  "Voice in Matrix is usually Element Call or a widget inside a room — rooms below are purpose-based coordination spaces, not separate VoIP servers.";

/** Client-facing hint for premium guest access */
export const MATRIX_CLIENT_EXPERIENCE = {
  summary:
    "Premium clients: invite to the project room (#production-…) and #deliverables; use Production Room 1 (voice room) when needed — transparent, organised, high-end.",
  textAliases: ["production-project", "deliverables"] as const,
  /** Same as Production Room 1 in blueprint */
  voiceAlias: "voice-production-1",
};

export const MATRIX_CHANNEL_BLUEPRINT: MatrixChannelCategory[] = [
  {
    id: "company-core",
    title: "1. Company core",
    text: [
      {
        kind: "text",
        alias: "announcements",
        title: "#announcements",
        description: "Final decisions only",
      },
      {
        kind: "text",
        alias: "weekly-ops",
        title: "#weekly-ops",
        description: "Scheduling, upcoming shoots",
      },
      {
        kind: "text",
        alias: "general",
        title: "#general",
        description: "Light comms (non-critical)",
      },
    ],
    voice: [
      {
        kind: "voice",
        alias: "voice-ops-room",
        name: "Ops Room",
        description: "Weekly planning · internal syncs",
        useCases: ["Weekly planning", "Internal syncs"],
      },
    ],
  },
  {
    id: "productions",
    title: "2. Productions",
    text: [
      {
        kind: "text",
        alias: "active-productions",
        title: "#active-productions",
        description: "Overview + links to projects",
      },
      {
        kind: "text",
        alias: "pre-production",
        title: "#pre-production",
        description: "Decks, planning, references",
      },
      {
        kind: "text",
        alias: "post-production",
        title: "#post-production",
        description: "Edits, feedback",
      },
      {
        kind: "text",
        alias: "production-project",
        title: "#production-[project-name]",
        description:
          "Create per job. Use threads for: shoot days, edit versions, client notes",
        template: true,
      },
    ],
    voice: [
      {
        kind: "voice",
        alias: "voice-production-1",
        name: "Production Room 1",
        description: "Live shoot comms (remote) · director + editor · client review",
        useCases: ["Live shoot comms (remote)", "Director + editor sessions", "Client review calls"],
      },
      {
        kind: "voice",
        alias: "voice-production-2",
        name: "Production Room 2",
        description: "Overflow / parallel session",
        useCases: ["Large productions", "Multi-department shoots"],
      },
    ],
  },
  {
    id: "gear-tech",
    title: "3. Gear & tech",
    text: [
      {
        kind: "text",
        alias: "gear-bookings",
        title: "#gear-bookings",
        description: "Who has what + when",
      },
      {
        kind: "text",
        alias: "gear-status",
        title: "#gear-status",
        description: "Issues / repairs",
      },
      {
        kind: "text",
        alias: "gear-inventory",
        title: "#gear-inventory",
        description: "Read-only master list",
      },
      {
        kind: "text",
        alias: "tech-systems",
        title: "#tech-systems",
        description: "Wrangler, NAS, workflows",
      },
    ],
    voice: [
      {
        kind: "voice",
        alias: "voice-tech-bay",
        name: "Tech Bay",
        description: "Troubleshooting · system setup sessions",
        useCases: ["Troubleshooting", "System setup sessions"],
      },
    ],
  },
  {
    id: "data-media",
    title: "4. Data & media",
    text: [
      {
        kind: "text",
        alias: "ingest",
        title: "#ingest",
        description: "Wrangler logs, offloads",
      },
      {
        kind: "text",
        alias: "backups",
        title: "#backups",
        description: "Backup verification",
      },
      {
        kind: "text",
        alias: "deliverables",
        title: "#deliverables",
        description: "Final exports + approvals",
      },
    ],
    voice: [
      {
        kind: "voice",
        alias: "voice-ingest-room",
        name: "Ingest Room",
        description: "Live offload monitoring · data wrangling coordination",
        useCases: ["Live offload monitoring", "Data wrangling coordination"],
      },
    ],
  },
  {
    id: "crew-talent",
    title: "5. Crew & talent (culture)",
    text: [
      {
        kind: "text",
        alias: "crew-roster",
        title: "#crew-roster",
        description: "Availability + roles",
      },
      {
        kind: "text",
        alias: "crew-bookings",
        title: "#crew-bookings",
        description: "Locking jobs",
      },
      {
        kind: "text",
        alias: "freelancer-hub",
        title: "#freelancer-hub",
        description: "External onboarding",
      },
      {
        kind: "text",
        alias: "wins",
        title: "#wins",
        description: "Completed projects, milestones",
      },
      {
        kind: "text",
        alias: "bts",
        title: "#bts",
        description: "Behind the scenes",
      },
      {
        kind: "text",
        alias: "random",
        title: "#random",
        description: "Keep general clean",
      },
    ],
    voice: [
      {
        kind: "voice",
        alias: "voice-green-room",
        name: "Green Room",
        description: "Pre-shoot staging · casual hangs",
        useCases: ["Pre-shoot staging", "Casual hangs"],
      },
      {
        kind: "voice",
        alias: "voice-crew-room",
        name: "Crew Room",
        description: "Active shoot comms · team coordination",
        useCases: ["Active shoot comms", "Team coordination"],
      },
    ],
  },
  {
    id: "business",
    title: "6. Business (sales + finance)",
    blurb: "Restricted access — invite-only when seeding",
    restricted: true,
    text: [
      { kind: "text", alias: "leads", title: "#leads", description: "New inquiries" },
      { kind: "text", alias: "quotes", title: "#quotes", description: "Pricing + negotiation" },
      {
        kind: "text",
        alias: "clients-active",
        title: "#clients-active",
        description: "Ongoing relationships",
      },
      {
        kind: "text",
        alias: "clients-archive",
        title: "#clients-archive",
        description: "Completed work",
      },
      { kind: "text", alias: "invoices", title: "#invoices", description: "Invoicing" },
      { kind: "text", alias: "expenses", title: "#expenses", description: "Expenses" },
      {
        kind: "text",
        alias: "gear-investment",
        title: "#gear-investment",
        description: "Capital / gear investment",
      },
    ],
    voice: [
      {
        kind: "voice",
        alias: "voice-client-calls",
        name: "Client Calls",
        description: "Sales calls · client meetings",
        useCases: ["Sales calls", "Client meetings"],
      },
      {
        kind: "voice",
        alias: "voice-internal-finance",
        name: "Internal Finance",
        description: "Budgeting · deal discussions",
        useCases: ["Budgeting", "Deal discussions"],
      },
    ],
  },
  {
    id: "development",
    title: "7. Development",
    text: [
      {
        kind: "text",
        alias: "r-and-d",
        title: "#r-and-d",
        description: "Ideas + improvements",
      },
      {
        kind: "text",
        alias: "wrangler-dev",
        title: "#wrangler-dev",
        description: "Ingest system",
      },
      {
        kind: "text",
        alias: "automation",
        title: "#automation",
        description: "Pipelines + scripts",
      },
    ],
    voice: [
      {
        kind: "voice",
        alias: "voice-dev-lab",
        name: "Dev Lab",
        description: "Build sessions · system design",
        useCases: ["Build sessions", "System design"],
      },
    ],
  },
];

/** Non-template blueprint rooms for in-app “Join” shortcuts (`#alias:server`). */
export function getBlueprintJoinHints(serverName: string): { id: string; label: string; fullAlias: string }[] {
  const domain = serverName.trim();
  const out: { id: string; label: string; fullAlias: string }[] = [];
  for (const cat of MATRIX_CHANNEL_BLUEPRINT) {
    for (const t of cat.text) {
      if (t.template) continue;
      out.push({
        id: `t-${cat.id}-${t.alias}`,
        label: t.title.replace(/^#/, "").trim() || t.alias,
        fullAlias: `#${t.alias}:${domain}`,
      });
    }
    for (const v of cat.voice) {
      out.push({
        id: `v-${cat.id}-${v.alias}`,
        label: v.name,
        fullAlias: `#${v.alias}:${domain}`,
      });
    }
  }
  return out;
}
