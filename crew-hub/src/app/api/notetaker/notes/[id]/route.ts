import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import {
  getNoteById,
  noteCanEdit,
  noteCanView,
  readAllAccess,
  updateNote,
} from "@/lib/notetaker-store";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requirePermission("notetaker");
  if (!gate.ok) return gate.response;
  const { session } = gate;

  const note = await getNoteById(params.id);
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await readAllAccess();
  if (!noteCanView(note, session.userId, session.role, access)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ note });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const gate = await requirePermission("notetaker");
  if (!gate.ok) return gate.response;
  const { session } = gate;

  const note = await getNoteById(params.id);
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await readAllAccess();
  if (!noteCanView(note, session.userId, session.role, access)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!noteCanEdit(note, session.userId, session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    title?: string;
    transcript?: string;
    structured_content?: string;
    logseq_saved?: boolean;
    logseq_path?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updated = await updateNote(params.id, {
    ...(body.title !== undefined ? { title: body.title.trim() } : {}),
    ...(body.transcript !== undefined ? { transcript: body.transcript } : {}),
    ...(body.structured_content !== undefined ? { structured_content: body.structured_content } : {}),
    ...(body.logseq_saved !== undefined ? { logseq_saved: body.logseq_saved } : {}),
    ...(body.logseq_path !== undefined ? { logseq_path: body.logseq_path } : {}),
  });

  return NextResponse.json({ note: updated });
}
