"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Check, Video, Trash2, Plus } from "lucide-react";
import { MATRIX_CHANNEL_BLUEPRINT } from "@/lib/matrix-channel-structure";
import {
  buildVdoLinks,
  getDefaultVdoBaseIndex,
  vdoRoomIdFromAlias,
  type VdoLinkSet,
} from "@/lib/vdo-ninja-urls";

const VDO_CUSTOM_LINKS_LS = "crew-hub-vdo-custom-links";

type CustomLink = { id: string; label: string; alias: string };

type Row = {
  key: string;
  label: string;
  alias: string;
  kind: "text" | "voice";
  template?: boolean;
  /** User-added row (localStorage); show delete only for these */
  custom?: boolean;
  /** Template rows are deletable by default */
  deletable: boolean;
};

function flattenBlueprint(): Row[] {
  const rows: Row[] = [];
  for (const cat of MATRIX_CHANNEL_BLUEPRINT) {
    for (const t of cat.text) {
      rows.push({
        key: `t-${cat.id}-${t.alias}`,
        label: t.title,
        alias: t.alias,
        kind: "text",
        template: t.template,
        deletable: true,
      });
    }
    for (const v of cat.voice) {
      rows.push({
        key: `v-${cat.id}-${v.alias}`,
        label: `🔊 ${v.name}`,
        alias: v.alias,
        kind: "voice",
        deletable: true,
      });
    }
  }
  return rows;
}

function loadCustomLinks(): CustomLink[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VDO_CUSTOM_LINKS_LS);
    if (!raw) return [];
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    return j
      .filter(
        (x): x is CustomLink =>
          x !== null &&
          typeof x === "object" &&
          typeof (x as CustomLink).id === "string" &&
          typeof (x as CustomLink).label === "string" &&
          typeof (x as CustomLink).alias === "string",
      )
      .slice(0, 80);
  } catch {
    return [];
  }
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
      window.setTimeout(() => setOk(false), 2000);
    } catch {
      /* ignore */
    }
  }, [text]);

  return (
    <button
      type="button"
      title={label}
      onClick={() => void onCopy()}
      className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10"
    >
      {ok ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {ok ? "Copied" : "Copy"}
    </button>
  );
}

function LinkCell({
  links,
  which,
}: {
  links: VdoLinkSet;
  which: keyof Pick<
    VdoLinkSet,
    "join" | "director" | "obsEmbed" | "iframeHtml"
  >;
}) {
  const text = links[which];
  const labels: Record<string, string> = {
    join: "Join link",
    director: "Director link",
    obsEmbed: "OBS embed URL",
    iframeHtml: "iframe HTML",
  };
  return (
    <div className="flex max-w-[200px] flex-col gap-1 sm:max-w-none">
      <code className="block truncate text-[10px] text-slate-500" title={text}>
        {which === "iframeHtml" ? "<iframe …>" : text}
      </code>
      <CopyBtn text={text} label={labels[which]} />
    </div>
  );
}

export function VdoNinjaHub({
  initialBases,
  roomPassword,
  roomPrefix,
}: {
  initialBases: string[];
  /** Applied to every generated join / director / OBS URL (VDO `&password`). */
  roomPassword: string;
  /** Prepended to every generated roomId. */
  roomPrefix?: string;
}) {
  const bases = useMemo(
    () => (initialBases.length > 0 ? initialBases : ["https://vdo.ninja"]),
    [initialBases],
  );
  const [baseIdx, setBaseIdx] = useState(0);
  const base = bases[Math.min(baseIdx, bases.length - 1)] ?? bases[0];

  useEffect(() => {
    if (bases.length <= 1) return;
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    setBaseIdx(getDefaultVdoBaseIndex(bases, host, navigator.onLine));
  }, [bases]);

  useEffect(() => {
    if (bases.length <= 1) return;
    function onOffline() {
      setBaseIdx(0);
    }
    function onOnline() {
      const host = window.location.hostname;
      setBaseIdx(getDefaultVdoBaseIndex(bases, host, true));
    }
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [bases]);

  const blueprintRows = useMemo(() => flattenBlueprint(), []);
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
  const [addLabel, setAddLabel] = useState("");
  const [addAlias, setAddAlias] = useState("");

  const VDO_DELETABLE_ROWS_LS = "crew-hub-vdo-deletable-rows";
  const [deletableRows, setDeletableRows] = useState<Set<string>>(
    new Set(blueprintRows.map((r) => r.key)),
  );

  useEffect(() => {
    setCustomLinks(loadCustomLinks());
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VDO_DELETABLE_ROWS_LS);
      if (raw) {
        const j = JSON.parse(raw) as unknown;
        if (Array.isArray(j)) {
          setDeletableRows(new Set(j as string[]));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const rows = useMemo(() => {
    const extra: Row[] = customLinks.map((c) => ({
      key: `custom-${c.id}`,
      label: c.label,
      alias: c.alias,
      kind: "text" as const,
      custom: true,
      deletable: true,
    }));
    // Filter out blueprint rows that have been deleted
    return [...blueprintRows.filter((r) => deletableRows.has(r.key)), ...extra];
  }, [blueprintRows, customLinks, deletableRows]);

  const persistCustom = useCallback((next: CustomLink[]) => {
    setCustomLinks(next);
    try {
      localStorage.setItem(VDO_CUSTOM_LINKS_LS, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }, []);

  const persistDeletableRows = useCallback((next: Set<string>) => {
    setDeletableRows(next);
    try {
      localStorage.setItem(
        VDO_DELETABLE_ROWS_LS,
        JSON.stringify(Array.from(next)),
      );
    } catch {
      /* ignore quota */
    }
  }, []);

  const removeRow = useCallback(
    (key: string) => {
      if (!deletableRows.has(key)) return;
      const updated = new Set(deletableRows);
      updated.delete(key);
      setDeletableRows(updated);
      persistDeletableRows(updated);
    },
    [deletableRows, persistDeletableRows],
  );

  const addCustomRow = useCallback(() => {
    const label = addLabel.trim();
    const alias = addAlias.trim().replace(/\s+/g, "-");
    if (!label || !alias) return;
    const alnum = alias.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!alnum) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `id-${Date.now()}`;
    persistCustom([...customLinks, { id, label, alias: alnum }]);
    setAddLabel("");
    setAddAlias("");
  }, [addLabel, addAlias, customLinks, persistCustom]);

  const [iframeKey, setIframeKey] = useState(0);

  const previewSrc = `${base.replace(/\/$/, "")}/`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-white sm:text-2xl">
          <Video className="h-6 w-6 text-brand/90" aria-hidden />
          Production video (VDO.Ninja)
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Embedded engine uses your configured base URL (default public{" "}
          <span className="text-slate-300">vdo.ninja</span>). You can override
          the base URL(s), room password, and room prefix in{" "}
          <code className="rounded bg-white/10 px-1">Admin → Instance settings</code>{" "}
          (no redeploy needed). Multiple URLs can be comma-separated — put your{" "}
          <strong className="text-slate-400">LAN / self-hosted</strong> base{" "}
          <strong className="text-slate-400">first</strong>, then your{" "}
          <strong className="text-slate-400">internet / cloud</strong> base. The
          UI defaults to the first on private IPs or when offline, and to the
          second when you open Crew on a public hostname while online. Room IDs
          are derived from each channel alias (stable, alphanumeric). Every join
          / director / OBS link includes the room password{" "}
          <strong className="text-slate-300">{roomPassword || "(none)"}</strong>{" "}
          (<code className="rounded bg-white/10 px-1">&amp;password</code>).
        </p>
      </div>

      {bases.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="vdo-base" className="text-sm text-slate-400">
            VDO engine
          </label>
          <select
            id="vdo-base"
            value={baseIdx}
            onChange={(e) => {
              setBaseIdx(Number(e.target.value));
              setIframeKey((k) => k + 1);
            }}
            className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
          >
            {bases.map((b, i) => (
              <option key={b} value={i}>
                {b}
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <h2 className="text-sm font-medium text-slate-300">Live engine</h2>
          <div className="flex items-center gap-2">
            <a
              href={previewSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand/90 hover:underline"
            >
              Open in new tab
            </a>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-300"
              onClick={() => setIframeKey((k) => k + 1)}
            >
              Reload
            </button>
          </div>
        </div>
        <div className="aspect-video min-h-[280px] w-full bg-black">
          <iframe
            key={`${base}-${iframeKey}`}
            title="VDO.Ninja"
            src={previewSrc}
            className="h-full w-full border-0"
            allow="camera; microphone; fullscreen; display-capture; autoplay; encrypted-media"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-white/10">
        <div className="flex flex-col gap-3 border-b border-white/10 bg-black/30 px-3 py-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-sm font-medium text-slate-300">
            Channel links (join / director / OBS)
          </h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-[140px] flex-col gap-1">
              <label
                htmlFor="vdo-add-label"
                className="text-[10px] uppercase text-slate-500"
              >
                Label
              </label>
              <input
                id="vdo-add-label"
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                placeholder="e.g. Client review"
                className="rounded border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-white placeholder:text-slate-600"
              />
            </div>
            <div className="flex min-w-[120px] flex-col gap-1">
              <label
                htmlFor="vdo-add-alias"
                className="text-[10px] uppercase text-slate-500"
              >
                Alias
              </label>
              <input
                id="vdo-add-alias"
                value={addAlias}
                onChange={(e) => setAddAlias(e.target.value)}
                placeholder="client-review"
                className="rounded border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-xs text-white placeholder:text-slate-600"
              />
            </div>
            <button
              type="button"
              onClick={addCustomRow}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand/25 px-3 py-2 text-xs font-medium text-brand/95 ring-1 ring-brand/40 hover:bg-brand/35"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add channel link
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-white/10 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Channel</th>
                <th className="px-2 py-2">Room id</th>
                <th className="px-2 py-2">Join</th>
                <th className="px-2 py-2">Director</th>
                <th className="px-2 py-2">OBS embed</th>
                <th className="px-2 py-2">iframe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((row) => {
                const roomId = vdoRoomIdFromAlias(row.alias, roomPrefix);
                const links = buildVdoLinks(base, roomId, roomPassword);
                return (
                  <tr key={row.key} className="hover:bg-white/[0.02]">
                    <td className="px-2 py-2 align-top text-slate-200">
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          {row.label}
                          {row.template && (
                            <span className="ml-1 text-[10px] text-amber-200/80">
                              (per job)
                            </span>
                          )}
                          <div className="text-[10px] text-slate-600">
                            {row.kind}
                          </div>
                        </span>
                        {row.deletable && (
                          <button
                            type="button"
                            title="Remove this channel link"
                            onClick={() => {
                              removeRow(row.key);
                            }}
                            className="shrink-0 rounded p-1 text-slate-500 hover:bg-white/10 hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-top font-mono text-[10px] text-slate-400">
                      {roomId}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <LinkCell links={links} which="join" />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <LinkCell links={links} which="director" />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <LinkCell links={links} which="obsEmbed" />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <LinkCell links={links} which="iframeHtml" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
