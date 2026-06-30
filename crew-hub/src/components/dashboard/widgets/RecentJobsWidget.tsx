"use client";

import { useEffect, useState } from "react";
import type { RecentJobsSettings } from "@/types/dashboard";
import type { Project } from "@/types/projects";

type Props = {
  settings: RecentJobsSettings;
  /** When set, only show jobs where this user is in the talent list */
  filterUserId?: string;
};

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Confirmed: "bg-blue-100 text-blue-700",
  "In Progress": "bg-amber-100 text-amber-700",
  Complete: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-600",
};

export function RecentJobsWidget({ settings, filterUserId }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects")
      .then((r) => r.json())
      .then(({ projects: all }: { projects: Project[] }) => {
        if (cancelled) return;
        const filtered = filterUserId
          ? all.filter((p) => p.talent?.some((t) => t.personId === filterUserId))
          : all;
        const sorted = [...filtered].sort(
          (a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime(),
        );
        setProjects(sorted.slice(0, settings.count));
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [settings.count]);

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      {projects.length === 0 ? (
        <div className="px-4 py-6 text-sm text-gray-400 text-center">No jobs yet.</div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {projects.map((p) => (
            <li key={p.id} className="px-4 py-2.5">
              <a href={`/projects/${p.slug}`} className="flex items-center justify-between gap-2 group">
                <span className="text-sm font-medium text-gray-800 group-hover:underline truncate">{p.name}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {p.status}
                </span>
              </a>
              {p.category && (
                <span className="text-xs text-gray-400">{p.category}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="px-4 py-2 border-t border-gray-100">
        <a href="/projects" className="text-xs text-blue-600 hover:underline">All jobs →</a>
      </div>
    </div>
  );
}
