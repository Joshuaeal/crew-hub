"use client";

/**
 * AffineEmbed — renders a self-hosted AFFiNE workspace in an iframe.
 *
 * AUTH FLOW (credential bridge — see also lib/affine-bridge.ts):
 *   1. On mount, fetches /api/affine/session (server-side, never exposes admin creds).
 *   2. If a token is returned, loads a hidden "pre-auth" iframe at:
 *        {affineUrl}/auth/token?token={jwt}
 *      AFFiNE's web app handles this path and writes the session cookie to the AFFiNE
 *      domain. The hidden iframe is unmounted once that load event fires.
 *   3. The real AFFiNE iframe is then shown — it inherits the session cookie.
 *
 * If the AFFiNE session cookie is not set, the user will see AFFiNE's own login form —
 * they should sign in with their Crew Hub email and password. Session persists via
 * AFFiNE's own cookie thereafter (one-time per browser).
 *
 * If the AFFiNE URL is not configured, a setup prompt is shown instead.
 */

import { ExternalLink, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  /** AFFiNE server URL from instance settings (may be undefined if not yet configured). */
  affineUrl: string | undefined;
  /** Optional: navigate directly to a specific AFFiNE doc path (e.g. /workspace/abc/page/xyz). */
  docPath?: string;
  /** Label shown in the header */
  title?: string;
};

export function AffineEmbed({ affineUrl, docPath, title = "Workspace" }: Props) {
  const [iframeKey, setIframeKey] = useState(0);
  const [phase, setPhase] = useState<"idle" | "fetching" | "ready">("idle");
  const [iframeLoading, setIframeLoading] = useState(true);

  const preAuthDone = useRef(false);

  const targetUrl = affineUrl
    ? affineUrl.replace(/\/$/, "") + (docPath ?? "")
    : "";

  const startAuth = useCallback(async () => {
    if (!affineUrl) return;
    preAuthDone.current = false;
    setPhase("fetching");
    try {
      const res = await fetch("/api/affine/session");
      const data = (await res.json()) as {
        email?: string;
        password?: string;
        bridgeDisabled?: boolean;
        error?: string;
      };
      if (data.bridgeDisabled || !data.email || !data.password) {
        setPhase("ready");
        return;
      }
      // POST credentials directly to AFFiNE — sets affine_session cookie on the AFFiNE domain
      try {
        await fetch(`${affineUrl.replace(/\/$/, "")}/api/auth/sign-in`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: data.email, password: data.password }),
        });
      } catch {
        // Cross-origin POST may be blocked by CORS — fall through, user sees AFFiNE login
      }
      setPhase("ready");
    } catch {
      setPhase("ready");
    }
  }, [affineUrl]);

  useEffect(() => {
    if (affineUrl) startAuth();
  }, [affineUrl, startAuth]);

  const reload = useCallback(() => {
    preAuthDone.current = false;
    setIframeLoading(true);
    setIframeKey((k) => k + 1);
    if (affineUrl) startAuth();
  }, [affineUrl, startAuth]);

  if (!affineUrl) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-full bg-amber-500/15 p-4 text-amber-200">
          <AlertTriangle className="h-10 w-10" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            AFFiNE Workspace is not configured for this instance. Set the AFFiNE URL in
            Admin → Instance Settings to enable it.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Set <code className="rounded bg-white/10 px-1.5 py-0.5 text-brand/70">affineUrl</code>{" "}
            in Admin → Instance Settings, or deploy AFFiNE and point it at a subdomain.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 bg-black/30 px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-white sm:text-base">{title}</h1>
          <p className="truncate text-xs text-slate-500">{affineUrl}</p>
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
            href={targetUrl}
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
        If Affine asks you to sign in, use your Crew Hub email and password.
        If the frame stays blank, try opening in a new tab.
      </p>

      <div className="relative min-h-0 flex-1 bg-black/40">
        {/* Loading overlay — shown while fetching/signing in or while iframe loads */}
        {(phase === "idle" || phase === "fetching" || iframeLoading) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#060405]/80">
            <Loader2 className="h-9 w-9 animate-spin text-brand/60" aria-hidden />
          </div>
        )}

        {phase === "ready" && (
          <iframe
            key={iframeKey}
            title={title}
            src={targetUrl}
            className="h-full w-full border-0"
            onLoad={() => setIframeLoading(false)}
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        )}
      </div>
    </div>
  );
}
