/** Feature flags stored per user. `*` means all features (superuser). */
export const GRANULAR_PERMISSIONS = [
  "comms",
  "billing",
  "inventory",
  "inventory_request",
  "embed_synapse",
  "shifts_view",
  "shifts_claim",
  "shifts_manage",
  "calendar",
  "invoices_subcontractor",
  "users_manage",
  "hr",
  "hr_manage",
  "projects_view",
  "projects_manage",
  "socials_view",
  "socials_manage",
  "affine_workspace",
] as const;

export type GranularPermission = (typeof GRANULAR_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<GranularPermission, string> = {
  comms: "Channels (Matrix)",
  billing: "Billing (invoices & quotes)",
  inventory: "Inventory (edit stock & items)",
  inventory_request: "Inventory (request checkout for jobs)",
  embed_synapse: "Synapse embed",
  shifts_view: "Shifts (view)",
  shifts_claim: "Shifts (claim)",
  shifts_manage: "Shifts (manage / approve)",
  calendar: "Schedule (events + iCal)",
  invoices_subcontractor: "Subcontractor invoices",
  users_manage: "Manage users & permissions",
  hr: "HR workspace (directory, submit leave)",
  hr_manage: "HR — approve or reject leave requests",
  projects_view: "Projects (view)",
  projects_manage: "Projects (create, edit, files, talent, pricing)",
  socials_view: "Socials (view)",
  socials_manage: "Socials (log, edit, delete posts)",
  affine_workspace: "Workspace (AFFiNE boards)",
};

export function isGranularPermission(v: string): v is GranularPermission {
  return (GRANULAR_PERMISSIONS as readonly string[]).includes(v);
}

export function hasPermission(permissions: string[], key: string): boolean {
  if (permissions.includes("*")) return true;
  return permissions.includes(key);
}

/** Schedule (/calendar) uses the same hub session as Shifts — any of these grants access. */
export const SCHEDULE_ACCESS_PERMISSIONS = ["calendar", "shifts_view", "shifts_manage"] as const;

export function canAccessSchedule(permissions: string[]): boolean {
  return SCHEDULE_ACCESS_PERMISSIONS.some((k) => hasPermission(permissions, k));
}

/** /shifts and GET /api/shifts — view, claim, or manage (not manage-only). */
export function canAccessShiftsList(permissions: string[]): boolean {
  return (
    hasPermission(permissions, "shifts_view") ||
    hasPermission(permissions, "shifts_manage") ||
    hasPermission(permissions, "shifts_claim")
  );
}

/** In-app HR (replaces external OrangeHRM for core workflows). */
export function canAccessHr(permissions: string[]): boolean {
  return (
    hasPermission(permissions, "hr") ||
    hasPermission(permissions, "hr_manage") ||
    hasPermission(permissions, "users_manage")
  );
}

export function canManageHrLeave(permissions: string[]): boolean {
  return hasPermission(permissions, "hr_manage") || hasPermission(permissions, "users_manage");
}

export function canAccessProjects(permissions: string[]): boolean {
  return (
    hasPermission(permissions, "projects_view") ||
    hasPermission(permissions, "projects_manage")
  );
}

export function canAccessSocials(permissions: string[]): boolean {
  return (
    hasPermission(permissions, "socials_view") ||
    hasPermission(permissions, "socials_manage")
  );
}

export function canAccessAffine(permissions: string[]): boolean {
  return hasPermission(permissions, "affine_workspace");
}

/** Defaults when creating a user by role (before admin edits). */
export function defaultPermissionsForRole(
  role: "admin" | "member" | "subcontractor"
): string[] {
  if (role === "admin") return ["*"];
  if (role === "subcontractor") return ["invoices_subcontractor"];
  return [
    "shifts_view",
    "shifts_claim",
    "calendar",
    "inventory_request",
    "hr",
    "comms",
    "affine_workspace",
  ];
}

export function normalizePermissionList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const x of input) {
    if (x === "*") {
      out.clear();
      out.add("*");
      return ["*"];
    }
    if (typeof x === "string" && (isGranularPermission(x) || x === "*")) {
      out.add(x);
    }
  }
  return Array.from(out);
}
