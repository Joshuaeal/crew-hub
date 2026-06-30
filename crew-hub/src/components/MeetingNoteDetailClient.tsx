"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
  UserPlus,
} from "lucide-react";
import type { MeetingNote, MeetingNoteAccess } from "@/types/notetaker";

type EnrichedAccess = MeetingNoteAccess & { username: string; displayName: string };

type Props = {
  note: MeetingNote;
  canEdit: boolean;
  creatorName: string;
  noteAccess: EnrichedAccess[];
  allUsers: { id: string; username: string; displayName: string }[];
};

export function MeetingNoteDetailClient({
  note,
  canEdit,
  creatorName,
  noteAccess: initialAccess,
  allUsers,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Editable fields
  const [title, setTitle] = useState(note.title);
  const [structuredContent, setStructuredContent] = useState(note.structured_content);
  const [transcript, setTranscript] = useState(note.transcript);
  const [logseqSaved, setLogseqSaved] = useState(note.logseq_saved);
  const [logseqPath, setLogseqPath] = useState(note.logseq_path ?? "");
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Transcript expand/collapse
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  // Access management
  const [access, setAccess] = useState<EnrichedAccess[]>(initialAccess);
  const [shareSearch, setShareSearch] = useState("");
  const [sharePickerOpen, setSharePickerOpen] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setSharePickerOpen(false);
      }
    }
    if (sharePickerOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sharePickerOpen]);

  const grantedUserIds = new Set(access.map((a) => a.user_id));
  const eligibleUsers = allUsers.filter(
    (u) => u.id !== note.created_by && !grantedUserIds.has(u.id)
  );
  const filteredPicker = shareSearch.trim()
    ? eligibleUsers.filter(
        (u) =>
          u.displayName.toLowerCase().includes(shareSearch.toLowerCase()) ||
          u.username.toLowerCase().includes(shareSearch.toLowerCase())
      )
    : eligibleUsers;

  async function handleSave() {
    setSaveError(null);
    startTransition(async () => {
      const res = await fetch(`/api/notetaker/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          structured_content: structuredContent,
          transcript,
          logseq_saved: logseqSaved,
          logseq_path: logseqPath.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setSaveError(j.error ?? "Failed to save");
        return;
      }
      setDirty(false);
      router.refresh();
    });
  }

  async function handleGrant(userId: string) {
    setShareError(null);
    const res = await fetch(`/api/notetaker/notes/${note.id}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [userId] }),
    });
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      setShareError(j.error ?? "Failed to grant access");
      return;
    }
    const j = (await res.json()) as { granted: EnrichedAccess[] };
    // Optimistic: add the user to local access state
    const user = allUsers.find((u) => u.id === userId);
    if (user && j.granted[0]) {
      setAccess((prev) => [
        ...prev,
        {
          ...j.granted[0]!,
          username: user.username,
          displayName: user.displayName,
        },
      ]);
    }
    setShareSearch("");
    setSharePickerOpen(false);
  }

  async function handleRevoke(userId: string) {
    setShareError(null);
    const res = await fetch(`/api/notetaker/notes/${note.id}/access/${userId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      setShareError(j.error ?? "Failed to revoke access");
      return;
    }
    setAccess((prev) => prev.filter((a) => a.user_id !== userId));
  }

  function markDirty() {
    setDirty(true);
    setSaveError(null);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Breadcrumb */}
        <div>
          <Link href="/notetaker/library" className="text-sm text-brand/90 hover:text-brand/80">
            ← Meeting Notes Library
          </Link>
        </div>

        {/* Title */}
        <div className="space-y-1">
          {canEdit ? (
            <input
              className="w-full bg-transparent text-2xl font-semibold tracking-tight text-white outline-none placeholder:text-slate-600 focus:ring-0 sm:text-3xl"
              value={title}
              onChange={(e) => { setTitle(e.target.value); markDirty(); }}
              placeholder="Note title"
            />
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>
              {new Date(note.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span>·</span>
            <span>by {creatorName}</span>
            {logseqSaved && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-green-400">
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                  Saved to Logseq{logseqPath ? ` (${logseqPath})` : ""}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Structured content */}
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Structured Notes
          </p>
          {canEdit ? (
            <textarea
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-slate-200 outline-none focus:ring-1 focus:ring-brand/40 resize-y min-h-[24rem]"
              value={structuredContent}
              onChange={(e) => { setStructuredContent(e.target.value); markDirty(); }}
              placeholder="Logseq-formatted markdown will appear here…"
            />
          ) : (
            <pre className="w-full overflow-x-auto rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-slate-200 whitespace-pre-wrap">
              {structuredContent || <span className="text-slate-600">No structured content.</span>}
            </pre>
          )}
        </section>

        {/* Raw transcript (collapsible) */}
        <section>
          <button
            type="button"
            onClick={() => setTranscriptExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition"
          >
            {transcriptExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            )}
            Raw Transcript
          </button>
          {transcriptExpanded && (
            <div className="mt-2">
              {canEdit ? (
                <textarea
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-slate-400 outline-none focus:ring-1 focus:ring-brand/40 resize-y min-h-[12rem]"
                  value={transcript}
                  onChange={(e) => { setTranscript(e.target.value); markDirty(); }}
                  placeholder="Raw transcript text…"
                />
              ) : (
                <pre className="w-full overflow-x-auto rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-slate-400 whitespace-pre-wrap">
                  {transcript || <span className="text-slate-600">No transcript.</span>}
                </pre>
              )}
            </div>
          )}
        </section>

        {/* Logseq fields (edit only) */}
        {canEdit && (
          <section className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Logseq
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={logseqSaved}
                onChange={(e) => { setLogseqSaved(e.target.checked); markDirty(); }}
                className="accent-brand/90"
              />
              Saved to Logseq vault
            </label>
            {logseqSaved && (
              <div>
                <label className="text-xs text-slate-500">Logseq path (optional)</label>
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand/40"
                  value={logseqPath}
                  onChange={(e) => { setLogseqPath(e.target.value); markDirty(); }}
                  placeholder="e.g. journals/2026-06-30"
                />
              </div>
            )}
          </section>
        )}

        {/* Save button */}
        {canEdit && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!dirty || isPending}
              className="rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand disabled:opacity-40"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                "Save changes"
              )}
            </button>
            {saveError && <p className="text-xs text-red-400">{saveError}</p>}
            {!dirty && !isPending && !saveError && (
              <p className="text-xs text-slate-600">Up to date</p>
            )}
          </div>
        )}

        {/* Sharing section (edit users only) */}
        {canEdit && (
          <section className="space-y-3 border-t border-white/10 pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Shared with</p>
                <p className="text-xs text-slate-500">
                  These users can view this note. The creator and admins always have access.
                </p>
              </div>
              <div className="relative" ref={pickerRef}>
                <button
                  type="button"
                  onClick={() => setSharePickerOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 transition"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden />
                  Share with…
                </button>

                {sharePickerOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-white/10 bg-slate-900 shadow-xl">
                    <div className="p-2 border-b border-white/10">
                      <input
                        autoFocus
                        className="w-full rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-sm text-white outline-none placeholder:text-slate-600"
                        placeholder="Search users…"
                        value={shareSearch}
                        onChange={(e) => setShareSearch(e.target.value)}
                      />
                    </div>
                    <ul className="max-h-48 overflow-y-auto py-1">
                      {filteredPicker.length === 0 ? (
                        <li className="px-3 py-2 text-xs text-slate-600">
                          {shareSearch ? "No matching users" : "No users to add"}
                        </li>
                      ) : (
                        filteredPicker.map((u) => (
                          <li key={u.id}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5 transition"
                              onClick={() => void handleGrant(u.id)}
                            >
                              {u.displayName}
                              {u.displayName !== u.username && (
                                <span className="ml-1 text-xs text-slate-500">@{u.username}</span>
                              )}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {shareError && (
              <p className="text-xs text-red-400">{shareError}</p>
            )}

            {access.length === 0 ? (
              <p className="text-sm text-slate-600">No users have been granted access yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {access.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white">{a.displayName}</p>
                      {a.displayName !== a.username && (
                        <p className="text-xs text-slate-500">@{a.username}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRevoke(a.user_id)}
                      title="Revoke access"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-white/10 hover:text-red-400 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
