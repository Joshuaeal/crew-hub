export type OnboardingStep = {
  title: string;
  detail: string;
};

export type EnvVarHint = {
  name: string;
  description: string;
};

export type ForkService = {
  id: string;
  name: string;
  tagline: string;
  category: "erp" | "inventory" | "support" | "comms" | "operations";
  upstreamUrl?: string;
  docsUrl?: string;
  composeService?: string;
  steps: OnboardingStep[];
  envVars: EnvVarHint[];
};

export const forkServices: ForkService[] = [
  {
    id: "crew-hr",
    name: "Crew HR",
    tagline:
      "Built-in people directory and leave requests—no separate HR container. Grant HR permissions in Users & permissions; managers approve leave in-app.",
    category: "operations",
    steps: [
      {
        title: "Open HR",
        detail:
          "Sign in and use HR in the sidebar (or /hr). Members see directory and can submit leave; grant hr_manage or use users_manage to approve.",
      },
      {
        title: "Permissions",
        detail:
          "hr — directory and submit leave. hr_manage — approve or reject requests. users_manage also covers approvals for admins.",
      },
      {
        title: "Data",
        detail:
          "Leave rows live in `.data/leave-requests.json` beside other hub data. Back up `.data` with your usual process.",
      },
    ],
    envVars: [],
  },
  {
    id: "matrix-crew",
    name: "Crew Comms (Matrix)",
    tagline:
      "Synapse homeserver plus the built-in Crew channels UI (matrix-js-sdk)—rooms, timeline, send messages.",
    category: "comms",
    upstreamUrl: "https://github.com/matrix-org/synapse",
    docsUrl:
      "https://element-hq.github.io/synapse/latest/setup/installation.html",
    composeService: "synapse",
    steps: [
      {
        title: "Run Synapse",
        detail:
          "Deploy Synapse with PostgreSQL, configure server_name and federation policy, and issue TLS certificates.",
      },
      {
        title: "Discord-like patterns",
        detail:
          "Use rooms per project, threads for side discussions, and power levels for mod roles. Bridge to Discord only if policy allows.",
      },
      {
        title: "Wire the hub",
        detail: `Set MATRIX_UPSTREAM_URL to the Synapse base URL the Next.js server can reach (e.g. http://synapse:8008) so the hub proxies /_matrix, /_synapse, and .well-known and the browser avoids CORS "fetch failed". For local dev without Docker, http://127.0.0.1:38471 works. Optional: NEXT_PUBLIC_SERVICE_SYNAPSE_URL — URL of the synapse-admin UI (docker-compose default host port 18088), not the raw Synapse landing page.`,
      },
      {
        title: "Element logins (sync disabled by default)",
        detail:
          "Matrix sync to Synapse is disabled by default. Users created in Crew Hub Admin → Users are stored locally. To enable sync, set CREW_MATRIX_SYNC_ENABLED=1 in .env. For now, create Matrix users manually in Synapse admin (public_registration: true).",
      },
    ],
    envVars: [
      { name: "SYNAPSE_SERVER_NAME", description: "Matrix server domain" },
      {
        name: "SYNAPSE_REPORT_STATS",
        description: "Whether to report anonymous stats",
      },
      {
        name: "CREW_SYNAPSE_ADMIN_ACCESS_TOKEN",
        description:
          "Synapse admin access token — provisions Element users when Crew users are created",
      },
      {
        name: "CREW_SYNAPSE_SERVER_NAME",
        description:
          "Optional override for MXID domain (defaults to SYNAPSE_SERVER_NAME)",
      },
    ],
  },
  {
    id: "matrix-sync-disabled",
    name: "Disable Matrix Sync",
    tagline:
      "Users are created in Crew Hub Admin → Users and stored locally. Matrix sync is disabled by default.",
    category: "operations",
    steps: [
      {
        title: "Check .env",
        detail: `Ensure CREW_MATRIX_SYNC_ENABLED is not set (or set to anything other than "1"). Matrix user provisioning is disabled.`,
      },
      {
        title: "Create users in Crew",
        detail:
          "Go to Admin → Users and create accounts. They'll be stored in .data/users.json without syncing to Synapse.",
      },
      {
        title: "Create Matrix users manually",
        detail:
          "Add Matrix accounts in Synapse admin or via Element registration (public_registration: true). Use the same username as Crew for consistency.",
      },
    ],
    envVars: [],
  },
];

export function getServiceById(id: string): ForkService | undefined {
  return forkServices.find((s) => s.id === id);
}
