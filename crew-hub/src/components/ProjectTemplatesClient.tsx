"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { ProjectTemplate } from "@/types/projects";
import { PROJECT_CATEGORIES, PROJECT_SERVICE_TYPES } from "@/types/projects";

type Props = {
  initialTemplates: ProjectTemplate[];
};

export function ProjectTemplatesClient({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>(initialTemplates);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New template form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState("");
  const [newServices, setNewServices] = useState<string[]>([]);

  // Add milestone form per template
  const [msTitle, setMsTitle] = useState("");
  const [msOffset, setMsOffset] = useState("0");

  function flash(msg: string, isErr = false) {
    if (isErr) { setErr(msg); setOk(null); }
    else { setOk(msg); setErr(null); }
    window.setTimeout(() => { setErr(null); setOk(null); }, 3000);
  }

  async function createTemplate() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const r = await fetch("/api/project-templates", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newDesc || undefined,
          defaultCategory: newCat || undefined,
          defaultServiceTypes: newServices,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setTemplates((prev) => [d.template as ProjectTemplate, ...prev]);
      setShowForm(false);
      setNewName(""); setNewDesc(""); setNewCat(""); setNewServices([]);
      flash("Template created.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Failed", true);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplate(id: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/project-templates/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error("Delete failed");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      flash("Template deleted.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Failed", true);
    } finally {
      setBusy(false);
    }
  }

  async function addMilestone(templateId: string) {
    const title = msTitle.trim();
    if (!title) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/project-templates/${templateId}/milestones`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, offsetDaysFromStart: parseInt(msOffset, 10) || 0 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? (d.template as ProjectTemplate) : t))
      );
      setMsTitle(""); setMsOffset("0");
      flash("Milestone added.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Failed", true);
    } finally {
      setBusy(false);
    }
  }

  async function deleteMilestone(templateId: string, milestoneId: string) {
    const r = await fetch(`/api/project-templates/${templateId}/milestones/${milestoneId}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const d = await r.json();
    if (r.ok)
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? (d.template as ProjectTemplate) : t))
      );
  }

  async function moveMilestone(templateId: string, milestoneId: string, dir: -1 | 1) {
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;
    const sorted = [...tmpl.milestones].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((m) => m.id === milestoneId);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];
    const reordered = sorted.map((m) => {
      if (m.id === a.id) return { ...m, sortOrder: b.sortOrder };
      if (m.id === b.id) return { ...m, sortOrder: a.sortOrder };
      return m;
    });

    const r = await fetch(`/api/project-templates/${templateId}/milestones`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestones: reordered }),
    });
    const d = await r.json();
    if (r.ok)
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? (d.template as ProjectTemplate) : t))
      );
  }

  return (
    <div className="space-y-4">
      {(err || ok) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${err ? "border-red-500/40 bg-red-500/10 text-red-100" : "border-emerald-500/35 bg-emerald-500/10 text-emerald-100"}`}
        >
          {err || ok}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
      >
        <Plus className="h-4 w-4" aria-hidden />
        {showForm ? "Cancel" : "New template"}
      </button>

      {showForm && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-slate-400">Template name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Standard Broadcast"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400">Default category (optional)</label>
              <select
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
              >
                <option value="">None</option>
                {PROJECT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400">Description (optional)</label>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400">Default service types</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROJECT_SERVICE_TYPES.map((st) => {
                const checked = newServices.includes(st);
                return (
                  <label
                    key={st}
                    className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs transition ${checked ? "border-brand/40 bg-brand/15 text-brand/90" : "border-white/10 bg-white/[0.02] text-slate-400"}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={(e) =>
                        setNewServices((prev) =>
                          e.target.checked ? [...prev, st] : prev.filter((s) => s !== st)
                        )
                      }
                    />
                    {st}
                  </label>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            disabled={busy || !newName.trim()}
            onClick={() => void createTemplate()}
            className="rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand/80 disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create template"}
          </button>
        </div>
      )}

      {templates.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-sm text-slate-500">
          No templates yet. Create one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => {
            const isOpen = expandedId === t.id;
            const sortedMs = [...t.milestones].sort((a, b) => a.sortOrder - b.sortOrder);
            return (
              <li
                key={t.id}
                className="rounded-xl border border-white/10 bg-white/[0.02]"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : t.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-medium text-white">{t.name}</p>
                    {t.description && (
                      <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-600">
                      {t.defaultCategory && `${t.defaultCategory} · `}
                      {t.milestones.length} milestone{t.milestones.length !== 1 ? "s" : ""}
                      {t.defaultServiceTypes && t.defaultServiceTypes.length > 0 && ` · ${t.defaultServiceTypes.join(", ")}`}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : t.id)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-white"
                      aria-label={isOpen ? "Collapse" : "Expand"}
                    >
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteTemplate(t.id)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                      aria-label="Delete template"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-white/10 px-4 py-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Milestones
                    </p>
                    {sortedMs.length === 0 ? (
                      <p className="text-xs text-slate-600">No milestones on this template.</p>
                    ) : (
                      <ul className="space-y-1">
                        {sortedMs.map((m, idx) => (
                          <li
                            key={m.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-white">{m.title}</p>
                              <p className="text-xs text-slate-500">
                                Day {m.offsetDaysFromStart} from start
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => void moveMilestone(t.id, m.id, -1)}
                                className="rounded p-1 text-slate-500 hover:text-white disabled:opacity-25"
                                aria-label="Move up"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === sortedMs.length - 1}
                                onClick={() => void moveMilestone(t.id, m.id, 1)}
                                className="rounded p-1 text-slate-500 hover:text-white disabled:opacity-25"
                                aria-label="Move down"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteMilestone(t.id, m.id)}
                                className="rounded p-1 text-slate-500 hover:bg-red-500/15 hover:text-red-300"
                                aria-label="Remove"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex flex-wrap items-end gap-2 pt-1">
                      <div>
                        <label className="block text-[10px] text-slate-500">Milestone title</label>
                        <input
                          value={msTitle}
                          onChange={(e) => setMsTitle(e.target.value)}
                          placeholder="e.g. Gear loaded"
                          className="mt-0.5 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500">Day offset</label>
                        <input
                          value={msOffset}
                          onChange={(e) => setMsOffset(e.target.value)}
                          type="number"
                          min="0"
                          className="mt-0.5 w-20 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={busy || !msTitle.trim()}
                        onClick={() => void addMilestone(t.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-60"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden /> Add
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
