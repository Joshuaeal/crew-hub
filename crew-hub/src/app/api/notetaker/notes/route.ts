import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { createNote, getNotesForUser } from "@/lib/notetaker-store";

export async function GET() {
  const gate = await requirePermission("notetaker");
  if (!gate.ok) return gate.response;
  const { session } = gate;

  const notes = await getNotesForUser(session.userId, session.role);
  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  const gate = await requirePermission("notetaker");
  if (!gate.ok) return gate.response;
  const { session } = gate;

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

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const note = await createNote({
    title: body.title.trim(),
    transcript: body.transcript ?? "",
    structured_content: body.structured_content ?? "",
    created_by: session.userId,
    logseq_saved: body.logseq_saved,
    logseq_path: body.logseq_path,
  });

  return NextResponse.json({ note }, { status: 201 });
}
