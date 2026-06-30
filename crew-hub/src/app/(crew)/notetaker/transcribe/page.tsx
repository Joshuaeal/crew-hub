import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { NotetakerTranscribeClient } from "@/components/NotetakerTranscribeClient";

export default async function NotetakerTranscribePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/notetaker/transcribe");
  return <NotetakerTranscribeClient />;
}
