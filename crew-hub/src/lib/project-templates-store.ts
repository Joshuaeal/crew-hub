import { promises as fs } from "fs";
import path from "path";
import type {
  ProjectCategory,
  ProjectServiceType,
  ProjectTemplate,
  ProjectTemplateMilestone,
} from "@/types/projects";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "project-templates.json");

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

const SEED_TEMPLATES: Array<{
  name: string;
  description: string;
  defaultCategory: ProjectCategory;
  defaultServiceTypes: ProjectServiceType[];
  milestones: Array<{ title: string; offsetDaysFromStart: number }>;
}> = [
  {
    name: "Video Production",
    description: "General video production project.",
    defaultCategory: "Rack",
    defaultServiceTypes: ["Live Production"],
    milestones: [
      { title: "Confirm brief & shot list", offsetDaysFromStart: 0 },
      { title: "Confirm gear list", offsetDaysFromStart: 3 },
      { title: "Confirm crew", offsetDaysFromStart: 5 },
      { title: "Final client sign-off", offsetDaysFromStart: 14 },
    ],
  },
  {
    name: "Broadcast Event",
    description: "Live or recorded broadcast production.",
    defaultCategory: "Rack",
    defaultServiceTypes: ["Broadcast"],
    milestones: [
      { title: "Confirm gear list", offsetDaysFromStart: 0 },
      { title: "Confirm crew", offsetDaysFromStart: 3 },
      { title: "Venue site visit", offsetDaysFromStart: 7 },
      { title: "Final client sign-off", offsetDaysFromStart: 14 },
    ],
  },
  {
    name: "Live Event",
    description: "Live event production and crew.",
    defaultCategory: "Rack",
    defaultServiceTypes: ["Live Production"],
    milestones: [
      { title: "Confirm gear list", offsetDaysFromStart: 0 },
      { title: "Confirm crew", offsetDaysFromStart: 3 },
      { title: "Load-in & setup", offsetDaysFromStart: 10 },
      { title: "Final client sign-off", offsetDaysFromStart: 14 },
    ],
  },
  {
    name: "Music Event",
    description: "Music performance or recording event.",
    defaultCategory: "Rack",
    defaultServiceTypes: ["Music Production"],
    milestones: [
      { title: "Confirm gear list", offsetDaysFromStart: 0 },
      { title: "Confirm crew", offsetDaysFromStart: 3 },
      { title: "Sound check", offsetDaysFromStart: 10 },
      { title: "Final client sign-off", offsetDaysFromStart: 14 },
    ],
  },
  {
    name: "Subcontractor",
    description: "Labour hire or subcontracted crew engagement.",
    defaultCategory: "Rent",
    defaultServiceTypes: ["Labour Hire"],
    milestones: [
      { title: "Confirm scope & deliverables", offsetDaysFromStart: 0 },
      { title: "Confirm crew", offsetDaysFromStart: 2 },
      { title: "Final client sign-off", offsetDaysFromStart: 7 },
    ],
  },
];

async function seedIfEmpty(rows: ProjectTemplate[]): Promise<ProjectTemplate[]> {
  if (rows.length > 0) return rows;
  const now = new Date().toISOString();
  const seeded: ProjectTemplate[] = SEED_TEMPLATES.map((t) => ({
    id: crypto.randomUUID(),
    name: t.name,
    description: t.description,
    defaultCategory: t.defaultCategory,
    defaultServiceTypes: t.defaultServiceTypes,
    createdAt: now,
    updatedAt: now,
    milestones: t.milestones.map((m, idx) => ({
      id: crypto.randomUUID(),
      title: m.title,
      offsetDaysFromStart: m.offsetDaysFromStart,
      sortOrder: idx,
    })),
  }));
  await fs.writeFile(file, JSON.stringify(seeded, null, 2), "utf-8");
  return seeded;
}

export async function readProjectTemplates(): Promise<ProjectTemplate[]> {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const rows = Array.isArray(parsed) ? (parsed as ProjectTemplate[]) : [];
    return seedIfEmpty(rows);
  } catch {
    return [];
  }
}

async function writeAll(rows: ProjectTemplate[]) {
  await ensureDataFile();
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf-8");
}

export async function getProjectTemplate(id: string): Promise<ProjectTemplate | undefined> {
  const all = await readProjectTemplates();
  return all.find((t) => t.id === id);
}

export async function createProjectTemplate(input: {
  name: string;
  description?: string;
  defaultCategory?: ProjectCategory;
  defaultServiceTypes?: ProjectServiceType[];
}): Promise<ProjectTemplate> {
  const all = await readProjectTemplates();
  const now = new Date().toISOString();
  const row: ProjectTemplate = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    defaultCategory: input.defaultCategory,
    defaultServiceTypes: input.defaultServiceTypes ?? [],
    createdAt: now,
    updatedAt: now,
    milestones: [],
  };
  all.unshift(row);
  await writeAll(all);
  return row;
}

export async function updateProjectTemplate(
  id: string,
  patch: Partial<{
    name: string;
    description: string | undefined;
    defaultCategory: ProjectCategory | undefined;
    defaultServiceTypes: ProjectServiceType[];
  }>
): Promise<ProjectTemplate | null> {
  const all = await readProjectTemplates();
  const i = all.findIndex((t) => t.id === id);
  if (i < 0) return null;
  const cur = all[i];
  all[i] = {
    ...cur,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...("description" in patch ? { description: patch.description?.trim() || undefined } : {}),
    ...("defaultCategory" in patch ? { defaultCategory: patch.defaultCategory } : {}),
    ...(patch.defaultServiceTypes !== undefined
      ? { defaultServiceTypes: patch.defaultServiceTypes }
      : {}),
    updatedAt: new Date().toISOString(),
  };
  await writeAll(all);
  return all[i];
}

export async function deleteProjectTemplate(id: string): Promise<boolean> {
  const all = await readProjectTemplates();
  const next = all.filter((t) => t.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}

// --- Template Milestones ---

export async function addTemplateMilestone(
  templateId: string,
  input: {
    title: string;
    offsetDaysFromStart: number;
    sortOrder?: number;
  }
): Promise<ProjectTemplate | null> {
  const all = await readProjectTemplates();
  const i = all.findIndex((t) => t.id === templateId);
  if (i < 0) return null;
  const entry: ProjectTemplateMilestone = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    offsetDaysFromStart: input.offsetDaysFromStart,
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

export async function updateTemplateMilestone(
  templateId: string,
  milestoneId: string,
  patch: Partial<{
    title: string;
    offsetDaysFromStart: number;
    sortOrder: number;
  }>
): Promise<ProjectTemplate | null> {
  const all = await readProjectTemplates();
  const i = all.findIndex((t) => t.id === templateId);
  if (i < 0) return null;
  const mi = all[i].milestones.findIndex((m) => m.id === milestoneId);
  if (mi < 0) return null;
  const cur = all[i].milestones[mi];
  const next: ProjectTemplateMilestone = {
    ...cur,
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.offsetDaysFromStart !== undefined
      ? { offsetDaysFromStart: patch.offsetDaysFromStart }
      : {}),
    ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
  };
  const newMs = [...all[i].milestones];
  newMs[mi] = next;
  all[i] = { ...all[i], milestones: newMs, updatedAt: new Date().toISOString() };
  await writeAll(all);
  return all[i];
}

export async function deleteTemplateMilestone(
  templateId: string,
  milestoneId: string
): Promise<ProjectTemplate | null> {
  const all = await readProjectTemplates();
  const i = all.findIndex((t) => t.id === templateId);
  if (i < 0) return null;
  all[i] = {
    ...all[i],
    milestones: all[i].milestones.filter((m) => m.id !== milestoneId),
    updatedAt: new Date().toISOString(),
  };
  await writeAll(all);
  return all[i];
}

export async function replaceTemplateMilestones(
  templateId: string,
  milestones: ProjectTemplateMilestone[]
): Promise<ProjectTemplate | null> {
  const all = await readProjectTemplates();
  const i = all.findIndex((t) => t.id === templateId);
  if (i < 0) return null;
  all[i] = { ...all[i], milestones, updatedAt: new Date().toISOString() };
  await writeAll(all);
  return all[i];
}
