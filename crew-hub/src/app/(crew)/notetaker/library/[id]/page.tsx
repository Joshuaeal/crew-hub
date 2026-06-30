import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import {
  getNoteById,
  getAccessForNote,
  noteCanView,
  noteCanEdit,
  readAllAccess,
} from "@/lib/notetaker-store";
import { readUsers } from "@/lib/users-store";
import { MeetingNoteDetailClient } from "@/components/MeetingNoteDetailClient";

export default async function MeetingNoteDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect(`/login?next=/notetaker/library/${params.id}`);

  const [note, allAccess, users] = await Promise.all([
    getNoteById(params.id),
    readAllAccess(),
    readUsers(),
  ]);

  if (!note) notFound();
  if (!noteCanView(note, session.userId, session.role, allAccess)) notFound();

  const canEdit = noteCanEdit(note, session.userId, session.role);
  const noteAccess = await getAccessForNote(params.id);

  const userMap = Object.fromEntries(
    users.map((u) => [u.id, { username: u.username, displayName: u.displayName ?? u.username }])
  );

  const enrichedAccess = noteAccess.map((a) => ({
    ...a,
    username: userMap[a.user_id]?.username ?? a.user_id,
    displayName: userMap[a.user_id]?.displayName ?? a.user_id,
  }));

  const allUsersForPicker = users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName ?? u.username,
  }));

  return (
    <MeetingNoteDetailClient
      note={note}
      canEdit={canEdit}
      creatorName={userMap[note.created_by]?.displayName ?? userMap[note.created_by]?.username ?? note.created_by}
      noteAccess={enrichedAccess}
      allUsers={allUsersForPicker}
    />
  );
}
