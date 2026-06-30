import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import {
  getNoteById,
  noteCanEdit,
  noteCanView,
  readAllAccess,
  revokeNoteAccess,
} from "@/lib/notetaker-store";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } }
) {
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

  await revokeNoteAccess(params.id, params.userId);
  return NextResponse.json({ ok: true });
}
