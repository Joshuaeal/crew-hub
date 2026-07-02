"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Lightbulb,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ProjectLite = {
  id: string;
  name: string;
  status: string;
  category: string;
  clientId?: string;
  startDate?: string;
  endDate?: string;
};

type PlotInfo = { mvrCount: number };

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30",
  planning: "bg-sky-500/20 text-sky-300 ring-sky-500/30",
  completed: "bg-slate-500/20 text-slate-400 ring-slate-500/30",
  cancelled: "bg-rose-500/20 text-rose-300 ring-rose-500/30",
  on_hold: "bg-amber-500/20 text-amber-300 ring-amber-500/30",
};

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

// ── Unconfigured state ────────────────────────────────────────────────────────

function UnconfiguredState() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-full bg-amber-500/15 p-4 text-amber-200">
        <AlertTriangle className="h-10 w-10" aria-hidden />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-white">Lighting Plots</h1>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          No Perastage container URL is configured for this instance.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Start the container from{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-brand/70">
            lighting-plot-container/
          </code>{" "}
          then set{" "}
          <strong className="text-slate-300">Lighting Plots URL</strong> in
          instance settings.
        </p>
      </div>
      <Link
        href="/setup"
        className="rounded-lg bg-brand/20 px-4 py-2.5 text-sm font-medium text-brand/95 ring-1 ring-brand/35 hover:bg-brand/30"
      >
        Open setup
      </Link>
    </div>
  );
}

// ── Project picker ────────────────────────────────────────────────────────────

function ProjectPicker({
  projects,
  noVncBaseUrl,
  onSelect,
}: {
  projects: ProjectLite[];
  noVncBaseUrl: string;
  onSelect: (project: ProjectLite) => void;
}) {
  const [plots, setPlots] = useState<Record<string, PlotInfo> | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/lighting-plots/projects")
      .then((r) => r.json())
      .then((data) => setPlots(data.plotsByProjectId ?? {}))
      .catch(() => setPlots({}));
  }, []);

  const handleSelect = useCallback(
    async (project: ProjectLite) => {
      setCreating(project.id);
      try {
        await fetch("/api/lighting-plots/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id, projectName: project.name }),
        });
      } catch {
        // folder creation is best-effort; still open Perastage
      }
      setCreating(null);
      onSelect(project);
    },
    [onSelect]
  );

  const active = projects.filter((p) => p.status === "active");
  const rest = projects.filter((p) => p.status !== "active");
  const ordered = [...active, ...rest];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/30 px-4 py-3">
        <div className="flex items-center gap-2 text-brand/80">
          <Lightbulb className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">Lighting Plots</h1>
          <p className="text-xs text-slate-500">Select a project to open in Perastage</p>
        </div>
        <a
          href={noVncBaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Open Perastage directly
        </a>
      </header>

      {/* Project grid */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {ordered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="text-sm text-slate-500">No projects yet.</p>
            <Link
              href="/projects"
              className="text-xs text-brand/70 hover:text-brand"
            >
              Go to Projects →
            </Link>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Active projects
                </h2>
                <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {active.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      plot={plots?.[p.id]}
                      loading={plots === null}
                      creating={creating === p.id}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              </section>
            )}
            {rest.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  All projects
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {rest.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      plot={plots?.[p.id]}
                      loading={plots === null}
                      creating={creating === p.id}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  plot,
  loading,
  creating,
  onSelect,
}: {
  project: ProjectLite;
  plot?: PlotInfo;
  loading: boolean;
  creating: boolean;
  onSelect: (p: ProjectLite) => void;
}) {
  const colorClass =
    STATUS_COLORS[project.status] ?? "bg-slate-500/20 text-slate-400 ring-slate-500/30";
  const dateRange = [formatDate(project.startDate), formatDate(project.endDate)]
    .filter(Boolean)
    .join(" – ");

  return (
    <button
      type="button"
      disabled={creating}
      onClick={() => onSelect(project)}
      className="group relative flex flex-col gap-2 rounded-xl border border-white/8 bg-white/3 p-4 text-left transition hover:border-brand/30 hover:bg-white/6 disabled:cursor-wait disabled:opacity-60"
    >
      {/* Plot indicator */}
      <div className="absolute right-3 top-3">
        {loading ? (
          <span className="h-2 w-2 rounded-full bg-slate-700" />
        ) : plot ? (
          <span
            className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/25"
            title={`${plot.mvrCount} MVR file${plot.mvrCount !== 1 ? "s" : ""}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {plot.mvrCount > 0 ? `${plot.mvrCount} plot${plot.mvrCount !== 1 ? "s" : ""}` : "folder"}
          </span>
        ) : (
          <span className="h-2 w-2 rounded-full bg-slate-700" title="No plot yet" />
        )}
      </div>

      {/* Status badge */}
      <span
        className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${colorClass}`}
      >
        {statusLabel(project.status)}
      </span>

      {/* Name */}
      <p className="pr-14 text-sm font-semibold leading-snug text-white group-hover:text-brand/95">
        {project.name}
      </p>

      {/* Date range */}
      {dateRange && (
        <p className="text-[11px] text-slate-500">{dateRange}</p>
      )}

      {creating && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="h-3 w-3 animate-spin rounded-full border border-brand/40 border-t-brand" />
          Opening…
        </div>
      )}
    </button>
  );
}

// ── Active editor view ────────────────────────────────────────────────────────

function EditorView({
  project,
  noVncBaseUrl,
  onBack,
}: {
  project: ProjectLite;
  noVncBaseUrl: string;
  onBack: () => void;
}) {
  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    setIframeKey((k) => k + 1);
  }, []);

  const noVncUrl =
    `${noVncBaseUrl.replace(/\/$/, "")}/vnc.html` +
    `?autoconnect=true&reconnect=true&reconnect_delay=2000&resize=scale&path=websockify&show_dot=false&bell=false`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 bg-black/30 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Projects
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-white">{project.name}</h1>
          <p className="truncate text-xs text-slate-500">
            Perastage — GDTF &amp; MVR lighting plot editor
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white sm:text-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Reload
          </button>
          <a
            href={noVncBaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand/20 px-2.5 py-1.5 text-xs font-medium text-brand/95 ring-1 ring-brand/30 hover:bg-brand/30 sm:text-sm"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            New tab
          </a>
        </div>
      </header>

      {/* Project folder hint */}
      <div className="shrink-0 border-b border-white/5 bg-slate-900/50 px-4 py-2 text-xs text-slate-500">
        Project folder:{" "}
        <code className="text-slate-400">~/projects/{project.name}/</code>
        {" — "}use{" "}
        <span className="text-slate-400">File → Open</span> in Perastage to open or save your plot here.
      </div>

      <div className="relative min-h-0 flex-1 bg-black">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#060405]/80">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
          </div>
        )}
        <iframe
          key={iframeKey}
          title="Perastage — Lighting Plots"
          src={noVncUrl}
          className="h-full w-full border-0"
          onLoad={() => setLoading(false)}
          sandbox="allow-same-origin allow-scripts"
          allow="fullscreen; clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function LightingPlotsEmbed({
  noVncBaseUrl,
  projects = [],
}: {
  noVncBaseUrl?: string;
  projects?: ProjectLite[];
}) {
  const [activeProject, setActiveProject] = useState<ProjectLite | null>(null);

  if (!noVncBaseUrl?.trim()) {
    return <UnconfiguredState />;
  }

  if (activeProject) {
    return (
      <EditorView
        project={activeProject}
        noVncBaseUrl={noVncBaseUrl}
        onBack={() => setActiveProject(null)}
      />
    );
  }

  return (
    <ProjectPicker
      projects={projects}
      noVncBaseUrl={noVncBaseUrl}
      onSelect={setActiveProject}
    />
  );
}
