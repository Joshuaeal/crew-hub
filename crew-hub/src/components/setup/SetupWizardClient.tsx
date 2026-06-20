"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type ModuleId = "billing" | "inventory" | "shifts" | "hr" | "comms" | "subcontractors" | "projects" | "socials";

const MODULES: { id: ModuleId; label: string; desc: string }[] = [
  { id: "billing", label: "Invoicing & Billing", desc: "Create and manage invoices, quotes, clients, catalog, and payables." },
  { id: "inventory", label: "Inventory", desc: "Stock management, item checkout, jobs, and approval workflows." },
  { id: "shifts", label: "Shifts & Scheduling", desc: "Shift list, schedule calendar, and crew management." },
  { id: "hr", label: "HR", desc: "Staff directory, leave requests, and HR document storage." },
  { id: "comms", label: "Communications", desc: "Matrix channels and production video (VDO.Ninja)." },
  { id: "subcontractors", label: "Subcontractor Portal", desc: "Let subcontractors log in, submit invoice PDFs, and access production video." },
  { id: "projects", label: "Projects", desc: "Manage productions as projects — files, talent, pricing, milestones, and invoice generation." },
  { id: "socials", label: "Socials", desc: "Track when your team last posted on Instagram, Facebook, and LinkedIn — a simple manual posting log." },
];

const ALL_MODULE_IDS: ModuleId[] = MODULES.map((m) => m.id);

type InstanceSettings = {
  companyName: string;
  invoiceLogoDataUrl?: string;
  faviconDataUrl?: string;
  matrixHomeserverUrl?: string;
  matrixClientUrl?: string;
  synapseAdminUrl?: string;
  uiCss?: string;
  invoiceSenderBlock?: string;
  vdoNinjaUrls?: string[];
  vdoRoomPassword?: string;
  vdoRoomPrefix?: string;
  invoiceNumberFormat?: string;
  invoiceSequenceStart?: number;
  palette: { brand: string; accent?: string; invoiceBase?: string; invoiceText?: string };
  skuOwnerCode?: string;
  enabledModules?: ModuleId[];
  setupComplete?: boolean;
  livekitUrl?: string;
  radioChannels?: string[];
  radioLatchingEnabled?: boolean;
  updatedAt: string;
};

type BillingSettings = {
  defaultTerms: string;
  defaultFromEmail: string;
  followUpIntervalDays: number[];
  globalInvoiceCss: string;
};

type TabId = "features" | "branding" | "comms" | "email" | "invoice" | "imports";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

async function fileToDataUrl(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  const b64 = btoa(bin);
  return `data:${file.type || "application/octet-stream"};base64,${b64}`;
}

export function SetupWizardClient() {
  const [tab, setTab] = useState<TabId>("features");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [cssError, setCssError] = useState<string | null>(null);

  const [instance, setInstance] = useState<InstanceSettings | null>(null);
  const [billing, setBilling] = useState<BillingSettings | null>(null);
  const [isFirstRun, setIsFirstRun] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [brand, setBrand] = useState("#5b8cff");
  const [accent, setAccent] = useState("#22c55e");
  const [invoiceBase, setInvoiceBase] = useState("#0b1220");
  const [invoiceText, setInvoiceText] = useState("#e2e8f0");
  const [skuOwnerCode, setSkuOwnerCode] = useState("CREW");
  const [invoiceLogoDataUrl, setInvoiceLogoDataUrl] = useState<string | undefined>(undefined);
  const [faviconDataUrl, setFaviconDataUrl] = useState<string | undefined>(undefined);
  const [matrixHomeserverUrl, setMatrixHomeserverUrl] = useState("");
  const [matrixClientUrl, setMatrixClientUrl] = useState("");
  const [synapseAdminUrl, setSynapseAdminUrl] = useState("");
  const [uiCss, setUiCss] = useState("");
  const [invoiceSenderBlock, setInvoiceSenderBlock] = useState("");
  const [vdoNinjaUrls, setVdoNinjaUrls] = useState("");
  const [vdoRoomPassword, setVdoRoomPassword] = useState("");
  const [vdoRoomPrefix, setVdoRoomPrefix] = useState("");
  const [livekitUrl, setLivekitUrl] = useState("");
  const [radioChannels, setRadioChannels] = useState("");
  const [radioLatchingEnabled, setRadioLatchingEnabled] = useState(false);
  const [invoiceNumberFormat, setInvoiceNumberFormat] = useState("");
  const [invoiceSequenceStart, setInvoiceSequenceStart] = useState("");
  const [enabledModules, setEnabledModules] = useState<ModuleId[]>(ALL_MODULE_IDS);

  const [defaultFromEmail, setDefaultFromEmail] = useState("");
  const [defaultTerms, setDefaultTerms] = useState("");
  const [globalInvoiceCss, setGlobalInvoiceCss] = useState("");
  const [effectiveCss, setEffectiveCss] = useState<string>("");
  const [copiedCss, setCopiedCss] = useState(false);

  const canSave = useMemo(() => Boolean(companyName.trim()), [companyName]);

  useEffect(() => {
    setBusy(true);
    Promise.all([
      fetch("/api/instance/settings", { credentials: "same-origin" }).then((r) => r.json()),
      fetch("/api/billing/settings", { credentials: "same-origin" }).then((r) => r.json()),
    ])
      .then(([a, b]) => {
        const inst = a?.settings as InstanceSettings | undefined;
        const bil = b?.settings as BillingSettings | undefined;
        if (inst) {
          setInstance(inst);
          setIsFirstRun(!inst.setupComplete);
          setCompanyName(inst.companyName || "");
          setBrand(inst.palette?.brand || "#5b8cff");
          setAccent(inst.palette?.accent || "#22c55e");
          setInvoiceBase(inst.palette?.invoiceBase || "#0b1220");
          setInvoiceText(inst.palette?.invoiceText || "#e2e8f0");
          setSkuOwnerCode(inst.skuOwnerCode || "CREW");
          setInvoiceLogoDataUrl(inst.invoiceLogoDataUrl);
          setFaviconDataUrl(inst.faviconDataUrl);
          setMatrixHomeserverUrl(inst.matrixHomeserverUrl || "");
          setMatrixClientUrl(inst.matrixClientUrl || "");
          setSynapseAdminUrl(inst.synapseAdminUrl || "");
          setUiCss(inst.uiCss || "");
          setInvoiceSenderBlock(inst.invoiceSenderBlock || "");
          setVdoNinjaUrls((inst.vdoNinjaUrls || []).join(", "));
          setVdoRoomPassword(inst.vdoRoomPassword || "");
          setVdoRoomPrefix(inst.vdoRoomPrefix || "");
          setLivekitUrl(inst.livekitUrl || "");
          setRadioChannels((inst.radioChannels || []).join(", "));
          setRadioLatchingEnabled(inst.radioLatchingEnabled ?? false);
          setInvoiceNumberFormat(inst.invoiceNumberFormat || "");
          setInvoiceSequenceStart(
            typeof inst.invoiceSequenceStart === "number" ? String(inst.invoiceSequenceStart) : ""
          );
          setEnabledModules(inst.enabledModules ?? ALL_MODULE_IDS);
        }
        if (bil) {
          setBilling(bil);
          setDefaultFromEmail(bil.defaultFromEmail || "");
          setDefaultTerms(bil.defaultTerms || "");
          setGlobalInvoiceCss(bil.globalInvoiceCss || "");
        }
      })
      .catch(() => setErr("Could not load settings"))
      .finally(() => setBusy(false));

    fetch("/api/billing/invoice-css", { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = typeof d?.error === "string" ? d.error : "Could not load effective invoice CSS";
          setCssError(msg);
          return;
        }
        if (typeof d?.effectiveCss === "string") setEffectiveCss(d.effectiveCss);
      })
      .catch(() => setCssError("Could not load effective invoice CSS"));
  }, []);

  async function onCopyEffectiveCss() {
    try {
      await navigator.clipboard.writeText(effectiveCss || "");
      setCopiedCss(true);
      window.setTimeout(() => setCopiedCss(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function saveAll() {
    setErr(null);
    setOk(null);
    if (!canSave) {
      setErr("Company name is required.");
      return;
    }
    setBusy(true);
    try {
      const [aRes, bRes] = await Promise.all([
        fetch("/api/instance/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            companyName,
            invoiceLogoDataUrl,
            faviconDataUrl,
            matrixHomeserverUrl,
            matrixClientUrl,
            synapseAdminUrl,
            uiCss,
            invoiceSenderBlock,
            vdoNinjaUrls,
            vdoRoomPassword,
            vdoRoomPrefix,
            livekitUrl,
            radioChannels: radioChannels.trim()
              ? radioChannels.split(",").map((s) => s.trim()).filter(Boolean)
              : undefined,
            radioLatchingEnabled,
            invoiceNumberFormat,
            invoiceSequenceStart: invoiceSequenceStart.trim()
              ? Number.parseInt(invoiceSequenceStart.trim(), 10)
              : undefined,
            palette: { brand, accent, invoiceBase, invoiceText },
            skuOwnerCode,
            enabledModules,
            setupComplete: true,
          }),
        }),
        fetch("/api/billing/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            defaultFromEmail,
            defaultTerms,
            globalInvoiceCss,
          }),
        }),
      ]);

      const a = await aRes.json().catch(() => ({}));
      const b = await bRes.json().catch(() => ({}));
      if (!aRes.ok) throw new Error(a?.error || "Could not save instance settings");
      if (!bRes.ok) throw new Error(b?.error || "Could not save billing settings");
      setInstance(a.settings);
      setBilling(b.settings);
      if (isFirstRun) {
        window.location.href = "/";
        return;
      }
      setOk("Saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPickLogo(file?: File | null) {
    setErr(null);
    setOk(null);
    if (!file) return;
    if (file.size > 1_500_000) {
      setErr("Logo is too large (max 1.5MB).");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErr("Please choose an image file.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setInvoiceLogoDataUrl(dataUrl);
    setOk("Logo loaded (remember to Save).");
  }

  async function onPickFavicon(file?: File | null) {
    setErr(null);
    setOk(null);
    if (!file) return;
    if (file.size > 1_500_000) {
      setErr("Favicon is too large (max 1.5MB).");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErr("Please choose an image file.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setFaviconDataUrl(dataUrl);
    setOk("Favicon loaded (remember to Save).");
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        {isFirstRun && (
          <div className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-slate-200">
            <strong className="text-brand/95">Welcome to Crew Hub.</strong> Choose which modules to
            enable for your team, set your company name and branding, then click{" "}
            <strong>Complete setup →</strong> to get started. You can change any of this later from
            Admin → Instance settings.
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {isFirstRun ? "Welcome — let's get you set up" : "Instance settings"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {isFirstRun
              ? "Pick your modules, set your company name, and configure the basics. Everything can be changed later."
              : "Configure branding, billing defaults, and invoice rendering for this instance."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["features", "Features"],
              ["branding", "Branding"],
              ["comms", "Service URLs"],
              ["email", "Email sender"],
              ["invoice", "Invoice template"],
              ["imports", "Imports"],
            ] as Array<[TabId, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={classNames(
                "rounded-lg px-3 py-2 text-sm ring-1 transition",
                tab === id
                  ? "bg-brand/20 text-brand/95 ring-brand/35"
                  : "bg-white/[0.03] text-slate-300 ring-white/10 hover:bg-white/[0.06]"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {(err || ok) && (
          <div
            className={classNames(
              "rounded-xl border px-4 py-3 text-sm",
              err
                ? "border-red-500/40 bg-red-500/10 text-red-100"
                : "border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
            )}
          >
            {err || ok}
          </div>
        )}

        {busy && !instance && (
          <p className="text-sm text-slate-500">Loading…</p>
        )}

        {instance && billing && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            {tab === "features" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white">Enabled modules</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Choose which features are available in this instance. Disabled modules are hidden
                    from navigation — you can change this at any time.
                  </p>
                </div>
                <div className="space-y-3">
                  {MODULES.map((mod) => {
                    const checked = enabledModules.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition ${
                          checked
                            ? "border-brand/40 bg-brand/10"
                            : "border-white/10 bg-white/[0.02] opacity-60"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setEnabledModules((prev) =>
                              e.target.checked
                                ? [...prev, mod.id]
                                : prev.filter((m) => m !== mod.id)
                            )
                          }
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 accent-brand"
                        />
                        <div>
                          <p className="text-sm font-medium text-white">{mod.label}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{mod.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-600">
                  Module visibility is also controlled by individual user permissions — enabling a module
                  here makes it available, but users still need the relevant permission assigned.
                </p>
              </div>
            )}

            {tab === "branding" && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Company name
                  </label>
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      Brand color
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="color"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="h-10 w-12 rounded border border-white/10 bg-black/30"
                        aria-label="Brand colour"
                      />
                      <input
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">Hex like #f4c430</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      Accent color
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="color"
                        value={accent}
                        onChange={(e) => setAccent(e.target.value)}
                        className="h-10 w-12 rounded border border-white/10 bg-black/30"
                        aria-label="Accent colour"
                      />
                      <input
                        value={accent}
                        onChange={(e) => setAccent(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      Default SKU owner
                    </label>
                    <input
                      value={skuOwnerCode}
                      onChange={(e) => setSkuOwnerCode(e.target.value.toUpperCase())}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                    />
                    <p className="mt-1 text-xs text-slate-600">Used as default owner code on imports.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Invoice base colour
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={invoiceBase}
                      onChange={(e) => setInvoiceBase(e.target.value)}
                      className="h-10 w-12 rounded border border-white/10 bg-black/30"
                      aria-label="Invoice base colour"
                    />
                    <input
                      value={invoiceBase}
                      onChange={(e) => setInvoiceBase(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Used for invoice/quote background in print/PDF.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Invoice text colour
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={invoiceText}
                      onChange={(e) => setInvoiceText(e.target.value)}
                      className="h-10 w-12 rounded border border-white/10 bg-black/30"
                      aria-label="Invoice text colour"
                    />
                    <input
                      value={invoiceText}
                      onChange={(e) => setInvoiceText(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Text colour for invoice/quote content.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Invoice logo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void onPickLogo(e.target.files?.[0])}
                    className="mt-2 block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/15"
                  />
                  {invoiceLogoDataUrl && (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                      <Image
                        alt="Invoice logo preview"
                        src={invoiceLogoDataUrl}
                        width={220}
                        height={40}
                        unoptimized
                        className="h-10 w-auto"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Favicon
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void onPickFavicon(e.target.files?.[0])}
                    className="mt-2 block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/15"
                  />
                  {faviconDataUrl && (
                    <div className="mt-3 inline-flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
                      <Image
                        alt="Favicon preview"
                        src={faviconDataUrl}
                        width={32}
                        height={32}
                        unoptimized
                        className="h-8 w-8 rounded"
                      />
                      <span className="text-xs text-slate-400">
                        Saved as this site’s favicon after you click Save.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    App UI CSS (advanced)
                  </label>
                  <textarea
                    value={uiCss}
                    onChange={(e) => setUiCss(e.target.value)}
                    rows={10}
                    placeholder={`/* Example: make dashboard tiles use your brand */\n/* .dash-tile { border-color: color-mix(in srgb, var(--brand) 30%, transparent); } */`}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <p className="mt-1 text-xs text-slate-600">
                    Injected into every page as a <code className="rounded bg-black/30 px-1">{"<style>"}</code>{" "}
                    tag. Use for dashboard tile colours/gradients and any extra UI tweaks.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Invoice sender block (shown on invoices)
                  </label>
                  <textarea
                    value={invoiceSenderBlock}
                    onChange={(e) => setInvoiceSenderBlock(e.target.value)}
                    rows={6}
                    placeholder={`Alegre Visual\n1 Caspian St Kialla\nT: +61 404 560 744\nE: josh@alegrevisual.com\nABN 54955049478`}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <p className="mt-1 text-xs text-slate-600">
                    Optional. Multi-line text rendered in the invoice header section.
                  </p>
                </div>
              </div>
            )}

            {tab === "comms" && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Matrix homeserver URL (Synapse)
                  </label>
                  <input
                    value={matrixHomeserverUrl}
                    onChange={(e) => setMatrixHomeserverUrl(e.target.value)}
                    placeholder="https://crew.alegrevisual.com"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <p className="mt-1 text-xs text-slate-600">
                    Used for onboarding links and direct homeserver references. If you use the hub proxy
                    (recommended), you’ll still log into Element using this Crew Hub URL.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Matrix client URL (Element)
                  </label>
                  <input
                    value={matrixClientUrl}
                    onChange={(e) => setMatrixClientUrl(e.target.value)}
                    placeholder="https://app.element.io"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <p className="mt-1 text-xs text-slate-600">
                    Leave blank to use the default (Element Web).
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Synapse Admin URL
                  </label>
                  <input
                    value={synapseAdminUrl}
                    onChange={(e) => setSynapseAdminUrl(e.target.value)}
                    placeholder="https://crew.alegrevisual.com/synapse-admin"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <p className="mt-1 text-xs text-slate-600">
                    Where the synapse-admin web UI is published (reverse proxy or tunnel).
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    LiveKit URL (radio comms)
                  </label>
                  <input
                    value={livekitUrl}
                    onChange={(e) => setLivekitUrl(e.target.value)}
                    placeholder="ws://localhost:7880"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <p className="mt-1 text-xs text-slate-600">
                    WebSocket URL of your LiveKit server. Use <code className="rounded bg-black/30 px-1">ws://</code> for LAN or <code className="rounded bg-black/30 px-1">wss://</code> for a tunnelled URL. Leave blank to default to <code className="rounded bg-black/30 px-1">ws://localhost:7880</code>.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Radio channels
                  </label>
                  <input
                    value={radioChannels}
                    onChange={(e) => setRadioChannels(e.target.value)}
                    placeholder="Main, Stage, Camera, Sound, Director"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <p className="mt-1 text-xs text-slate-600">
                    Comma-separated channel names. Leave blank for defaults (Main, Stage, Camera, Sound, Director). Use <code className="rounded bg-black/30 px-1">Label:room-name</code> to set a custom room ID.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Allow latching mic mode</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      When enabled, participants whose display name matches a known username can switch from push-to-talk to latching (press once to transmit, press again to stop). PTT remains the default for everyone.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRadioLatchingEnabled((v) => !v)}
                    className={`ml-4 shrink-0 relative h-6 w-11 rounded-full transition-colors ${radioLatchingEnabled ? "bg-brand/70" : "bg-slate-600"}`}
                    aria-label="Toggle latching mic mode"
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${radioLatchingEnabled ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    VDO.Ninja URL(s)
                  </label>
                  <input
                    value={vdoNinjaUrls}
                    onChange={(e) => setVdoNinjaUrls(e.target.value)}
                    placeholder="https://vdo.ninja"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <p className="mt-1 text-xs text-slate-600">
                    Comma-separated. Leave blank to use defaults/environment.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      VDO room password
                    </label>
                    <input
                      value={vdoRoomPassword}
                      onChange={(e) => setVdoRoomPassword(e.target.value)}
                      placeholder="storyteller"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                    />
                    <p className="mt-1 text-xs text-slate-600">
                      Alphanumeric recommended. Leave blank to use env/default.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      VDO room prefix
                    </label>
                    <input
                      value={vdoRoomPrefix}
                      onChange={(e) => setVdoRoomPrefix(e.target.value)}
                      placeholder="rc"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                    />
                    <p className="mt-1 text-xs text-slate-600">
                      Prepended to generated room IDs. Leave blank for <code className="rounded bg-black/30 px-1">rc</code>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {tab === "email" && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Default “from” email
                  </label>
                  <input
                    value={defaultFromEmail}
                    onChange={(e) => setDefaultFromEmail(e.target.value)}
                    placeholder="accounts@yourdomain.com"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <p className="mt-1 text-xs text-slate-600">
                    Used when sending invoices/quotes (can be overridden per document).
                  </p>
                </div>
              </div>
            )}

            {tab === "invoice" && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Default terms
                  </label>
                  <textarea
                    value={defaultTerms}
                    onChange={(e) => setDefaultTerms(e.target.value)}
                    rows={5}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Invoice number format
                  </label>
                  <input
                    value={invoiceNumberFormat}
                    onChange={(e) => setInvoiceNumberFormat(e.target.value)}
                    placeholder="INV-{YYYY}-{SEQ:4}"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <p className="mt-1 text-xs text-slate-600">
                    Tokens: {"{KIND}"} {"{YYYY}"} {"{YY}"} {"{SEQ}"} or {"{SEQ:4}"}.
                    Leave blank for default.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Invoice sequence start (optional)
                  </label>
                  <input
                    value={invoiceSequenceStart}
                    onChange={(e) => setInvoiceSequenceStart(e.target.value)}
                    placeholder="208"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <p className="mt-1 text-xs text-slate-600">
                    Used only when there are no existing invoices matching the current format/year.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Global invoice CSS (optional)
                  </label>
                  <textarea
                    value={globalInvoiceCss}
                    onChange={(e) => setGlobalInvoiceCss(e.target.value)}
                    rows={10}
                    className="mt-1 w-full font-mono text-xs rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-slate-300">
                      Current effective invoice CSS (copy)
                    </label>
                    <button
                      type="button"
                      onClick={() => void onCopyEffectiveCss()}
                      className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
                    >
                      {copiedCss ? "Copied" : "Copy"}
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
              </div>
            )}

            {tab === "imports" && (
              <div className="space-y-4 text-sm text-slate-300">
                <p className="text-slate-400">
                  Imports are supported via the existing tools:
                </p>
                <ul className="list-disc pl-5 text-slate-400">
                  <li>
                    Inventory: use <code className="rounded bg-black/30 px-1">Admin → Import inventory (CSV)</code>
                  </li>
                  <li>
                    Invoices: place existing billing JSON into{" "}
                    <code className="rounded bg-black/30 px-1">.data/billing-invoices.json</code>
                    {" "}
                    (format matches the Billing workspace).
                  </li>
                </ul>
                <p className="text-slate-500">
                  Next step: I can add a guided importer UI here (CSV/JSON upload) for both invoices and inventory.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            Last saved:{" "}
            <span className="text-slate-400">
              {instance?.updatedAt ? new Date(instance.updatedAt).toLocaleString() : "—"}
            </span>
          </p>
          <button
            type="button"
            disabled={busy || !canSave}
            onClick={() => void saveAll()}
            className="rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand/90 disabled:opacity-60"
          >
            {busy ? "Saving…" : isFirstRun ? "Complete setup →" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

