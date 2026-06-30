"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Search } from "lucide-react";
import type { MeetingNote } from "@/types/notetaker";

type Props = {
  notes: MeetingNote[];
  userMap: Record<string, { username: string; displayName: string }>;
  currentUserId: string;
  isAdmin: boolean;
};

export function MeetingNotesLibraryClient({ notes, userMap, currentUserId, isAdmin }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return notes;
    const q = query.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (userMap[n.created_by]?.displayName ?? "").toLowerCase().includes(q)
    );
  }, [notes, query, userMap]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/notetaker" className="text-sm text-brand/90 hover:text-brand/80">
            ← Notetaker
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Meeting Notes Library
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {notes.length === 0
              ? "No notes yet."
              : `${notes.length} note${notes.length === 1 ? "" : "s"} — yours and shared with you`}
          </p>
        </div>

        {notes.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
              placeholder="Search by title or creator…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-white/10 bg-black/10 text-sm text-slate-600">
            {query ? "No notes match that search." : "No meeting notes yet."}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((note) => {
              const creator = userMap[note.created_by];
              const isOwn = note.created_by === currentUserId;
              const shownByAdmin = isAdmin && !isOwn;

              return (
                <li key={note.id}>
                  <Link
                    href={`/notetaker/library/${note.id}`}
                    className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 transition hover:border-brand/30 hover:bg-white/[0.06]"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand/70 ring-1 ring-brand/20">
                        <BookOpen className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{note.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {new Date(note.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                          {(isAdmin || shownByAdmin) && creator && (
                            <span className="ml-2 text-slate-600">
                              · {creator.displayName || creator.username}
                              {shownByAdmin && (
                                <span className="ml-1 text-slate-700">(not yours)</span>
                              )}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {note.logseq_saved && (
                        <span
                          title="Saved to Logseq"
                          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-green-500/30 bg-green-500/10 text-green-400"
                        >
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                          Logseq
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
