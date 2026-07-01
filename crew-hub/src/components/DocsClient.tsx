"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, FileSpreadsheet, File, Pencil, X, FolderOpen } from "lucide-react";
import type { ProjectFile } from "@/types/projects";

type Props = {
  files: ProjectFile[];
  projectMap: Record<string, { name: string; slug: string }>;
  collaboraUrl?: string;
};

const COLLABORA_EDITABLE = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

function FileIcon({ mimeType }: { mimeType: string }) {
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.oasis.opendocument.spreadsheet"
  ) {
    return <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />;
  }
  if (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/vnd.oasis.opendocument.text"
  ) {
    return <FileText className="h-5 w-5 shrink-0 text-blue-400" aria-hidden />;
  }
  if (mimeType === "application/pdf") {
    return <FileText className="h-5 w-5 shrink-0 text-red-400" aria-hidden />;
  }
  return <File className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocsClient({ files, projectMap, collaboraUrl }: Props) {
  const [editorModal, setEditorModal] = useState<{ url: string; filename: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const docFiles = files.filter((f) => !f.mimeType.startsWith("image/"));

  async function openInCollabora(file: ProjectFile) {
    const proj = projectMap[file.projectId];
    if (!proj) return;
    setOpening(file.id);
    setErr(null);
    try {
      const r = await fetch(`/api/projects/${proj.slug}/files/${file.id}/wopi-token`, {
        method: "POST",
        credentials: "same-origin",
      });
      const d = await r.json();
      if (!r.ok) throw new Error((d as { error?: string }).error ?? "Could not open editor");
      setEditorModal({ url: (d as { editorUrl: string }).editorUrl, filename: file.filename });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not open editor");
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-white/10 px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-lg font-semibold text-white">Documents</h1>
        <p className="mt-0.5 text-sm text-slate-500">All project files — click the pencil to edit in Collabora.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        {err && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
            {err}
          </p>
        )}

        {docFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <FolderOpen className="mb-4 h-12 w-12 text-slate-600" aria-hidden />
            <p className="text-slate-400">No documents uploaded yet.</p>
            <p className="mt-1 text-sm text-slate-600">
              Upload files from a{" "}
              <Link href="/projects" className="text-brand/80 hover:underline">
                project page
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {docFiles.map((f) => {
              const proj = projectMap[f.projectId];
              const canEdit = collaboraUrl && COLLABORA_EDITABLE.has(f.mimeType);
              return (
                <li
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <FileIcon mimeType={f.mimeType} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{f.filename}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {proj ? (
                        <Link href={`/projects/${proj.slug}`} className="hover:text-slate-300">
                          {proj.name}
                        </Link>
                      ) : (
                        "Unknown project"
                      )}{" "}
                      · {fmtSize(f.sizeBytes)} · {new Date(f.uploadedAt).toLocaleDateString("en-AU")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => void openInCollabora(f)}
                        disabled={opening === f.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand/15 px-3 py-1.5 text-xs font-medium text-brand/90 ring-1 ring-brand/25 hover:bg-brand/25 disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        {opening === f.id ? "Opening…" : "Edit"}
                      </button>
                    )}
                    <a
                      href={proj ? `/api/projects/${proj.slug}/files/${f.id}` : "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-300"
                      title="Download"
                    >
                      <File className="h-4 w-4" aria-hidden />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editorModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0d0d10] px-4 py-2.5">
            <span className="truncate text-sm font-medium text-white">{editorModal.filename}</span>
            <button
              type="button"
              onClick={() => setEditorModal(null)}
              className="ml-4 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Close editor"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <iframe
            src={editorModal.url}
            title={editorModal.filename}
            className="min-h-0 flex-1 border-0"
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        </div>
      )}
    </div>
  );
}
