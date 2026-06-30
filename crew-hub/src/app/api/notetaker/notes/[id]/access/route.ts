import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import {
  getAccessForNote,
  getNoteById,
  grantNoteAccess,
  noteCanEdit,
  noteCanView,
  readAllAccess,
} from "@/lib/notetaker-store";
import { readUsers } from "@/lib/users-store";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requirePermission("notetaker");
  if (!gate.ok) return gate.response;
  const { session } = gate;

  const note = await getNoteById(params.id);
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allAccess = await readAllAccess();
  if (!noteCanView(note, session.userId, session.role, allAccess)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!noteCanEdit(note, session.userId, session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const noteAccess = await getAccessForNote(params.id);
  const users = await readUsers();

  const enriched = noteAccess.map((a) => {
    const u = users.find((u) => u.id === a.user_id);
    return {
      ...a,
      username: u?.username ?? a.user_id,
      displayName: u?.displayName ?? u?.username ?? a.user_id,
    };
  });

  return NextResponse.json({ access: enriched });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const gate = await requirePermission("notetaker");
  if (!gate.ok) return gate.response;
  const { session } = gate;

  const note = await getNoteById(params.id);
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allAccess = await readAllAccess();
  if (!noteCanView(note, session.userId, session.role, allAccess)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!noteCanEdit(note, session.userId, session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userIds?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
    return NextResponse.json({ error: "userIds array is required" }, { status: 400 });
  }

  const granted = await Promise.all(
    body.userIds.map((userId) =>
      grantNoteAccess({
        meeting_note_id: params.id,
        user_id: userId,
        granted_by: session.userId,
      })
    )
  );

  return NextResponse.json({ granted });
}
