"use client";

import { useEffect, useState } from "react";
import type { UpcomingSettings } from "@/types/dashboard";
import type { Project } from "@/types/projects";
import type { Shift } from "@/types/shift";
import type { InventoryCheckoutRequest } from "@/types/inventory";
import { LOOKAHEAD_OPTIONS } from "@/lib/widget-registry";

type UpcomingItem =
  | { kind: "milestone"; id: string; title: string; date: string; jobName: string; jobSlug: string; overdue: boolean }
  | { kind: "shift"; id: string; title: string; date: string; overdue: boolean }
  | { kind: "approval"; id: string; title: string; date: string; overdue: boolean };

function lookaheadMs(w: UpcomingSettings["lookahead"]): number {
  const DAY = 86400000;
  switch (w) {
    case "2wk": return 14 * DAY;
    case "4wk": return 28 * DAY;
    case "8wk": return 56 * DAY;
    case "3mo": return 91 * DAY;
    case "6mo": return 182 * DAY;
  }
}

function badgeColor(kind: UpcomingItem["kind"]) {
  switch (kind) {
    case "milestone": return "bg-blue-100 text-blue-700";
    case "shift": return "bg-green-100 text-green-700";
    case "approval": return "bg-amber-100 text-amber-700";
  }
}

function badgeLabel(kind: UpcomingItem["kind"]) {
  switch (kind) {
    case "milestone": return "Milestone";
    case "shift": return "Shift";
    case "approval": return "Approval";
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type Props = {
  settings: UpcomingSettings;
  userEmail: string;
  isAdmin: boolean;
  canViewInventory: boolean;
  canViewProjects: boolean;
};

export function UpcomingWidget({ settings, userEmail, isAdmin, canViewInventory, canViewProjects }: Props) {
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const now = Date.now();
    const windowEnd = now + lookaheadMs(settings.lookahead);

    async function load() {
      const fetches: Promise<void>[] = [];
      const collected: UpcomingItem[] = [];

      if (canViewProjects) {
        fetches.push(
          fetch("/api/projects").then(async (r) => {
            if (!r.ok) return;
            const { projects } = (await r.json()) as { projects: Project[] };
            const today = new Date().toISOString().slice(0, 10);
            for (const p of projects) {
              if (p.status === "Cancelled" || p.status === "Complete") continue;
              for (const m of p.milestones ?? []) {
                if (m.status === "Done") continue;
                const mDate = new Date(m.dueDate).getTime();
                const overdue = m.dueDate < today;
                if (overdue || (mDate >= now && mDate <= windowEnd)) {
                  collected.push({
                    kind: "milestone",
                    id: m.id,
                    title: m.title,
                    date: m.dueDate,
                    jobName: p.name,
                    jobSlug: p.slug,
                    overdue,
                  });
                }
              }
            }
          }).catch(() => {}),
        );
      }

      fetches.push(
        fetch("/api/shifts").then(async (r) => {
          if (!r.ok) return;
          const { shifts } = (await r.json()) as { shifts: Shift[] };
          const today = new Date().toISOString().slice(0, 10);
          for (const s of shifts) {
            const assignedToMe =
              s.assignedEmails?.includes(userEmail) ||
              s.claims?.some((c) => c.email === userEmail && c.status === "approved");
            if (!assignedToMe) continue;
            const sDate = new Date(s.startAt).getTime();
            const overdue = s.startAt.slice(0, 10) < today;
            if (overdue || (sDate >= now && sDate <= windowEnd)) {
              collected.push({
                kind: "shift",
                id: s.id,
                title: s.title,
                date: s.startAt,
                overdue,
              });
            }
          }
        }).catch(() => {}),
      );

      if (canViewInventory || isAdmin) {
        fetches.push(
          fetch("/api/inventory/checkout-requests").then(async (r) => {
            if (!r.ok) return;
            const { items: reqs } = (await r.json()) as { items: InventoryCheckoutRequest[] };
            for (const req of reqs) {
              if (req.status !== "pending") continue;
              collected.push({
                kind: "approval",
                id: req.id,
                title: `Checkout request — item ${req.itemId}`,
                date: req.createdAt,
                overdue: false,
              });
            }
          }).catch(() => {}),
        );
      }

      await Promise.all(fetches);
      if (!cancelled) {
        collected.sort((a, b) => {
          if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
        setItems(collected);
        setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [settings.lookahead, userEmail, isAdmin, canViewInventory, canViewProjects]);

  const windowLabel = LOOKAHEAD_OPTIONS.find((o) => o.value === settings.lookahead)?.label ?? settings.lookahead;

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading…</div>;
  if (error) return <div className="p-4 text-sm text-red-500">{error}</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-xs text-gray-500">Next {windowLabel}</span>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-6 text-sm text-gray-400 text-center">Nothing upcoming in this window.</div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className={`px-4 py-2.5 flex items-start gap-3 ${item.overdue ? "bg-red-50" : ""}`}>
              <span className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeColor(item.kind)}`}>
                {badgeLabel(item.kind)}
              </span>
              <div className="flex-1 min-w-0">
                {item.kind === "milestone" ? (
                  <a href={`/projects/${item.jobSlug}`} className="text-sm font-medium text-gray-800 hover:underline truncate block">
                    {item.title}
                    <span className="ml-1 text-xs text-gray-500 font-normal">— {item.jobName}</span>
                  </a>
                ) : item.kind === "shift" ? (
                  <a href="/shifts" className="text-sm font-medium text-gray-800 hover:underline truncate block">
                    {item.title}
                  </a>
                ) : (
                  <a href="/inventory/requests" className="text-sm font-medium text-gray-800 hover:underline truncate block">
                    {item.title}
                  </a>
                )}
                <span className={`text-xs ${item.overdue ? "text-red-600 font-medium" : "text-gray-400"}`}>
                  {item.overdue ? "Overdue · " : ""}{formatDate(item.date)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
