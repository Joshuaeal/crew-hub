export const PROJECT_CATEGORIES = ["Rent", "Rack", "Tour"] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const PROJECT_SERVICE_TYPES = [
  "Broadcast",
  "Stream",
  "Live Production",
  "Music Production",
  "Labour Hire",
  "Equipment Hire",
  "Installs",
  "Software/Services",
] as const;
export type ProjectServiceType = (typeof PROJECT_SERVICE_TYPES)[number];

export const PROJECT_STATUSES = [
  "Draft",
  "Confirmed",
  "In Progress",
  "Complete",
  "Cancelled",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const MILESTONE_STATUSES = ["Pending", "Done"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export type ProjectTalent = {
  id: string;
  /** Nullable — internal crew member by user id */
  personId?: string;
  /** For subcontractors without a user account */
  externalName?: string;
  externalContact?: string;
  role: string;
  rate?: number;
  rateUnit?: "hourly" | "daily";
  confirmed: boolean;
};

export type ProjectLineItem = {
  id: string;
  catalogItemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type ProjectMilestone = {
  id: string;
  title: string;
  dueDate: string;
  status: MilestoneStatus;
  isTemplateDefault: boolean;
  sortOrder: number;
};

export type Project = {
  id: string;
  name: string;
  slug: string;
  templateId?: string;
  category: ProjectCategory;
  serviceTypes: ProjectServiceType[];
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  clientId?: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  talent: ProjectTalent[];
  lineItems: ProjectLineItem[];
  milestones: ProjectMilestone[];
};

export type ProjectFile = {
  id: string;
  projectId: string;
  filename: string;
  storedRelative: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByEmail: string;
  uploadedAt: string;
};

export type ProjectTemplateMilestone = {
  id: string;
  title: string;
  offsetDaysFromStart: number;
  sortOrder: number;
};

export type ProjectTemplate = {
  id: string;
  name: string;
  description?: string;
  defaultCategory?: ProjectCategory;
  defaultServiceTypes?: ProjectServiceType[];
  createdAt: string;
  updatedAt: string;
  milestones: ProjectTemplateMilestone[];
};

/** Milestone with computed overdue flag (not stored) */
export type ProjectMilestoneWithOverdue = ProjectMilestone & {
  overdue: boolean;
};
