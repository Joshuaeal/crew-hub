"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Project } from "@/types/projects";
import { PROJECT_CATEGORIES, PROJECT_SERVICE_TYPES, PROJECT_STATUSES } from "@/types/projects";

const STATUS_COLORS: Record<string, string> = {
  Draft: "text-slate-400 bg-slate-500/15 ring-slate-500/25",
  Confirmed: "text-blue-300 bg-blue-500/15 ring-blue-500/25",
  "In Progress": "text-amber-300 bg-amber-500/15 ring-amber-500/25",
  Complete: "text-emerald-300 bg-emerald-500/15 ring-emerald-500/25",
  Cancelled: "text-red-300 bg-red-500/15 ring-red-500/25",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_COLORS[status] ?? "text-slate-400 bg-slate-500/15 ring-slate-500/25"}`}
    >
      {status}
    </span>
  );
}

function fmt(date?: string): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

type Props = {
  projects: Project[];
  canManage: boolean;
  clientNames: Record<string, string>;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ProjectsListClient({ projects, canManage, clientNames }: Props) {
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [sort, setSort] = useState<"name" | "start" | "status" | "updated">("updated");

  const clientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of projects) if (p.clientId) ids.add(p.clientId);
    return Array.from(ids);
  }, [projects]);

  const filtered = useMemo(() => {
    let list = [...projects];
    if (catFilter !== "all") list = list.filter((p) => p.category === catFilter);
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (serviceFilter !== "all")
      list = list.filter((p) => p.serviceTypes.includes(serviceFilter as never));
    if (clientFilter !== "all") list = list.filter((p) => p.clientId === clientFilter);

    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sort === "status") return a.status.localeCompare(b.status);
      if (sort === "start") {
        return (b.startDate ?? "").localeCompare(a.startDate ?? "");
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return list;
  }, [projects, catFilter, statusFilter, serviceFilter, clientFilter, sort]);

  return (
    <div className="space-y-4">
      {projects.length > 1 && (
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Category
            </label>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
            >
              <option value="all">All categories</option>
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
              className="mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
            >
              <option value="all">All statuses</option>
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
              className="mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
            >
              <option value="all">All types</option>
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
                className="mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
              >
                <option value="all">All clients</option>
                {clientIds.map((id) => (
                  <option key={id} value={id}>{clientNames[id] ?? id}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Sort
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
            >
              <option value="updated">Recently updated</option>
              <option value="start">Start date</option>
              <option value="name">Name (A–Z)</option>
              <option value="status">Status</option>
            </select>
          </div>
          <p className="text-xs text-slate-500">
            {filtered.length} of {projects.length}
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-sm text-slate-500">
          No projects match the current filters.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.slug}`}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-brand/25 hover:bg-white/[0.05] sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{p.name}</p>
                    <StatusBadge status={p.status} />
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-white/10">
                      {p.category}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {p.serviceTypes.join(" · ")}
                    {p.startDate && ` · ${fmt(p.startDate)}${p.endDate ? ` → ${fmt(p.endDate)}` : ""}`}
                    {p.clientId && clientNames[p.clientId] && ` · ${clientNames[p.clientId]}`}
                  </p>
                </div>
                <span className="mt-1 shrink-0 text-xs text-brand/80 sm:mt-0">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
