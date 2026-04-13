"use client";

import Link from "next/link";
import { ExternalLink, RefreshCw, AlertTriangle } from "lucide-react";
import { useCallback, useState } from "react";

export type EmbeddedAppProps = {
  title: string;
  description?: string;
  src: string;
  envVarName?: string;
  onboardHref: string;
};

export function EmbeddedApp({
  title,
  description,
  src,
  envVarName,
  onboardHref,
}: EmbeddedAppProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(Boolean(src));

  const reload = useCallback(() => {
    setLoading(true);
    setIframeKey((k) => k + 1);
  }, []);

  if (!src?.trim()) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-full bg-amber-500/15 p-4 text-amber-200">
          <AlertTriangle className="h-10 w-10" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          {description && (
            <p className="mt-2 max-w-md text-sm text-slate-400">
              {description}
            </p>
          )}
          {envVarName ? (
            <p className="mt-4 text-sm text-slate-500">
              Set{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-brand/70">
                {envVarName}
              </code>{" "}
              in your environment, then rebuild or restart the app.
            </p>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              This embedded app is not configured for this instance.
            </p>
          )}
        </div>
        <Link
          href={onboardHref}
          className="rounded-lg bg-brand/20 px-4 py-2.5 text-sm font-medium text-brand/95 ring-1 ring-brand/35 hover:bg-brand/30"
        >
          Open deployment guide
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 bg-black/30 px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-white sm:text-base">
            {title}
          </h1>
          {description && (
            <p className="truncate text-xs text-slate-500 sm:text-sm">
              {description}
            </p>
          )}
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
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand/20 px-2.5 py-1.5 text-xs font-medium text-brand/95 ring-1 ring-brand/30 hover:bg-brand/30 sm:text-sm"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            New tab
          </a>
        </div>
      </header>

      <p className="shrink-0 border-b border-white/5 bg-black/20 px-3 py-1.5 text-center text-[11px] text-slate-500 sm:text-xs">
        If the frame stays blank, the remote app may block embedding
        (X-Frame-Options / CSP). Use &quot;New tab&quot; or relax framing on
        your reverse proxy for this Crew origin.
      </p>

      <div className="relative min-h-0 flex-1 bg-black/40">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#060405]/80">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
          </div>
        )}
        <iframe
          key={iframeKey}
          title={title}
          src={src}
          className="h-full w-full border-0"
          onLoad={() => setLoading(false)}
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          allow="clipboard-read; clipboard-write; fullscreen; microphone; camera"
        />
      </div>
    </div>
  );
}
