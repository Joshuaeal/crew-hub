"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { ProjectMilestone } from "@/types/projects";

// ─── Public types ──────────────────────────────────────────────────────────

export type GanttTrack = {
  id: string;
  slug: string;
  label: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  canManage: boolean;
  milestones: ProjectMilestone[];
};

type Props = {
  tracks: GanttTrack[];
  /** single = no job-bar drag/resize. multi = job bars draggable/resizable. */
  mode: "single" | "multi";
  onJobBarChange?: (slug: string, startDate: string | undefined, endDate: string | undefined) => Promise<void>;
  onMilestoneDateChange?: (slug: string, milestoneId: string, dueDate: string) => Promise<void>;
};

// ─── Date helpers (no library) ─────────────────────────────────────────────

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function nextMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
}

function isOverdue(dueDate: string, status: string): boolean {
  if (status === "Done") return false;
  return parseDate(dueDate) < new Date();
}

// ─── Layout constants ──────────────────────────────────────────────────────

const LABEL_W = 176;
const ROW_H = 52;
const HEADER_H = 38;
const BAR_H = 22;
const BAR_Y = (ROW_H - BAR_H) / 2;
const HANDLE_W = 8;
const M_R = 7;
const PAD_DAYS = 21;

const STATUS_FILL: Record<string, string> = {
  Draft:       "#475569",
  Confirmed:   "#3b82f6",
  "In Progress": "#f59e0b",
  Complete:    "#10b981",
  Cancelled:   "#ef4444",
};

// ─── Drag types ────────────────────────────────────────────────────────────

type DragTarget =
  | { kind: "bar-move";  slug: string; origStart?: string; origEnd?: string }
  | { kind: "bar-left";  slug: string; origStart?: string }
  | { kind: "bar-right"; slug: string; origEnd?: string }
  | { kind: "milestone"; slug: string; mid: string; origDate: string };

type ActiveDrag = {
  target: DragTarget;
  startClientX: number;
};

type Preview = {
  slug: string;
  startDate?: string;
  endDate?: string;
  milestoneOverrides?: Record<string, string>; // id → dueDate
};

function applyPreview(tracks: GanttTrack[], preview: Preview): GanttTrack[] {
  return tracks.map((t) => {
    if (t.slug !== preview.slug) return t;
    const updated = { ...t };
    if (preview.startDate !== undefined) updated.startDate = preview.startDate;
    if (preview.endDate !== undefined) updated.endDate = preview.endDate;
    if (preview.milestoneOverrides) {
      updated.milestones = t.milestones.map((m) => {
        const override = preview.milestoneOverrides![m.id];
        return override ? { ...m, dueDate: override } : m;
      });
    }
    return updated;
  });
}

// ─── Component ─────────────────────────────────────────────────────────────

export function GanttChart({ tracks, mode, onJobBarChange, onMilestoneDateChange }: Props) {
  const [pxPerDay, setPxPerDay] = useState(28);
  const [localTracks, setLocalTracks] = useState<GanttTrack[]>(tracks);
  const [dragPreview, setDragPreview] = useState<Preview | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const dragRef = useRef<ActiveDrag | null>(null);
  const previewRef = useRef<Preview | null>(null);

  // Keep local tracks in sync when prop changes (after API save)
  useEffect(() => { setLocalTracks(tracks); }, [tracks]);

  function flashErr(msg: string) {
    setErrMsg(msg);
    setTimeout(() => setErrMsg(""), 4000);
  }

  // ── Date range ────────────────────────────────────────────────────────────

  const { rangeStart, rangeEnd } = useMemo(() => {
    const dates: number[] = [Date.now()];
    for (const t of localTracks) {
      if (t.startDate) dates.push(parseDate(t.startDate).getTime());
      if (t.endDate) dates.push(parseDate(t.endDate).getTime());
      for (const m of t.milestones) dates.push(parseDate(m.dueDate).getTime());
    }
    return {
      rangeStart: addDays(new Date(Math.min(...dates)), -PAD_DAYS),
      rangeEnd:   addDays(new Date(Math.max(...dates)),  PAD_DAYS),
    };
  }, [localTracks]);

  const totalDays  = diffDays(rangeStart, rangeEnd);
  const totalWidth = totalDays * pxPerDay;
  const totalHeight = localTracks.length * ROW_H + HEADER_H;

  function dateToX(s: string): number {
    return diffDays(rangeStart, parseDate(s)) * pxPerDay;
  }

  const todayX = diffDays(rangeStart, new Date()) * pxPerDay;

  const monthMarkers = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    let d = startOfMonth(rangeStart);
    if (d.getTime() < rangeStart.getTime()) d = nextMonth(d);
    while (d.getTime() <= rangeEnd.getTime()) {
      out.push({ x: diffDays(rangeStart, d) * pxPerDay, label: fmtMonth(d) });
      d = nextMonth(d);
    }
    return out;
  }, [rangeStart, rangeEnd, pxPerDay]);

  // ── Drag: compute preview from delta ─────────────────────────────────────

  function computePreview(drag: ActiveDrag, currentClientX: number): Preview {
    const delta = Math.round((currentClientX - drag.startClientX) / pxPerDay);
    const { target } = drag;

    switch (target.kind) {
      case "bar-move": {
        const preview: Preview = { slug: target.slug };
        if (target.origStart) preview.startDate = toISO(addDays(parseDate(target.origStart), delta));
        if (target.origEnd)   preview.endDate   = toISO(addDays(parseDate(target.origEnd),   delta));
        return preview;
      }
      case "bar-left": {
        const preview: Preview = { slug: target.slug };
        if (target.origStart) preview.startDate = toISO(addDays(parseDate(target.origStart), delta));
        return preview;
      }
      case "bar-right": {
        const preview: Preview = { slug: target.slug };
        if (target.origEnd) preview.endDate = toISO(addDays(parseDate(target.origEnd), delta));
        return preview;
      }
      case "milestone": {
        return {
          slug: target.slug,
          milestoneOverrides: {
            [target.mid]: toISO(addDays(parseDate(target.origDate), delta)),
          },
        };
      }
    }
  }

  // ── Drag event listeners on window ────────────────────────────────────────

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const preview = computePreview(drag, e.clientX);
      previewRef.current = preview;
      setDragPreview({ ...preview });
    }

    async function onUp(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;

      const preview = previewRef.current ?? computePreview(drag, e.clientX);
      previewRef.current = null;

      // Optimistic apply to local state
      setLocalTracks((prev) => applyPreview(prev, preview));
      setDragPreview(null);

      try {
        if (drag.target.kind === "milestone") {
          const newDate = preview.milestoneOverrides?.[drag.target.mid];
          if (newDate && onMilestoneDateChange) {
            await onMilestoneDateChange(preview.slug, drag.target.mid, newDate);
          }
        } else {
          if (onJobBarChange) {
            await onJobBarChange(preview.slug, preview.startDate, preview.endDate);
          }
        }
      } catch {
        // Rollback
        setLocalTracks(tracks);
        flashErr("Failed to save — change reverted.");
      }
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pxPerDay, tracks, onJobBarChange, onMilestoneDateChange]);

  // ── Rendered tracks (with drag preview applied) ───────────────────────────

  const renderedTracks = useMemo(
    () => (dragPreview ? applyPreview(localTracks, dragPreview) : localTracks),
    [localTracks, dragPreview],
  );

  // ── Row render helpers ────────────────────────────────────────────────────

  function renderJobBar(track: GanttTrack, rowY: number, interactive: boolean) {
    const fill = STATUS_FILL[track.status ?? ""] ?? "#475569";
    const hasStart = !!track.startDate;
    const hasEnd   = !!track.endDate;

    // If no dates at all, skip bar
    if (!hasStart && !hasEnd) return null;

    const barX1 = hasStart ? dateToX(track.startDate!) : 0;
    const barX2 = hasEnd   ? dateToX(track.endDate!)   : totalWidth;
    const barW  = Math.max(barX2 - barX1, 4);
    const y     = rowY + BAR_Y;

    const draggable = interactive && track.canManage && mode === "multi";

    const origStart = track.startDate;
    const origEnd   = track.endDate;

    return (
      <g key={`bar-${track.id}`}>
        {/* Bar body */}
        <rect
          x={barX1}
          y={y}
          width={barW}
          height={BAR_H}
          rx={4}
          fill={fill}
          fillOpacity={0.25}
          stroke={fill}
          strokeOpacity={0.6}
          strokeWidth={1.5}
          strokeDasharray={(!hasStart || !hasEnd) ? "5 3" : undefined}
          cursor={draggable ? "grab" : "default"}
          onMouseDown={draggable ? (e) => {
            e.stopPropagation();
            dragRef.current = {
              target: { kind: "bar-move", slug: track.slug, origStart, origEnd },
              startClientX: e.clientX,
            };
          } : undefined}
        />

        {/* Left resize handle */}
        {draggable && hasStart && (
          <rect
            x={barX1}
            y={y}
            width={HANDLE_W}
            height={BAR_H}
            rx={4}
            fill="transparent"
            cursor="col-resize"
            onMouseDown={(e) => {
              e.stopPropagation();
              dragRef.current = {
                target: { kind: "bar-left", slug: track.slug, origStart },
                startClientX: e.clientX,
              };
            }}
          />
        )}

        {/* Right resize handle */}
        {draggable && hasEnd && (
          <rect
            x={barX2 - HANDLE_W}
            y={y}
            width={HANDLE_W}
            height={BAR_H}
            rx={4}
            fill="transparent"
            cursor="col-resize"
            onMouseDown={(e) => {
              e.stopPropagation();
              dragRef.current = {
                target: { kind: "bar-right", slug: track.slug, origEnd },
                startClientX: e.clientX,
              };
            }}
          />
        )}

        {/* Open-ended indicators */}
        {!hasStart && (
          <text x={barX1 + 4} y={y + BAR_H / 2 + 4} fontSize={10} fill={fill} fillOpacity={0.7}>
            ←
          </text>
        )}
        {!hasEnd && (
          <text x={barX2 - 14} y={y + BAR_H / 2 + 4} fontSize={10} fill={fill} fillOpacity={0.7}>
            →
          </text>
        )}
      </g>
    );
  }

  function renderMilestones(track: GanttTrack, rowY: number) {
    const today = toISO(new Date()); // eslint-disable-line @typescript-eslint/no-unused-vars
    return track.milestones.map((m) => {
      const overdue = isOverdue(m.dueDate, m.status);
      const done    = m.status === "Done";
      const cx      = dateToX(m.dueDate);
      const cy      = rowY + ROW_H / 2;

      const fill   = done ? "#10b981" : overdue ? "#ef4444" : "#94a3b8";
      const stroke = done ? "#10b981" : overdue ? "#ef4444" : "#475569";

      const draggable = track.canManage && !done;

      // Diamond shape via points
      const pts = [
        `${cx},${cy - M_R}`,
        `${cx + M_R},${cy}`,
        `${cx},${cy + M_R}`,
        `${cx - M_R},${cy}`,
      ].join(" ");

      return (
        <g key={m.id}>
          <polygon
            points={pts}
            fill={fill}
            fillOpacity={done ? 0.7 : 0.9}
            stroke={stroke}
            strokeWidth={1.5}
            cursor={draggable ? "grab" : "default"}
            onMouseDown={draggable ? (e) => {
              e.stopPropagation();
              dragRef.current = {
                target: { kind: "milestone", slug: track.slug, mid: m.id, origDate: m.dueDate },
                startClientX: e.clientX,
              };
            } : undefined}
          />
          {/* Hover tooltip via title */}
          <title>{m.title} · {m.dueDate}{overdue ? " · Overdue" : ""}</title>
        </g>
      );
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPxPerDay((p) => Math.max(8, p - 4))}
          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:bg-white/10"
          aria-label="Zoom out"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs text-slate-500 tabular-nums w-12 text-center">{pxPerDay}px/d</span>
        <button
          type="button"
          onClick={() => setPxPerDay((p) => Math.min(80, p + 4))}
          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:bg-white/10"
          aria-label="Zoom in"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        {mode === "multi" && (
          <span className="ml-2 text-xs text-slate-500">
            Drag bars to reschedule · Drag edges to resize · Drag diamonds to move milestones
          </span>
        )}
        {mode === "single" && (
          <span className="ml-2 text-xs text-slate-500">
            Drag diamonds to move milestones
          </span>
        )}
      </div>

      {errMsg && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-100">
          {errMsg}
        </div>
      )}

      {/* Chart layout: label column + scrollable timeline */}
      <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        {/* Label column */}
        <div
          className="flex-none border-r border-white/10 bg-[#0c0c10]"
          style={{ width: LABEL_W }}
        >
          {/* Header spacer */}
          <div style={{ height: HEADER_H }} className="border-b border-white/10" />
          {/* Track labels */}
          {renderedTracks.map((t) => (
            <div
              key={t.id}
              style={{ height: ROW_H }}
              className="flex items-center border-b border-white/[0.05] px-3 last:border-b-0"
            >
              <span className="truncate text-sm text-slate-200">{t.label}</span>
            </div>
          ))}
        </div>

        {/* Timeline: horizontally scrollable */}
        <div className="flex-1 overflow-x-auto select-none">
          <svg
            width={Math.max(totalWidth, 400)}
            height={totalHeight}
            style={{ display: "block", userSelect: "none" }}
          >
            {/* Month grid lines */}
            {monthMarkers.map(({ x, label }) => (
              <g key={x}>
                <line x1={x} y1={0} x2={x} y2={totalHeight} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                <text x={x + 5} y={HEADER_H - 10} fontSize={10} fill="#64748b">{label}</text>
              </g>
            ))}

            {/* Header bottom border */}
            <line x1={0} y1={HEADER_H} x2={totalWidth} y2={HEADER_H} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

            {/* Row separators */}
            {renderedTracks.map((_, i) => (
              <line
                key={i}
                x1={0} y1={HEADER_H + (i + 1) * ROW_H}
                x2={totalWidth} y2={HEADER_H + (i + 1) * ROW_H}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={1}
              />
            ))}

            {/* Today line */}
            {todayX >= 0 && todayX <= totalWidth && (
              <g>
                <line
                  x1={todayX} y1={0}
                  x2={todayX} y2={totalHeight}
                  stroke="#06b6d4"
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                />
                <text x={todayX + 3} y={HEADER_H - 10} fontSize={9} fill="#06b6d4" fillOpacity={0.7}>
                  Today
                </text>
              </g>
            )}

            {/* Tracks */}
            {renderedTracks.map((track, i) => {
              const rowY = HEADER_H + i * ROW_H;
              return (
                <g key={track.id}>
                  {renderJobBar(track, rowY, true)}
                  {renderMilestones(track, rowY)}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rotate-45 bg-emerald-500 opacity-80" />
          Done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rotate-45 bg-red-500 opacity-80" />
          Overdue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rotate-45 bg-slate-500" />
          Pending
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-cyan-500 opacity-50" />
          Today
        </span>
        {(!tracks.every((t) => t.startDate && t.endDate)) && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 border-b-2 border-dashed border-slate-500" />
            No date set (open-ended)
          </span>
        )}
      </div>
    </div>
  );
}
