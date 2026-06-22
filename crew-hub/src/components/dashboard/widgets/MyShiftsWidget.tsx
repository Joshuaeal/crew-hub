"use client";

import { useEffect, useState } from "react";
import type { MyShiftsSettings } from "@/types/dashboard";
import type { Shift } from "@/types/shift";
import { LOOKAHEAD_OPTIONS } from "@/lib/widget-registry";

type Props = {
  settings: MyShiftsSettings;
  userEmail: string;
};

function lookaheadMs(w: MyShiftsSettings["lookahead"]): number {
  const DAY = 86400000;
  switch (w) {
    case "2wk": return 14 * DAY;
    case "4wk": return 28 * DAY;
    case "8wk": return 56 * DAY;
    case "3mo": return 91 * DAY;
    case "6mo": return 182 * DAY;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function MyShiftsWidget({ settings, userEmail }: Props) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    const windowEnd = now + lookaheadMs(settings.lookahead);

    fetch("/api/shifts")
      .then((r) => r.json())
      .then(({ shifts: all }: { shifts: Shift[] }) => {
        if (cancelled) return;
        const mine = all.filter((s) => {
          const assignedToMe =
            s.assignedEmails?.includes(userEmail) ||
            s.claims?.some((c) => c.email === userEmail && c.status === "approved");
          if (!assignedToMe) return false;
          const t = new Date(s.startAt).getTime();
          return t >= now && t <= windowEnd;
        });
        mine.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
        setShifts(mine);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [settings.lookahead, userEmail]);

  const windowLabel = LOOKAHEAD_OPTIONS.find((o) => o.value === settings.lookahead)?.label ?? settings.lookahead;

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-1">
        <span className="text-xs text-gray-500">Next {windowLabel}</span>
      </div>
      {shifts.length === 0 ? (
        <div className="px-4 py-6 text-sm text-gray-400 text-center">No shifts assigned in this window.</div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {shifts.map((s) => (
            <li key={s.id} className="px-4 py-2.5">
              <a href="/shifts" className="group">
                <div className="text-sm font-medium text-gray-800 group-hover:underline truncate">{s.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {formatDate(s.startAt)} · {formatTime(s.startAt)} – {formatTime(s.endAt)}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="px-4 py-2 border-t border-gray-100">
        <a href="/shifts" className="text-xs text-blue-600 hover:underline">All shifts →</a>
      </div>
    </div>
  );
}
