import { promises as fs } from "fs";
import path from "path";
import type {
  Project,
  ProjectCategory,
  ProjectLineItem,
  ProjectMilestone,
  ProjectServiceType,
  ProjectStatus,
  ProjectTalent,
} from "@/types/projects";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "projects.json");

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

export async function readProjects(): Promise<Project[]> {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Project[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(rows: Project[]) {
  await ensureDataFile();
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf-8");
}

export async function getProjectBySlug(slug: string): Promise<Project | undefined> {
  const all = await readProjects();
  return all.find((p) => p.slug === slug);
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  const all = await readProjects();
  return all.find((p) => p.id === id);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string): Promise<string> {
  const all = await readProjects();
  const existing = new Set(all.map((p) => p.slug));
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export async function createProject(input: {
  name: string;
  category: ProjectCategory;
  serviceTypes: ProjectServiceType[];
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
  clientId?: string;
  templateId?: string;
  createdByEmail: string;
  milestones?: ProjectMilestone[];
}): Promise<Project> {
  const all = await readProjects();
  const now = new Date().toISOString();
  const slug = await uniqueSlug(slugify(input.name.trim()));
  const row: Project = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    slug,
    templateId: input.templateId,
    category: input.category,
    serviceTypes: input.serviceTypes,
    status: input.status ?? "Draft",
    startDate: input.startDate || undefined,
    endDate: input.endDate || undefined,
    clientId: input.clientId || undefined,
    createdByEmail: input.createdByEmail,
    createdAt: now,
    updatedAt: now,
    talent: [],
    lineItems: [],
    milestones: input.milestones ?? [],
  };
  all.unshift(row);
  await writeAll(all);
  return row;
}

export async function updateProject(
  slug: string,
  patch: Partial<{
    name: string;
    category: ProjectCategory;
    serviceTypes: ProjectServiceType[];
    status: ProjectStatus;
    startDate: string | undefined;
    endDate: string | undefined;
    clientId: string | undefined;
  }>
): Promise<Project | null> {
  const all = await readProjects();
  const i = all.findIndex((p) => p.slug === slug);
  if (i < 0) return null;
  const cur = all[i];
  const now = new Date().toISOString();
  all[i] = {
    ...cur,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.category !== undefined ? { category: patch.category } : {}),
    ...(patch.serviceTypes !== undefined ? { serviceTypes: patch.serviceTypes } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...("startDate" in patch ? { startDate: patch.startDate || undefined } : {}),
    ...("endDate" in patch ? { endDate: patch.endDate || undefined } : {}),
    ...("clientId" in patch ? { clientId: patch.clientId || undefined } : {}),
    updatedAt: now,
  };
  await writeAll(all);
  return all[i];
}

export async function deleteProject(slug: string): Promise<boolean> {
  const all = await readProjects();
  const next = all.filter((p) => p.slug !== slug);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}

// --- Talent ---

export async function addTalent(
  slug: string,
  input: {
    personId?: string;
    externalName?: string;
    externalContact?: string;
    role: string;
    rate?: number;
    rateUnit?: "hourly" | "daily";
    confirmed?: boolean;
  }
): Promise<Project | null> {
  const all = await readProjects();
  const i = all.findIndex((p) => p.slug === slug);
  if (i < 0) return null;
  const entry: ProjectTalent = {
    id: crypto.randomUUID(),
    personId: input.personId || undefined,
    externalName: input.externalName?.trim() || undefined,
    externalContact: input.externalContact?.trim() || undefined,
    role: input.role.trim(),
    rate: typeof input.rate === "number" ? input.rate : undefined,
    rateUnit: input.rateUnit === "hourly" || input.rateUnit === "daily" ? input.rateUnit : undefined,
    confirmed: input.confirmed ?? false,
  };
  all[i] = { ...all[i], talent: [...all[i].talent, entry], updatedAt: new Date().toISOString() };
  await writeAll(all);
  return all[i];
}

export async function updateTalent(
  slug: string,
  talentId: string,
  patch: Partial<{
    personId: string | undefined;
    externalName: string | undefined;
    externalContact: string | undefined;
    role: string;
    rate: number | undefined;
    rateUnit: "hourly" | "daily" | undefined;
    confirmed: boolean;
  }>
): Promise<Project | null> {
  const all = await readProjects();
  const i = all.findIndex((p) => p.slug === slug);
  if (i < 0) return null;
  const ti = all[i].talent.findIndex((t) => t.id === talentId);
  if (ti < 0) return null;
  const cur = all[i].talent[ti];
  const next: ProjectTalent = {
    ...cur,
    ...("personId" in patch ? { personId: patch.personId || undefined } : {}),
    ...("externalName" in patch ? { externalName: patch.externalName?.trim() || undefined } : {}),
    ...("externalContact" in patch
      ? { externalContact: patch.externalContact?.trim() || undefined }
      : {}),
    ...(patch.role !== undefined ? { role: patch.role.trim() } : {}),
    ...("rate" in patch ? { rate: typeof patch.rate === "number" ? patch.rate : undefined } : {}),
    ...("rateUnit" in patch ? { rateUnit: patch.rateUnit === "hourly" || patch.rateUnit === "daily" ? patch.rateUnit : undefined } : {}),
    ...(patch.confirmed !== undefined ? { confirmed: patch.confirmed } : {}),
  };
  const newTalent = [...all[i].talent];
  newTalent[ti] = next;
  all[i] = { ...all[i], talent: newTalent, updatedAt: new Date().toISOString() };
  await writeAll(all);
  return all[i];
}

export async function deleteTalent(slug: string, talentId: string): Promise<Project | null> {
  const all = await readProjects();
  const i = all.findIndex((p) => p.slug === slug);
  if (i < 0) return null;
  all[i] = {
    ...all[i],
    talent: all[i].talent.filter((t) => t.id !== talentId),
    updatedAt: new Date().toISOString(),
  };
  await writeAll(all);
  return all[i];
}

// --- Line Items ---

export async function addLineItem(
  slug: string,
  input: {
    catalogItemId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }
): Promise<Project | null> {
  const all = await readProjects();
  const i = all.findIndex((p) => p.slug === slug);
  if (i < 0) return null;
  const entry: ProjectLineItem = {
    id: crypto.randomUUID(),
    catalogItemId: input.catalogItemId || undefined,
    description: input.description.trim(),
    quantity: input.quantity,
    unitPrice: input.unitPrice,
  };
  all[i] = {
    ...all[i],
    lineItems: [...all[i].lineItems, entry],
    updatedAt: new Date().toISOString(),
  };
  await writeAll(all);
  return all[i];
}

export async function updateLineItem(
  slug: string,
  itemId: string,
  patch: Partial<{
    catalogItemId: string | undefined;
    description: string;
    quantity: number;
    unitPrice: number;
  }>
): Promise<Project | null> {
  const all = await readProjects();
  const i = all.findIndex((p) => p.slug === slug);
  if (i < 0) return null;
  const li = all[i].lineItems.findIndex((l) => l.id === itemId);
  if (li < 0) return null;
  const cur = all[i].lineItems[li];
  const next: ProjectLineItem = {
    ...cur,
    ...("catalogItemId" in patch ? { catalogItemId: patch.catalogItemId || undefined } : {}),
    ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
    ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
    ...(patch.unitPrice !== undefined ? { unitPrice: patch.unitPrice } : {}),
  };
  const newItems = [...all[i].lineItems];
  newItems[li] = next;
  all[i] = { ...all[i], lineItems: newItems, updatedAt: new Date().toISOString() };
  await writeAll(all);
  return all[i];
}

export async function deleteLineItem(slug: string, itemId: string): Promise<Project | null> {
  const all = await readProjects();
  const i = all.findIndex((p) => p.slug === slug);
  if (i < 0) return null;
  all[i] = {
    ...all[i],
    lineItems: all[i].lineItems.filter((l) => l.id !== itemId),
    updatedAt: new Date().toISOString(),
  };
  await writeAll(all);
  return all[i];
}

// --- Milestones ---

export async function addMilestone(
  slug: string,
  input: {
    title: string;
    dueDate: string;
    isTemplateDefault?: boolean;
    sortOrder?: number;
  }
): Promise<Project | null> {
  const all = await readProjects();
  const i = all.findIndex((p) => p.slug === slug);
  if (i < 0) return null;
  const entry: ProjectMilestone = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    dueDate: input.dueDate,
    status: "Pending",
    isTemplateDefault: input.isTemplateDefault ?? false,
    sortOrder: input.sortOrder ?? all[i].milestones.length,
  };
  all[i] = {
    ...all[i],
    milestones: [...all[i].milestones, entry],
    updatedAt: new Date().toISOString(),
  };
  await writeAll(all);
  return all[i];
}

export async function updateMilestone(
  slug: string,
  milestoneId: string,
  patch: Partial<{
    title: string;
    dueDate: string;
    status: "Pending" | "Done";
    sortOrder: number;
  }>
): Promise<Project | null> {
  const all = await readProjects();
  const i = all.findIndex((p) => p.slug === slug);
  if (i < 0) return null;
  const mi = all[i].milestones.findIndex((m) => m.id === milestoneId);
  if (mi < 0) return null;
  const cur = all[i].milestones[mi];
  const next: ProjectMilestone = {
    ...cur,
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
  };
  const newMs = [...all[i].milestones];
  newMs[mi] = next;
  all[i] = { ...all[i], milestones: newMs, updatedAt: new Date().toISOString() };
  await writeAll(all);
  return all[i];
}

export async function deleteMilestone(slug: string, milestoneId: string): Promise<Project | null> {
  const all = await readProjects();
  const i = all.findIndex((p) => p.slug === slug);
  if (i < 0) return null;
  all[i] = {
    ...all[i],
    milestones: all[i].milestones.filter((m) => m.id !== milestoneId),
    updatedAt: new Date().toISOString(),
  };
  await writeAll(all);
  return all[i];
}
