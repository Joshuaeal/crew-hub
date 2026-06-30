import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getNotesForUser } from "@/lib/notetaker-store";
import { readUsers } from "@/lib/users-store";
import { MeetingNotesLibraryClient } from "@/components/MeetingNotesLibraryClient";

export default async function NotetakerLibraryPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/notetaker/library");

  const [notes, users] = await Promise.all([
    getNotesForUser(session.userId, session.role),
    readUsers(),
  ]);

  const userMap = Object.fromEntries(
    users.map((u) => [u.id, { username: u.username, displayName: u.displayName ?? u.username }])
  );

  return (
    <MeetingNotesLibraryClient
      notes={notes}
      userMap={userMap}
      currentUserId={session.userId}
      isAdmin={session.role === "admin"}
    />
  );
}
