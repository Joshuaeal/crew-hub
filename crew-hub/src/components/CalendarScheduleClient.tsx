"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CrewCalendarEvent } from "@/types/calendar-event";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

type ProjectEntry = {
  id: string;
  slug: string;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
};

type Props = {
  initialItems: CrewCalendarEvent[];
  projects: ProjectEntry[];
  combinedFeedUrl: string | null;
  scheduleFeedUrl: string | null;
  shiftsFeedUrl: string | null;
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-slate-500/70 text-slate-100",
  Confirmed: "bg-blue-500/80 text-blue-50",
  "In Progress": "bg-amber-500/80 text-amber-950",
  Complete: "bg-emerald-500/80 text-emerald-950",
};

function projectColor(status: string): string {
  return PROJECT_STATUS_COLORS[status] ?? "bg-slate-500/70 text-slate-100";
}

/** Returns YYYY-MM-DD in local time */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatRange(e: CrewCalendarEvent): string {
  const s = new Date(e.startAt);
  const t = new Date(e.endAt);
  if (Number.isNaN(s.getTime())) return "";
  if (e.allDay) {
    const endIncl = new Date(t);
    endIncl.setUTCDate(endIncl.getUTCDate() - 1);
    const same =
      s.getUTCFullYear() === endIncl.getUTCFullYear() &&
      s.getUTCMonth() === endIncl.getUTCMonth() &&
      s.getUTCDate() === endIncl.getUTCDate();
    if (same) return s.toLocaleDateString(undefined, { dateStyle: "medium" });
    return `${s.toLocaleDateString(undefined, { dateStyle: "medium" })} – ${endIncl.toLocaleDateString(undefined, { dateStyle: "medium" })}`;
  }
  return `${s.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} – ${t.toLocaleString(undefined, { timeStyle: "short" })}`;
}

function MonthCalendar({
  year,
  month,
  events,
  projects,
}: {
  year: number;
  month: number; // 0-indexed
  events: CrewCalendarEvent[];
  projects: ProjectEntry[];
}) {
  const today = toLocalDateStr(new Date());

  // Build the day grid: first day of month, padded to Mon start
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Day of week 0=Sun, adjust to Mon-start
  const startPad = (firstDay.getDay() + 6) % 7;
  const totalCells = startPad + lastDay.getDate();
  const weeks = Math.ceil(totalCells / 7);

  const days: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length < weeks * 7) days.push(null);

  // Map events to their local start date
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CrewCalendarEvent[]>();
    for (const e of events) {
      const key = e.allDay
        ? e.startAt.slice(0, 10)
        : toLocalDateStr(new Date(e.startAt));
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  // For each project, collect every date in its range that falls in this month
  const projectDayMap = useMemo(() => {
    const map = new Map<string, ProjectEntry[]>();
    const monthStart = toLocalDateStr(new Date(year, month, 1));
    const monthEnd = toLocalDateStr(new Date(year, month + 1, 0));

    for (const p of projects) {
      const start = p.startDate ?? p.endDate!;
      const end = p.endDate ?? p.startDate!;
      if (start > monthEnd || end < monthStart) continue;

      const cur = parseLocalDate(start < monthStart ? monthStart : start);
      const last = parseLocalDate(end > monthEnd ? monthEnd : end);

      while (cur <= last) {
        const key = toLocalDateStr(cur);
        const arr = map.get(key) ?? [];
        arr.push(p);
        map.set(key, arr);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [projects, year, month]);

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      {/* Header row */}
      <div className="grid grid-cols-7 border-b border-white/10">
        {weekDays.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          if (!day) {
            return (
              <div
                key={`empty-${i}`}
                className={`min-h-[96px] border-b border-r border-white/[0.06] bg-white/[0.01] ${i % 7 === 6 ? "border-r-0" : ""}`}
              />
            );
          }

          const dayStr = toLocalDateStr(day);
          const isToday = dayStr === today;
          const dayEvents = eventsByDay.get(dayStr) ?? [];
          const dayProjects = projectDayMap.get(dayStr) ?? [];
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <div
              key={dayStr}
              className={`min-h-[96px] border-b border-r border-white/[0.06] p-1.5 ${i % 7 === 6 ? "border-r-0" : ""} ${isWeekend ? "bg-white/[0.01]" : ""}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isToday
                    ? "bg-sky-500 text-white"
                    : "text-slate-400"
                }`}
              >
                {day.getDate()}
              </span>

              <div className="mt-1 space-y-0.5">
                {/* Projects (jobs) */}
                {dayProjects.slice(0, 3).map((p) => (
                  <Link
                    key={p.id + dayStr}
                    href={`/projects/${p.slug}`}
                    className={`block truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${projectColor(p.status)}`}
                    title={p.name}
                  >
                    {p.name}
                  </Link>
                ))}
                {dayProjects.length > 3 && (
                  <p className="px-1 text-[10px] text-slate-500">+{dayProjects.length - 3} jobs</p>
                )}

                {/* Schedule events */}
                {dayEvents.slice(0, 2).map((e) => (
                  <Link
                    key={e.id}
                    href={`/calendar/${e.id}`}
                    className="block truncate rounded bg-sky-500/25 px-1 py-0.5 text-[10px] font-medium leading-tight text-sky-200"
                    title={e.title}
                  >
                    {e.title}
                  </Link>
                ))}
                {dayEvents.length > 2 && (
                  <p className="px-1 text-[10px] text-slate-500">+{dayEvents.length - 2} events</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarScheduleClient({
  initialItems,
  projects,
  combinedFeedUrl,
  scheduleFeedUrl,
  shiftsFeedUrl,
}: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView] = useState<"calendar" | "list">("calendar");

  const sorted = useMemo(
    () =>
      [...initialItems].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      ),
    [initialItems]
  );

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }
  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Schedule</h1>
            <p className="mt-1 text-sm text-slate-400">
              Crew events and project jobs in one view.
            </p>
          </div>
          <Link
            href="/calendar/new"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New event
          </Link>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded bg-sky-500/60" />
            Schedule event
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded bg-slate-500/70" />
            Job — Draft
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded bg-blue-500/80" />
            Job — Confirmed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded bg-amber-500/80" />
            Job — In Progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded bg-emerald-500/80" />
            Job — Complete
          </span>
        </div>

        {/* View toggle + nav */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg border border-white/15 bg-white/5 p-2 text-slate-300 hover:bg-white/10"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
            >
              Today
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg border border-white/15 bg-white/5 p-2 text-slate-300 hover:bg-white/10"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="ml-2 text-base font-semibold text-white">{monthLabel}</span>
          </div>

          <div className="flex rounded-lg border border-white/15 bg-white/5 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`rounded-md px-3 py-1.5 font-medium transition ${view === "calendar" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-300"}`}
            >
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded-md px-3 py-1.5 font-medium transition ${view === "list" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-300"}`}
            >
              List
            </button>
          </div>
        </div>

        {view === "calendar" ? (
          <MonthCalendar
            year={year}
            month={month}
            events={initialItems}
            projects={projects}
          />
        ) : (
          <>
            {sorted.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-sm text-slate-500">
                No events yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {sorted.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/calendar/${e.id}`}
                      className="flex flex-col rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-sky-500/25 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-white">{e.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatRange(e)}
                          {e.location ? ` · ${e.location}` : ""}
                        </p>
                      </div>
                      <span className="mt-2 text-xs text-sky-400/90 sm:mt-0">Edit →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <FeedSection
          combinedFeedUrl={combinedFeedUrl}
          scheduleFeedUrl={scheduleFeedUrl}
          shiftsFeedUrl={shiftsFeedUrl}
        />
      </div>
    </div>
  );
}

function FeedSection({
  combinedFeedUrl,
  scheduleFeedUrl,
  shiftsFeedUrl,
}: {
  combinedFeedUrl: string | null;
  scheduleFeedUrl: string | null;
  shiftsFeedUrl: string | null;
}) {
  if (!combinedFeedUrl && !scheduleFeedUrl && !shiftsFeedUrl) {
    return (
      <section className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-4 text-sm text-amber-100/90">
        <h2 className="font-semibold text-amber-50">Google Calendar / iCal</h2>
        <p className="mt-2 text-amber-100/80">
          Set <code className="rounded bg-black/30 px-1">CREW_ICAL_TOKEN</code> on the server, restart
          the app, and reload for subscribe URLs (same token as shifts).
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 p-4 text-sm text-slate-300">
      <h2 className="font-semibold text-white">Subscribe (Google Calendar, Apple Cal, …)</h2>
      <p className="mt-2 text-slate-400">
        Use the <strong className="text-slate-200">combined</strong> URL for one calendar that includes
        both shift postings and these schedule events.
      </p>
      {combinedFeedUrl && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/90">Combined</p>
          <p className="mt-1 break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-emerald-100/95 sm:text-xs">
            {combinedFeedUrl}
          </p>
        </div>
      )}
      {(scheduleFeedUrl || shiftsFeedUrl) && (
        <details className="mt-4 text-slate-500">
          <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-300">
            Separate feeds (optional)
          </summary>
          <div className="mt-3 space-y-3 pl-1">
            {scheduleFeedUrl && (
              <div>
                <p className="text-xs text-slate-500">Schedule only</p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{scheduleFeedUrl}</p>
              </div>
            )}
            {shiftsFeedUrl && (
              <div>
                <p className="text-xs text-slate-500">Shifts only</p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{shiftsFeedUrl}</p>
              </div>
            )}
          </div>
        </details>
      )}
      <p className="mt-3 text-xs text-slate-600">
        Treat URLs like passwords. Optional:{" "}
        <code className="rounded bg-white/10 px-1">CREW_COMBINED_ICAL_NAME</code>,{" "}
        <code className="rounded bg-white/10 px-1">CREW_CALENDAR_ICAL_NAME</code> for calendar titles.
      </p>
    </section>
  );
}
