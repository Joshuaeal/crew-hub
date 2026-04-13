"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CrewCalendarEvent } from "@/types/calendar-event";
import { Loader2 } from "lucide-react";

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Exclusive end date for iCal (day after last inclusive day). */
function dayAfter(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

type Props = {
  mode: "create" | "edit";
  initial?: CrewCalendarEvent;
};

export function CalendarEventForm({ mode, initial }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [allDay, setAllDay] = useState(initial?.allDay ?? false);

  const [startDate, setStartDate] = useState(() =>
    initial?.allDay ? initial.startAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [endDateInclusive, setEndDateInclusive] = useState(() => {
    if (initial?.allDay) {
      const endEx = initial.endAt.slice(0, 10);
      const d = new Date(`${endEx}T12:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });

  const [startLocal, setStartLocal] = useState(
    initial && !initial.allDay ? toDatetimeLocalValue(initial.startAt) : toDatetimeLocalValue(new Date().toISOString())
  );
  const [endLocal, setEndLocal] = useState(
    initial && !initial.allDay
      ? toDatetimeLocalValue(initial.endAt)
      : toDatetimeLocalValue(new Date(Date.now() + 3600000).toISOString())
  );

  async function save() {
    setError(null);
    setPending(true);
    try {
      let startAt: string;
      let endAt: string;
      if (allDay) {
        if (!startDate || !endDateInclusive) {
          setError("Start and end dates are required");
          setPending(false);
          return;
        }
        if (endDateInclusive < startDate) {
          setError("End date must be on or after start date");
          setPending(false);
          return;
        }
        startAt = `${startDate}T00:00:00.000Z`;
        endAt = `${dayAfter(endDateInclusive)}T00:00:00.000Z`;
      } else {
        startAt = fromDatetimeLocal(startLocal);
        endAt = fromDatetimeLocal(endLocal);
        if (new Date(endAt) <= new Date(startAt)) {
          setError("End time must be after start time");
          setPending(false);
          return;
        }
      }

      const payload = {
        title,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startAt,
        endAt,
        allDay,
      };

      if (mode === "create") {
        const res = await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Save failed");
          return;
        }
        const id = data.item?.id as string | undefined;
        router.push(id ? `/calendar/${id}` : "/calendar");
        router.refresh();
        return;
      }

      if (!initial) return;
      const res = await fetch(`/api/calendar/events/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!initial || mode !== "edit") return;
    if (!confirm("Delete this event?")) return;
    setPending(true);
    try {
      const res = await fetch(`/api/calendar/events/${initial.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Delete failed");
        return;
      }
      router.push("/calendar");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/calendar" className="text-sm text-slate-400 hover:text-white">
        ← Schedule
      </Link>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      <div>
        <label className="block text-sm text-slate-400">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-sky-500/40"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="rounded border-white/20"
        />
        All-day (UTC calendar dates)
      </label>

      {allDay ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-slate-400">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400">End date (inclusive)</label>
            <input
              type="date"
              value={endDateInclusive}
              onChange={(e) => setEndDateInclusive(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-slate-400">Start</label>
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400">End</label>
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm text-slate-400">Location (optional)</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-sky-500/40"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-400">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-sky-500/40"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
        {mode === "edit" && (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={pending}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-50"
          >
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={pending || !title.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-500/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {mode === "create" ? "Create event" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
