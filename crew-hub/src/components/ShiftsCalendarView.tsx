"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Shift } from "@/types/shift";
import {
  buildMonthGrid,
  isToday,
  shiftsOverlappingDay,
} from "@/lib/shifts-calendar";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function statusStyle(s: Shift): string {
  if (s.status === "filled") return "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/30";
  if (s.status === "pending") return "bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/35";
  return "bg-brand/15 text-brand/95 ring-1 ring-brand/25";
}

type Props = {
  shifts: Shift[];
  statusLabel: (s: Shift) => string;
  /** When false, hide the footer hint (e.g. manage page). */
  showFooterHint?: boolean;
};

export function ShiftsCalendarView({
  shifts,
  statusLabel,
  showFooterHint = true,
}: Props) {
  const now = new Date();
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const label = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  function prevMonth() {
    setCursor(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCursor(new Date(year, month + 1, 1));
  }

  function goToday() {
    const t = new Date();
    setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="min-w-[10rem] text-center text-lg font-semibold text-white">{label}</h2>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={goToday}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10"
        >
          Today
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-px border-b border-white/10 bg-white/5">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500"
              >
                {wd}
              </div>
            ))}
          </div>
          {grid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-px border-b border-white/5 last:border-b-0">
              {week.map((day, di) => {
                if (!day) {
                  return <div key={`empty-${wi}-${di}`} className="min-h-[7rem] bg-black/20" />;
                }
                const dayShifts = shiftsOverlappingDay(shifts, day);
                const today = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`flex min-h-[7rem] flex-col gap-1 border-l border-white/5 p-1.5 first:border-l-0 ${
                      today ? "bg-brand/[0.07]" : "bg-black/10"
                    }`}
                  >
                    <div
                      className={`text-right text-xs font-medium tabular-nums ${
                        today ? "text-brand/80" : "text-slate-500"
                      }`}
                    >
                      {day.getDate()}
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                      {dayShifts.slice(0, 4).map((s) => (
                        <Link
                          key={s.id}
                          href={`/shifts/${s.id}`}
                          className={`block rounded-md px-1.5 py-1 text-[10px] leading-tight transition hover:ring-2 hover:ring-brand/40 ${statusStyle(s)}`}
                        >
                          <div className="truncate font-medium">{s.title}</div>
                          <div className="truncate text-[9px] opacity-90">
                            {new Date(s.startAt).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            {" · "}
                            {statusLabel(s)}
                          </div>
                        </Link>
                      ))}
                      {dayShifts.length > 4 && (
                        <p className="text-[9px] text-slate-500">+{dayShifts.length - 4} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {showFooterHint && (
        <p className="text-xs text-slate-600">
          Shifts span local days. Open a shift to see details and claim it.
        </p>
      )}
    </div>
  );
}
