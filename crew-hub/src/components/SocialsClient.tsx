"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Users, Briefcase, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import type { SocialPost, SocialPlatformId } from "@/types/socials";
import { SOCIAL_PLATFORMS } from "@/types/socials";

function daysSince(dateStr: string): number {
  const posted = new Date(dateStr);
  const now = new Date();
  const ms = now.getTime() - posted.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function friendlyAge(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "1 month ago";
  return `${Math.floor(days / 30)} months ago`;
}

function PlatformIcon({ id, className }: { id: SocialPlatformId; className?: string }) {
  if (id === "instagram") return <Camera className={className} aria-hidden />;
  if (id === "facebook") return <Users className={className} aria-hidden />;
  return <Briefcase className={className} aria-hidden />;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type LogFormState = {
  platformId: SocialPlatformId;
  postedAt: string;
  note: string;
};

type EditState = { id: string; postedAt: string; note: string };

export function SocialsClient({
  initialPosts,
  canManage,
}: {
  initialPosts: SocialPost[];
  canManage: boolean;
}) {
  const [posts, setPosts] = useState<SocialPost[]>(initialPosts);
  const [logOpen, setLogOpen] = useState(false);
  const [logForm, setLogForm] = useState<LogFormState>({
    platformId: "instagram",
    postedAt: today(),
    note: "",
  });
  const [logBusy, setLogBusy] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const [editState, setEditState] = useState<EditState | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/socials/posts", { credentials: "same-origin" });
    if (r.ok) {
      const d = (await r.json()) as { posts: SocialPost[] };
      setPosts(d.posts);
    }
  }, []);

  useEffect(() => {
    if (logOpen && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [logOpen]);

  function openLog(platformId: SocialPlatformId) {
    setLogForm({ platformId, postedAt: today(), note: "" });
    setLogError(null);
    setLogOpen(true);
  }

  async function submitLog() {
    setLogBusy(true);
    setLogError(null);
    try {
      const r = await fetch("/api/socials/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          platformId: logForm.platformId,
          postedAt: logForm.postedAt,
          note: logForm.note.trim() || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as { error?: string }).error || "Failed to log post");
      await refresh();
      setLogOpen(false);
    } catch (e) {
      setLogError(e instanceof Error ? e.message : "Error");
    } finally {
      setLogBusy(false);
    }
  }

  async function submitEdit() {
    if (!editState) return;
    setEditBusy(true);
    try {
      const r = await fetch(`/api/socials/posts/${editState.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ postedAt: editState.postedAt, note: editState.note || undefined }),
      });
      if (r.ok) {
        await refresh();
        setEditState(null);
      }
    } finally {
      setEditBusy(false);
    }
  }

  async function confirmDelete(id: string) {
    setDeleteId(id);
    const r = await fetch(`/api/socials/posts/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (r.ok) await refresh();
    setDeleteId(null);
  }

  const lastPostByPlatform = new Map<SocialPlatformId, SocialPost>();
  for (const post of posts) {
    if (!lastPostByPlatform.has(post.platformId)) {
      lastPostByPlatform.set(post.platformId, post);
    }
  }

  const platforms = [...SOCIAL_PLATFORMS].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Socials</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manual log of when we last posted per platform.
          </p>
        </div>

        {/* Platform cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {platforms.map((platform) => {
            const last = lastPostByPlatform.get(platform.id);
            const days = last ? daysSince(last.postedAt) : null;
            const stale = days === null || days >= 7;
            return (
              <div
                key={platform.id}
                className={`rounded-xl border p-5 transition ${
                  stale
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <PlatformIcon
                    id={platform.id}
                    className={`h-5 w-5 shrink-0 ${stale ? "text-amber-400" : "text-slate-300"}`}
                  />
                  <span className={`text-sm font-semibold ${stale ? "text-amber-200" : "text-white"}`}>
                    {platform.name}
                  </span>
                </div>
                <div className="mt-3">
                  {last ? (
                    <>
                      <p className={`text-lg font-medium ${stale ? "text-amber-300" : "text-white"}`}>
                        {friendlyAge(days!)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{last.postedAt}</p>
                      {last.note && (
                        <p className="mt-1 truncate text-xs text-slate-400" title={last.note}>
                          {last.note}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-amber-400/80">No posts logged</p>
                  )}
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => openLog(platform.id)}
                    className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
                  >
                    <Plus className="h-3 w-3" aria-hidden />
                    Log a post
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Log form */}
        {canManage && logOpen && (
          <div ref={formRef} className="rounded-xl border border-brand/30 bg-brand/5 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Log a post</h2>
              <button
                type="button"
                onClick={() => setLogOpen(false)}
                className="text-slate-500 hover:text-slate-300"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400">Platform</label>
                <select
                  value={logForm.platformId}
                  onChange={(e) =>
                    setLogForm((f) => ({ ...f, platformId: e.target.value as SocialPlatformId }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                >
                  {platforms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400">Date posted</label>
                <input
                  type="date"
                  value={logForm.postedAt}
                  max={today()}
                  onChange={(e) => setLogForm((f) => ({ ...f, postedAt: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400">
                  Note <span className="text-slate-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={logForm.note}
                  onChange={(e) => setLogForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. BAS promo reel"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>
              {logError && (
                <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {logError}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={logBusy || !logForm.postedAt}
                  onClick={() => void submitLog()}
                  className="rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand/80 disabled:opacity-60"
                >
                  {logBusy ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setLogOpen(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Post history
          </h2>
          {posts.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-slate-500">
              No posts logged yet.
            </p>
          ) : (
            <div className="space-y-2">
              {posts.map((post) => {
                const platform = SOCIAL_PLATFORMS.find((p) => p.id === post.platformId);
                const isEditing = editState?.id === post.id;
                return (
                  <div
                    key={post.id}
                    className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="block text-xs text-slate-500">Date</label>
                            <input
                              type="date"
                              value={editState.postedAt}
                              max={today()}
                              onChange={(e) =>
                                setEditState((s) => s && { ...s, postedAt: e.target.value })
                              }
                              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs text-slate-500">Note</label>
                            <input
                              type="text"
                              value={editState.note}
                              onChange={(e) =>
                                setEditState((s) => s && { ...s, note: e.target.value })
                              }
                              placeholder="optional"
                              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={editBusy}
                            onClick={() => void submitEdit()}
                            className="flex items-center gap-1.5 rounded-lg bg-brand/90 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-60"
                          >
                            <Check className="h-3 w-3" />
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditState(null)}
                            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <PlatformIcon
                            id={post.platformId}
                            className="h-4 w-4 shrink-0 text-slate-400"
                          />
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-medium text-white">
                                {platform?.name ?? post.platformId}
                              </span>
                              <span className="text-xs text-slate-500">{post.postedAt}</span>
                            </div>
                            {post.note && (
                              <p className="mt-0.5 truncate text-xs text-slate-400">{post.note}</p>
                            )}
                            <p className="mt-0.5 text-xs text-slate-600">
                              Logged by {post.loggedBy}
                            </p>
                          </div>
                        </div>
                        {canManage && (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setEditState({
                                  id: post.id,
                                  postedAt: post.postedAt,
                                  note: post.note ?? "",
                                })
                              }
                              className="rounded p-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-300"
                              aria-label="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={deleteId === post.id}
                              onClick={() => void confirmDelete(post.id)}
                              className="rounded p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
