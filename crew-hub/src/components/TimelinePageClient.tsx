"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Project } from "@/types/projects";
import { PROJECT_CATEGORIES, PROJECT_SERVICE_TYPES, PROJECT_STATUSES } from "@/types/projects";
import { GanttChart, type GanttTrack } from "@/components/GanttChart";

type Props = {
  projects: Project[];
  canManage: boolean;
  clientNames: Record<string, string>;
};

export function TimelinePageClient({ projects, canManage, clientNames }: Props) {
  const [catFilter, setCatFilter]       = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");

  const clientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of projects) if (p.clientId) ids.add(p.clientId);
    return Array.from(ids);
  }, [projects]);

  const filtered = useMemo(() => {
    let list = [...projects];
    if (catFilter !== "all")     list = list.filter((p) => p.category === catFilter);
    if (statusFilter !== "all")  list = list.filter((p) => p.status === statusFilter);
    if (serviceFilter !== "all") list = list.filter((p) => p.serviceTypes.includes(serviceFilter as never));
    if (clientFilter !== "all")  list = list.filter((p) => p.clientId === clientFilter);
    return list.sort((a, b) => {
      const aDate = a.startDate ?? a.createdAt;
      const bDate = b.startDate ?? b.createdAt;
      return aDate.localeCompare(bDate);
    });
  }, [projects, catFilter, statusFilter, serviceFilter, clientFilter]);

  const tracks: GanttTrack[] = filtered.map((p) => ({ // eslint-disable-line @typescript-eslint/no-unused-vars
    id:        p.id,
    slug:      p.slug,
    label:     p.name,
    status:    p.status,
    startDate: p.startDate,
    endDate:   p.endDate,
    canManage,
    milestones: p.milestones,
  }));

  // Optimistic update helpers — we hold the authoritative list in localProjects
  const [localProjects, setLocalProjects] = useState<Project[]>(projects);

  async function handleJobBarChange(
    slug: string,
    startDate: string | undefined,
    endDate: string | undefined,
  ) {
    const body: Record<string, string | null> = {};
    if (startDate !== undefined) body.startDate = startDate;
    if (endDate !== undefined)   body.endDate   = endDate;

    const res = await fetch(`/api/projects/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed to update project dates");
    const data = (await res.json()) as { project: Project };
    setLocalProjects((prev) => prev.map((p) => (p.slug === slug ? data.project : p)));
  }

  async function handleMilestoneDateChange(slug: string, milestoneId: string, dueDate: string) {
    const res = await fetch(`/api/projects/${slug}/milestones/${milestoneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate }),
    });
    if (!res.ok) throw new Error("Failed to update milestone");
    const data = (await res.json()) as { project: Project };
    setLocalProjects((prev) => prev.map((p) => (p.slug === slug ? data.project : p)));
  }

  // Build fresh tracks from localProjects (so optimistic updates propagate)
  const localFiltered = useMemo(() => {
    let list = [...localProjects];
    if (catFilter !== "all")     list = list.filter((p) => p.category === catFilter);
    if (statusFilter !== "all")  list = list.filter((p) => p.status === statusFilter);
    if (serviceFilter !== "all") list = list.filter((p) => p.serviceTypes.includes(serviceFilter as never));
    if (clientFilter !== "all")  list = list.filter((p) => p.clientId === clientFilter);
    return list.sort((a, b) => {
      const aDate = a.startDate ?? a.createdAt;
      const bDate = b.startDate ?? b.createdAt;
      return aDate.localeCompare(bDate);
    });
  }, [localProjects, catFilter, statusFilter, serviceFilter, clientFilter]);

  const localTracks: GanttTrack[] = localFiltered.map((p) => ({
    id:        p.id,
    slug:      p.slug,
    label:     p.name,
    status:    p.status,
    startDate: p.startDate,
    endDate:   p.endDate,
    canManage,
    milestones: p.milestones,
  }));

  const hasFilters = localProjects.length > 1;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-screen-xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Project Timeline</h1>
            <p className="mt-1 text-sm text-slate-400">All projects on a shared timeline.</p>
          </div>
          <Link
            href="/projects"
            className="text-sm text-slate-500 hover:text-slate-300"
          >
            ← Projects
          </Link>
        </div>

        {/* Filters */}
        {hasFilters && (
          <div className="flex flex-wrap items-end gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Category
              </label>
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="mt-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
              >
                <option value="all">All</option>
                {PROJECT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
              >
                <option value="all">All</option>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Service type
              </label>
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="mt-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
              >
                <option value="all">All</option>
                {PROJECT_SERVICE_TYPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {clientIds.length > 0 && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Client
                </label>
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="mt-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
                >
                  <option value="all">All</option>
                  {clientIds.map((id) => (
                    <option key={id} value={id}>{clientNames[id] ?? id}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {localTracks.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-sm text-slate-500">
            No projects match the current filters.
          </p>
        ) : (
          <GanttChart
            tracks={localTracks}
            mode="multi"
            onJobBarChange={handleJobBarChange}
            onMilestoneDateChange={handleMilestoneDateChange}
          />
        )}
      </div>
    </div>
  );
}
