"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CrewCalendarEvent } from "@/types/calendar-event";
import { Plus } from "lucide-react";

type Props = {
  initialItems: CrewCalendarEvent[];
  combinedFeedUrl: string | null;
  scheduleFeedUrl: string | null;
  shiftsFeedUrl: string | null;
};

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

export function CalendarScheduleClient({
  initialItems,
  combinedFeedUrl,
  scheduleFeedUrl,
  shiftsFeedUrl,
}: Props) {
  const sorted = useMemo(
    () => [...initialItems].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [initialItems]
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Schedule</h1>
            <p className="mt-1 text-sm text-slate-400">
              Crew events with titles, times, and locations. Subscribe in Google Calendar via the
              secret link—updates appear when Google refreshes the feed.
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

        <FeedSection
          combinedFeedUrl={combinedFeedUrl}
          scheduleFeedUrl={scheduleFeedUrl}
          shiftsFeedUrl={shiftsFeedUrl}
        />

        {sorted.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-sm text-slate-500">
            No events yet. Add meetings, deadlines, or on-site days—then paste the combined iCal URL
            into Google Calendar → Other calendars → From URL.
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
        both shift postings and these schedule events. Google pulls updates on its own schedule
        (often every few hours); changes in Crew appear on the next refresh.
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
        Treat URLs like passwords. Optional: <code className="rounded bg-white/10 px-1">CREW_COMBINED_ICAL_NAME</code>,{" "}
        <code className="rounded bg-white/10 px-1">CREW_CALENDAR_ICAL_NAME</code> for calendar titles in the .ics file.
      </p>
    </section>
  );
}
