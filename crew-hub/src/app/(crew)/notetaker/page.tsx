import Link from "next/link";
import { BookOpen, Mic } from "lucide-react";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getNotesForUser } from "@/lib/notetaker-store";

export default async function NotetakerPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/notetaker");

  const notes = await getNotesForUser(session.userId, session.role);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/" className="text-sm text-brand/90 hover:text-brand/80">
            ← Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Notetaker
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Capture meeting audio, generate structured notes, and browse your library.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          <li>
            <Link
              href="/notetaker/library"
              className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/30 hover:bg-white/[0.06]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand/70 ring-1 ring-brand/25">
                <BookOpen className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold text-white">Meeting Notes Library</h2>
              <p className="mt-1 text-sm text-slate-500">
                {notes.length === 0
                  ? "No notes yet."
                  : `${notes.length} note${notes.length === 1 ? "" : "s"} — yours and shared with you`}
              </p>
            </Link>
          </li>

          <li>
            <Link
              href="/notetaker/transcribe"
              className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/30 hover:bg-white/[0.06]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand/70 ring-1 ring-brand/25">
                <Mic className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold text-white">Transcribe</h2>
              <p className="mt-1 text-sm text-slate-500">
                Record audio, transcribe via Whisper, and save the result to your notes library.
              </p>
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
