import { promises as fs } from "fs";
import path from "path";
import type { MeetingNote, MeetingNoteAccess } from "@/types/notetaker";

const dataDir = path.join(process.cwd(), ".data");
const notesFile = path.join(dataDir, "meeting-notes.json");
const accessFile = path.join(dataDir, "meeting-note-access.json");

async function ensureFile(filePath: string) {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]", "utf-8");
  }
}

// --- Notes ---

export async function readAllNotes(): Promise<MeetingNote[]> {
  await ensureFile(notesFile);
  try {
    const raw = await fs.readFile(notesFile, "utf-8");
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as MeetingNote[]) : [];
  } catch {
    return [];
  }
}

async function writeNotes(rows: MeetingNote[]) {
  await ensureFile(notesFile);
  await fs.writeFile(notesFile, JSON.stringify(rows, null, 2), "utf-8");
}

// --- Access ---

export async function readAllAccess(): Promise<MeetingNoteAccess[]> {
  await ensureFile(accessFile);
  try {
    const raw = await fs.readFile(accessFile, "utf-8");
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as MeetingNoteAccess[]) : [];
  } catch {
    return [];
  }
}

async function writeAccess(rows: MeetingNoteAccess[]) {
  await ensureFile(accessFile);
  await fs.writeFile(accessFile, JSON.stringify(rows, null, 2), "utf-8");
}

// --- Access helpers ---

export function noteCanView(
  note: MeetingNote,
  userId: string,
  role: string,
  accessList: MeetingNoteAccess[]
): boolean {
  if (role === "admin") return true;
  if (note.created_by === userId) return true;
  return accessList.some(
    (a) => a.meeting_note_id === note.id && a.user_id === userId
  );
}

export function noteCanEdit(note: MeetingNote, userId: string, role: string): boolean {
  return role === "admin" || note.created_by === userId;
}

// --- Queries ---

export async function getNotesForUser(
  userId: string,
  role: string
): Promise<MeetingNote[]> {
  const [notes, access] = await Promise.all([readAllNotes(), readAllAccess()]);
  return notes
    .filter((n) => noteCanView(n, userId, role, access))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getNoteById(id: string): Promise<MeetingNote | null> {
  const notes = await readAllNotes();
  return notes.find((n) => n.id === id) ?? null;
}

export async function getAccessForNote(noteId: string): Promise<MeetingNoteAccess[]> {
  const access = await readAllAccess();
  return access.filter((a) => a.meeting_note_id === noteId);
}

// --- Mutations ---

export async function createNote(input: {
  title: string;
  transcript: string;
  structured_content: string;
  created_by: string;
  logseq_saved?: boolean;
  logseq_path?: string | null;
}): Promise<MeetingNote> {
  const notes = await readAllNotes();
  const now = new Date().toISOString();
  const note: MeetingNote = {
    id: crypto.randomUUID(),
    title: input.title,
    transcript: input.transcript,
    structured_content: input.structured_content,
    created_by: input.created_by,
    created_at: now,
    updated_at: now,
    logseq_saved: input.logseq_saved ?? false,
    logseq_path: input.logseq_path ?? null,
  };
  notes.unshift(note);
  await writeNotes(notes);
  return note;
}

export async function updateNote(
  id: string,
  input: Partial<Pick<MeetingNote, "title" | "transcript" | "structured_content" | "logseq_saved" | "logseq_path">>
): Promise<MeetingNote | null> {
  const notes = await readAllNotes();
  const i = notes.findIndex((n) => n.id === id);
  if (i < 0) return null;
  notes[i] = { ...notes[i]!, ...input, updated_at: new Date().toISOString() };
  await writeNotes(notes);
  return notes[i]!;
}

export async function grantNoteAccess(input: {
  meeting_note_id: string;
  user_id: string;
  granted_by: string;
}): Promise<MeetingNoteAccess> {
  const access = await readAllAccess();
  const existing = access.find(
    (a) => a.meeting_note_id === input.meeting_note_id && a.user_id === input.user_id
  );
  if (existing) return existing;
  const row: MeetingNoteAccess = {
    id: crypto.randomUUID(),
    meeting_note_id: input.meeting_note_id,
    user_id: input.user_id,
    granted_by: input.granted_by,
    granted_at: new Date().toISOString(),
  };
  access.push(row);
  await writeAccess(access);
  return row;
}

export async function revokeNoteAccess(noteId: string, userId: string): Promise<boolean> {
  const access = await readAllAccess();
  const next = access.filter(
    (a) => !(a.meeting_note_id === noteId && a.user_id === userId)
  );
  if (next.length === access.length) return false;
  await writeAccess(next);
  return true;
}
