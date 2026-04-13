export type CrewRole = "admin" | "subcontractor" | "member";

export function isCrewRole(v: unknown): v is CrewRole {
  return v === "admin" || v === "subcontractor" || v === "member";
}
