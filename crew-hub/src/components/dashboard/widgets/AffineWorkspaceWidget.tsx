"use client";

import { ExternalLink } from "lucide-react";

export function AffineWorkspaceWidget({ affineUrl }: { affineUrl?: string }) {
  if (!affineUrl) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-500">
        AFFiNE URL not configured — set it in Admin → Instance Settings.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1">
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-xs text-slate-500">Workspace</span>
        <a
          href={affineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
        >
          <ExternalLink className="h-3 w-3" /> Open
        </a>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10">
        <iframe
          title="AFFiNE Workspace"
          src={affineUrl}
          className="h-full w-full border-0"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      </div>
    </div>
  );
}
