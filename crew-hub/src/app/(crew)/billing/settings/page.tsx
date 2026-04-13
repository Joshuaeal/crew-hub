"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BillingSettings } from "@/types/billing";
import { Loader2 } from "lucide-react";

export default function BillingSettingsPage() {
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [effectiveCss, setEffectiveCss] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cssError, setCssError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(() => {
    fetch("/api/billing/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings(d.settings);
      })
      .catch(() => setError("Failed to load"));
  }, []);

  useEffect(() => {
    load();
    fetch("/api/billing/invoice-css")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = typeof d?.error === "string" ? d.error : "Failed to load effective invoice CSS";
          setCssError(msg);
          return;
        }
        if (typeof d?.effectiveCss === "string") setEffectiveCss(d.effectiveCss);
      })
      .catch(() => {
        setCssError("Failed to load effective invoice CSS");
      });
  }, [load]);

  const onCopyCss = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(effectiveCss || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [effectiveCss]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/billing/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      if (data.settings) setSettings(data.settings);
    } finally {
      setPending(false);
    }
  }

  if (!settings) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/billing" className="text-sm text-slate-400 hover:text-white">
            ← Billing
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-white">Billing workspace</h1>
          <p className="mt-1 text-sm text-slate-400">
            Default terms, sender address, follow-up schedule, and print/email CSS (applies to all quotes &
            invoices). Sending still
            requires <code className="rounded bg-white/10 px-1">SMTP_*</code> in the environment.
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        )}

        <form
          onSubmit={(e) => void save(e)}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div>
            <label className="text-sm text-slate-400">Default terms</label>
            <textarea
              value={settings.defaultTerms}
              onChange={(e) => setSettings({ ...settings, defaultTerms: e.target.value })}
              rows={4}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400">Default From email (optional)</label>
            <input
              type="email"
              value={settings.defaultFromEmail}
              onChange={(e) => setSettings({ ...settings, defaultFromEmail: e.target.value })}
              placeholder="Falls back to SMTP_FROM"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400">
              Default follow-up intervals (days, comma-separated)
            </label>
            <input
              value={settings.followUpIntervalDays.join(", ")}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  followUpIntervalDays: e.target.value
                    .split(/[,;\s]+/)
                    .map((x) => parseInt(x.trim(), 10))
                    .filter((n) => Number.isFinite(n) && n > 0),
                })
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400">Global invoice CSS</label>
            <textarea
              value={settings.globalInvoiceCss}
              onChange={(e) => setSettings({ ...settings, globalInvoiceCss: e.target.value })}
              rows={8}
              placeholder=".bill-wrap { … } — single stylesheet for every quote and invoice (no per-document CSS)."
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-slate-400">Current effective invoice CSS (copy)</label>
              <button
                type="button"
                onClick={() => void onCopyCss()}
                className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {cssError && (
              <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {cssError}
              </p>
            )}
            <textarea
              value={effectiveCss}
              readOnly
              rows={10}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-slate-200"
            />
            <p className="mt-1 text-xs text-slate-600">
              This includes the built-in base CSS plus your Global invoice CSS override above.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Schedule <code className="rounded bg-white/10 px-1">GET /api/billing/cron/followups?token=…</code>{" "}
            using <code className="rounded bg-white/10 px-1">CREW_BILLING_CRON_SECRET</code>.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save workspace settings
          </button>
        </form>
      </div>
    </div>
  );
}
