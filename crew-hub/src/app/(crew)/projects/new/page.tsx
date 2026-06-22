"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import {
  PROJECT_CATEGORIES,
  PROJECT_SERVICE_TYPES,
  PROJECT_STATUSES,
  type ProjectTemplate,
} from "@/types/projects";

type DraftMilestone = {
  key: string;
  title: string;
  dueDate: string;
  offsetDays: number;
  isTemplateDefault: boolean;
};

function offsetLabel(days: number): string {
  if (days === 0) return "Day 0 (start)";
  return `+${days} day${days !== 1 ? "s" : ""}`;
}

function applyOffset(startDate: string, offsetDays: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function NewProjectPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(PROJECT_CATEGORIES[0]);
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("Draft");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Templates
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>("");

  // Milestone draft
  const [milestones, setMilestones] = useState<DraftMilestone[]>([]);
  const [msTitle, setMsTitle] = useState("");
  const [msDue, setMsDue] = useState("");

  useEffect(() => {
    fetch("/api/project-templates", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: { templates?: ProjectTemplate[] }) => {
        if (Array.isArray(d.templates)) setTemplates(d.templates);
      })
      .catch(() => undefined);
  }, []);

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (!id) {
      setMilestones([]);
      return;
    }
    const tmpl = templates.find((t) => t.id === id);
    if (!tmpl) return;
    if (tmpl.defaultCategory) setCategory(tmpl.defaultCategory);
    if (tmpl.defaultServiceTypes && tmpl.defaultServiceTypes.length > 0)
      setServiceTypes(tmpl.defaultServiceTypes);
    const sorted = [...tmpl.milestones].sort((a, b) => a.sortOrder - b.sortOrder);
    setMilestones(
      sorted.map((m) => ({
        key: crypto.randomUUID(),
        title: m.title,
        offsetDays: m.offsetDaysFromStart,
        dueDate: startDate ? applyOffset(startDate, m.offsetDaysFromStart) : "",
        isTemplateDefault: true,
      }))
    );
  }

  function handleStartDateChange(val: string) {
    setStartDate(val);
    if (val) {
      setMilestones((prev) =>
        prev.map((m) => ({
          ...m,
          dueDate: applyOffset(val, m.offsetDays),
        }))
      );
      if (msDue === "" && !templateId) {
        // leave blank
      }
    }
  }

  function updateMilestone(key: string, patch: Partial<DraftMilestone>) {
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.key !== key) return m;
        const next = { ...m, ...patch };
        if (patch.dueDate !== undefined || patch.title !== undefined) {
          const titleChanged = patch.title !== undefined && patch.title !== m.title;
          const dateChanged = patch.dueDate !== undefined && patch.dueDate !== m.dueDate;
          if (titleChanged || dateChanged) next.isTemplateDefault = false;
        }
        return next;
      })
    );
  }

  function removeMilestone(key: string) {
    setMilestones((prev) => prev.filter((m) => m.key !== key));
  }

  function moveMilestone(key: string, dir: -1 | 1) {
    setMilestones((prev) => {
      const idx = prev.findIndex((m) => m.key === key);
      const swap = idx + dir;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  function addManualMilestone() {
    const t = msTitle.trim();
    if (!t || !msDue) return;
    setMilestones((prev) => [
      ...prev,
      { key: crypto.randomUUID(), title: t, dueDate: msDue, offsetDays: 0, isTemplateDefault: false },
    ]);
    setMsTitle("");
    setMsDue(startDate || "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setErr("Name is required."); return; }
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        name: trimmed,
        category,
        serviceTypes,
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        templateId: templateId || undefined,
      };
      if (milestones.length > 0) {
        body.milestones = milestones
          .filter((m) => m.dueDate)
          .map((m) => ({ title: m.title, dueDate: m.dueDate, isTemplateDefault: m.isTemplateDefault }));
      }
      const r = await fetch("/api/projects", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      router.push(`/projects/${(d.project as { slug: string }).slug}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Projects
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">New project</h1>
        </div>

        {err && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {err}
          </div>
        )}

        <form onSubmit={(e) => void submit(e)} className="space-y-5">
          {/* Template selector */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Start from a template
              </label>
              <select
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
              >
                <option value="">Start blank</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {templates.length === 0 && (
                <p className="mt-1 text-xs text-slate-500">No templates yet.</p>
              )}
            </div>
            <Link
              href="/projects/templates"
              className="inline-block text-xs text-slate-500 hover:text-slate-300"
            >
              Manage templates →
            </Link>
          </div>

          {/* Core fields */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Project name <span className="text-red-400">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ACME Corp Broadcast 2026"
                required
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-300">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                >
                  {PROJECT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                >
                  {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">Service types</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PROJECT_SERVICE_TYPES.map((st) => {
                  const checked = serviceTypes.includes(st);
                  return (
                    <label
                      key={st}
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition ${checked ? "border-brand/40 bg-brand/15 text-brand/90" : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20"}`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={(e) =>
                          setServiceTypes((prev) =>
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
          </div>

          {/* Milestone preview */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-300">Milestones</p>
              {!startDate && milestones.length > 0 && (
                <span className="text-xs text-slate-500">Set a start date to resolve dates</span>
              )}
            </div>

            {milestones.length > 0 && (
              <ul className="space-y-2">
                {milestones.map((m, idx) => (
                  <li
                    key={m.key}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  >
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveMilestone(m.key, -1)}
                        className="rounded p-0.5 text-slate-600 hover:text-white disabled:opacity-20"
                        aria-label="Move up"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === milestones.length - 1}
                        onClick={() => moveMilestone(m.key, 1)}
                        className="rounded p-0.5 text-slate-600 hover:text-white disabled:opacity-20"
                        aria-label="Move down"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1 grid gap-1.5 sm:grid-cols-2">
                      <input
                        value={m.title}
                        onChange={(e) => updateMilestone(m.key, { title: e.target.value })}
                        className="rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-white outline-none focus:ring-1 focus:ring-brand/40"
                        placeholder="Milestone title"
                      />
                      {startDate ? (
                        <input
                          type="date"
                          value={m.dueDate}
                          onChange={(e) => updateMilestone(m.key, { dueDate: e.target.value })}
                          className="rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-white outline-none focus:ring-1 focus:ring-brand/40"
                        />
                      ) : (
                        <span className="flex items-center px-2 text-xs text-slate-500">
                          {offsetLabel(m.offsetDays)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMilestone(m.key)}
                      className="shrink-0 rounded p-1 text-slate-500 hover:bg-red-500/15 hover:text-red-300"
                      aria-label="Remove milestone"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add manual milestone */}
            <div className="flex flex-wrap items-end gap-2 pt-1">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-[10px] text-slate-500">Milestone title</label>
                <input
                  value={msTitle}
                  onChange={(e) => setMsTitle(e.target.value)}
                  placeholder="e.g. Gear loaded"
                  className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500">Due date</label>
                <input
                  type="date"
                  value={msDue}
                  onChange={(e) => setMsDue(e.target.value)}
                  className="mt-0.5 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>
              <button
                type="button"
                disabled={!msTitle.trim() || !msDue}
                onClick={addManualMilestone}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand/80 disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create project"}
            </button>
            <Link
              href="/projects"
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
