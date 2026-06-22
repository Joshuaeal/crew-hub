"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Link2,
  Link2Off,
  Loader2,
  Paperclip,
  Plus,
  Receipt,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AffineEmbed } from "@/components/AffineEmbed";
import type { Project, ProjectFile } from "@/types/projects";
import { SpreadsheetImporter } from "@/components/SpreadsheetImporter";
import {
  PROJECT_CATEGORIES,
  PROJECT_SERVICE_TYPES,
  PROJECT_STATUSES,
} from "@/types/projects";
import { GanttChart } from "@/components/GanttChart";


const STATUS_COLORS: Record<string, string> = {
  Draft: "text-slate-400 bg-slate-500/15 ring-slate-500/25",
  Confirmed: "text-blue-300 bg-blue-500/15 ring-blue-500/25",
  "In Progress": "text-amber-300 bg-amber-500/15 ring-amber-500/25",
  Complete: "text-emerald-300 bg-emerald-500/15 ring-emerald-500/25",
  Cancelled: "text-red-300 bg-red-500/15 ring-red-500/25",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_COLORS[status] ?? "text-slate-400 bg-slate-500/15 ring-slate-500/25"}`}
    >
      {status}
    </span>
  );
}

function fmtDate(d?: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(dueDate: string, status: string): boolean {
  if (status === "Done") return false;
  return new Date(dueDate) < new Date();
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isPreviewable(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

type Props = {
  initialProject: Project;
  slug: string;
  canManage: boolean;
  clientNames: Record<string, string>;
  clientList: { id: string; name: string }[];
  userList: { id: string; email: string; displayName?: string }[];
  /** AFFiNE server URL from instance settings — used for the board embed. */
  affineUrl?: string;
  currentUserId?: string;
};

export function ProjectDetailClient({
  initialProject,
  slug,
  canManage,
  clientNames,
  clientList,
  userList,
  affineUrl,
  currentUserId,
}: Props) {
  const [project, setProject] = useState<Project>(initialProject);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Overview edit state
  const [editingOverview, setEditingOverview] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editCategory, setEditCategory] = useState(project.category);
  const [editServiceTypes, setEditServiceTypes] = useState<string[]>(project.serviceTypes);
  const [editStatus, setEditStatus] = useState(project.status);
  const [editStartDate, setEditStartDate] = useState(project.startDate ?? "");
  const [editEndDate, setEditEndDate] = useState(project.endDate ?? "");
  const [editClientId, setEditClientId] = useState(project.clientId ?? "");

  // Talent form
  const [showTalentForm, setShowTalentForm] = useState(false);
  const [talentFormMode, setTalentFormMode] = useState<"specific" | "open">("specific");
  const [tPersonId, setTPersonId] = useState("");
  const [tExtName, setTExtName] = useState("");
  const [tExtContact, setTExtContact] = useState("");
  const [tRole, setTRole] = useState("");
  const [tRate, setTRate] = useState("");
  const [tRateUnit, setTRateUnit] = useState<"hourly" | "daily">("daily");
  const [tConfirmed, setTConfirmed] = useState(false);

  // Line item form
  const [showLineForm, setShowLineForm] = useState(false);
  const [liDesc, setLiDesc] = useState("");
  const [liQty, setLiQty] = useState("1");
  const [liPrice, setLiPrice] = useState("0");

  // Milestone form
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const [msDue, setMsDue] = useState("");

  // Spreadsheet importer
  const [importTarget, setImportTarget] = useState<"talent" | "line-items" | null>(null);

  // AFFiNE board link
  const [affineEditUrl, setAffineEditUrl] = useState(project.affineDocUrl ?? "");
  const [affineLinking, setAffineLinking] = useState(false);
  const [affineShowEmbed, setAffineShowEmbed] = useState(Boolean(project.affineDocUrl));

  // Billing docs linked to this project
  type BillingRow = { id: string; kind: string; number: string; status: string; customerName: string; totalIncGst?: number };
  const [billingDocs, setBillingDocs] = useState<BillingRow[]>([]);
  const [billingBusy, setBillingBusy] = useState(false);

  const fetchBillingDocs = useCallback(async () => {
    try {
      const r = await fetch(`/api/projects/${slug}/billing`, { credentials: "same-origin" });
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d.items)) setBillingDocs(d.items as BillingRow[]);
    } catch {
      // billing permission may not be available — silently skip
    }
  }, [slug]);

  useEffect(() => { void fetchBillingDocs(); }, [fetchBillingDocs]);

  async function createBillingDoc(kind: "invoice" | "quote") {
    setBillingBusy(true);
    try {
      const r = await fetch(`/api/projects/${slug}/billing`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      const doc = d.item as BillingRow;
      setBillingDocs((prev) => [doc, ...prev]);
      // Navigate to the new doc in billing
      window.open(`/billing/${doc.id}`, "_blank");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Failed", true);
    } finally {
      setBillingBusy(false);
    }
  }

  const fetchFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const r = await fetch(`/api/projects/${slug}/files`, { credentials: "same-origin" });
      const d = await r.json();
      if (r.ok && Array.isArray(d.files)) setFiles(d.files as ProjectFile[]);
    } finally {
      setLoadingFiles(false);
    }
  }, [slug]);

  useEffect(() => { void fetchFiles(); }, [fetchFiles]);

  function flash(msg: string, isErr = false) {
    if (isErr) { setErr(msg); setOk(null); }
    else { setOk(msg); setErr(null); }
    window.setTimeout(() => { setErr(null); setOk(null); }, 3000);
  }

  async function saveOverview() {
    setBusy(true);
    try {
      const r = await fetch(`/api/projects/${slug}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          category: editCategory,
          serviceTypes: editServiceTypes,
          status: editStatus,
          startDate: editStartDate || null,
          endDate: editEndDate || null,
          clientId: editClientId || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Save failed");
      setProject(d.project as Project);
      setEditingOverview(false);
      flash("Saved.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Save failed", true);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`/api/projects/${slug}/files`, {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Upload failed");
      setFiles((prev) => [...prev, d.file as ProjectFile]);
      flash("File uploaded.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Upload failed", true);
    } finally {
      setBusy(false);
    }
  }

  async function deleteFile(fileId: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/projects/${slug}/files/${fileId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error("Delete failed");
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      flash("File deleted.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Delete failed", true);
    } finally {
      setBusy(false);
    }
  }

  async function addTalent() {
    const role = tRole.trim();
    if (!role) return;
    setBusy(true);
    try {
      const isOpen = talentFormMode === "open";
      const r = await fetch(`/api/projects/${slug}/talent`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: isOpen ? undefined : (tPersonId || undefined),
          externalName: isOpen ? undefined : (tExtName || undefined),
          externalContact: isOpen ? undefined : (tExtContact || undefined),
          role,
          rate: tRate ? parseFloat(tRate) : undefined,
          rateUnit: tRate ? tRateUnit : undefined,
          confirmed: isOpen ? false : tConfirmed,
          isOpen,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setProject(d.project as Project);
      setShowTalentForm(false);
      setTPersonId(""); setTExtName(""); setTExtContact(""); setTRole(""); setTRate(""); setTRateUnit("daily"); setTConfirmed(false);
      flash(isOpen ? "Open slot added." : "Talent added.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Failed", true);
    } finally {
      setBusy(false);
    }
  }

  async function toggleTalentConfirmed(talentId: string, current: boolean) {
    const r = await fetch(`/api/projects/${slug}/talent/${talentId}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: !current }),
    });
    const d = await r.json();
    if (r.ok) setProject(d.project as Project);
  }

  async function removeTalent(talentId: string) {
    const r = await fetch(`/api/projects/${slug}/talent/${talentId}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const d = await r.json();
    if (r.ok) setProject(d.project as Project);
  }

  async function respondToRequest(talentId: string, status: "accepted" | "declined") {
    const r = await fetch(`/api/projects/${slug}/talent/${talentId}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestStatus: status }),
    });
    const d = await r.json();
    if (r.ok) setProject(d.project as Project);
    else flash(d.error ?? "Failed", true);
  }

  async function claimOpenSlot(talentId: string) {
    const r = await fetch(`/api/projects/${slug}/talent/${talentId}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim: true }),
    });
    const d = await r.json();
    if (r.ok) { setProject(d.project as Project); flash("Claimed — awaiting admin approval."); }
    else flash(d.error ?? "Failed", true);
  }


  async function addLineItem() {
    const desc = liDesc.trim();
    if (!desc) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/projects/${slug}/line-items`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: desc,
          quantity: parseFloat(liQty) || 1,
          unitPrice: parseFloat(liPrice) || 0,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setProject(d.project as Project);
      setShowLineForm(false);
      setLiDesc(""); setLiQty("1"); setLiPrice("0");
      flash("Line item added.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Failed", true);
    } finally {
      setBusy(false);
    }
  }

  async function removeLineItem(itemId: string) {
    const r = await fetch(`/api/projects/${slug}/line-items/${itemId}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const d = await r.json();
    if (r.ok) setProject(d.project as Project);
  }

  async function addMilestone() {
    const title = msTitle.trim();
    if (!title || !msDue) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/projects/${slug}/milestones`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueDate: msDue }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setProject(d.project as Project);
      setShowMilestoneForm(false);
      setMsTitle(""); setMsDue("");
      flash("Milestone added.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Failed", true);
    } finally {
      setBusy(false);
    }
  }

  async function toggleMilestone(msId: string, current: string) {
    const nextStatus = current === "Done" ? "Pending" : "Done";
    const r = await fetch(`/api/projects/${slug}/milestones/${msId}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const d = await r.json();
    if (r.ok) setProject(d.project as Project);
  }

  async function removeMilestone(msId: string) {
    const r = await fetch(`/api/projects/${slug}/milestones/${msId}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const d = await r.json();
    if (r.ok) setProject(d.project as Project);
  }

  async function generateInvoice() {
    setBusy(true);
    try {
      const r = await fetch(`/api/projects/${slug}/generate-invoice`, {
        method: "POST",
        credentials: "same-origin",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      flash(`Draft invoice ${d.invoice.number} created.`);
      void fetchBillingDocs();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Failed", true);
    } finally {
      setBusy(false);
    }
  }

  const lineTotal = project.lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPrice,
    0
  );

  return (
    <>
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-10 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-white">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {project.category}
              {project.serviceTypes.length > 0 && ` · ${project.serviceTypes.join(", ")}`}
              {project.startDate && ` · ${fmtDate(project.startDate)}${project.endDate ? ` → ${fmtDate(project.endDate)}` : ""}`}
              {project.clientId && clientNames[project.clientId] && ` · ${clientNames[project.clientId]}`}
            </p>
          </div>
        </div>

        {(err || ok) && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${err ? "border-red-500/40 bg-red-500/10 text-red-100" : "border-emerald-500/35 bg-emerald-500/10 text-emerald-100"}`}
          >
            {err || ok}
          </div>
        )}

        {/* Overview */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overview</h2>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            {!editingOverview ? (
              <div className="space-y-4">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">Category</dt>
                    <dd className="mt-0.5 text-sm text-white">{project.category}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Status</dt>
                    <dd className="mt-0.5"><StatusBadge status={project.status} /></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Services</dt>
                    <dd className="mt-0.5 text-sm text-white">
                      {project.serviceTypes.length > 0 ? project.serviceTypes.join(", ") : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Client</dt>
                    <dd className="mt-0.5 text-sm text-white">
                      {project.clientId && clientNames[project.clientId]
                        ? clientNames[project.clientId]
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Start date</dt>
                    <dd className="mt-0.5 text-sm text-white">{fmtDate(project.startDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">End date</dt>
                    <dd className="mt-0.5 text-sm text-white">{fmtDate(project.endDate)}</dd>
                  </div>
                </dl>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditName(project.name);
                      setEditCategory(project.category);
                      setEditServiceTypes([...project.serviceTypes]);
                      setEditStatus(project.status);
                      setEditStartDate(project.startDate ?? "");
                      setEditEndDate(project.endDate ?? "");
                      setEditClientId(project.clientId ?? "");
                      setEditingOverview(true);
                    }}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
                  >
                    Edit overview
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Category</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as typeof editCategory)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                    >
                      {PROJECT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as typeof editStatus)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                    >
                      {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Start date</label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">End date</label>
                    <input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Client</label>
                    <select
                      value={editClientId}
                      onChange={(e) => setEditClientId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                    >
                      <option value="">No client</option>
                      {clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Service types</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PROJECT_SERVICE_TYPES.map((st) => {
                      const checked = editServiceTypes.includes(st);
                      return (
                        <label
                          key={st}
                          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition ${checked ? "border-brand/40 bg-brand/15 text-brand/90" : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20"}`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={(e) =>
                              setEditServiceTypes((prev) =>
                                e.target.checked ? [...prev, st] : prev.filter((s) => s !== st)
                              )
                            }
                          />
                          {st}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveOverview()}
                    className="rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand/80 disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingOverview(false)}
                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </section>

        {/* AFFiNE Board */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Workspace Board</h2>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            {project.affineDocUrl && affineShowEmbed ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{project.affineDocUrl}</span>
                  <a
                    href={project.affineDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    <ExternalLink className="h-3 w-3" /> Open
                  </a>
                  {canManage && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm("Unlink this AFFiNE board from the project?")) return;
                        setAffineLinking(true);
                        await fetch(`/api/projects/${slug}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ affineDocUrl: null }),
                        });
                        setProject((p) => ({ ...p, affineDocUrl: undefined }));
                        setAffineEditUrl("");
                        setAffineShowEmbed(false);
                        setAffineLinking(false);
                      }}
                      disabled={affineLinking}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <Link2Off className="h-3 w-3" /> Unlink
                    </button>
                  )}
                </div>
                <div className="h-[80vh] rounded-lg overflow-hidden border border-white/10 flex flex-col">
                  <AffineEmbed
                    affineUrl={affineUrl}
                    docPath={(() => {
                      try {
                        const u = new URL(project.affineDocUrl!);
                        return u.pathname + u.search + u.hash;
                      } catch {
                        return undefined;
                      }
                    })()}
                    title="Project Board"
                  />
                </div>
              </>
            ) : project.affineDocUrl ? (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{project.affineDocUrl}</span>
                <button
                  type="button"
                  onClick={() => setAffineShowEmbed(true)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-brand/90 ring-1 ring-brand/30 hover:bg-brand/10"
                >
                  <Link2 className="h-3 w-3" /> Show board
                </button>
              </div>
            ) : canManage ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">
                  Link an AFFiNE board to embed it inline. Paste the AFFiNE document URL below.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="url"
                    placeholder="https://boards.raconteur.melbourne/workspace/…"
                    value={affineEditUrl}
                    onChange={(e) => setAffineEditUrl(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand/50"
                  />
                  <button
                    type="button"
                    disabled={!affineEditUrl.trim() || affineLinking}
                    onClick={async () => {
                      const url = affineEditUrl.trim();
                      if (!url) return;
                      setAffineLinking(true);
                      const res = await fetch(`/api/projects/${slug}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ affineDocUrl: url }),
                      });
                      if (res.ok) {
                        const d = await res.json();
                        setProject(d.project as Project);
                        setAffineShowEmbed(true);
                      }
                      setAffineLinking(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand/20 px-3 py-2 text-sm font-medium text-brand/95 ring-1 ring-brand/30 hover:bg-brand/30 disabled:opacity-50"
                  >
                    {affineLinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                    Link board
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No AFFiNE board linked to this project.</p>
            )}
          </div>
        </section>

        {/* Files */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Files</h2>
          <div className="space-y-4">
            {canManage && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadFile(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-60"
                >
                  <Paperclip className="h-4 w-4" aria-hidden />
                  Upload file
                </button>
                <p className="mt-2 text-xs text-slate-600">
                  PDF, images (JPEG, PNG, WebP, HEIC), Word documents. Max 25 MB.
                </p>
              </div>
            )}

            {loadingFiles ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
              </p>
            ) : files.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center text-sm text-slate-500">
                No files yet.{canManage ? " Upload one above." : ""}
              </p>
            ) : (
              <ul className="space-y-2">
                {files.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      {isPreviewable(f.mimeType) ? (
                        <a
                          href={`/api/projects/${slug}/files/${f.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-brand/90 hover:underline"
                        >
                          {f.filename}
                        </a>
                      ) : (
                        <a
                          href={`/api/projects/${slug}/files/${f.id}`}
                          download={f.filename}
                          className="text-sm font-medium text-brand/90 hover:underline"
                        >
                          {f.filename} ↓
                        </a>
                      )}
                      <p className="mt-0.5 text-xs text-slate-500">
                        {fmtSize(f.sizeBytes)} · {new Date(f.uploadedAt).toLocaleDateString("en-AU")}
                      </p>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => void deleteFile(f.id)}
                        disabled={busy}
                        className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-red-500/15 hover:text-red-300"
                        aria-label="Delete file"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Talent */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Talent ({project.talent.length})</h2>
          <div className="space-y-4">
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setTalentFormMode("specific"); setShowTalentForm((v) => !v); }}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
                >
                  <Users className="h-4 w-4" aria-hidden />
                  {showTalentForm ? "Cancel" : "Add talent"}
                </button>
                <button
                  type="button"
                  onClick={() => setImportTarget("talent")}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
                >
                  <FileSpreadsheet className="h-4 w-4" aria-hidden />
                  Import from spreadsheet
                </button>
              </div>
            )}
            {canManage && (
              <div>
                <button
                  type="button"
                  onClick={() => { setTalentFormMode("open"); setShowTalentForm(true); }}
                  className="inline-flex items-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/[0.02] px-4 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-300"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add open slot
                </button>
              </div>
            )}

            {showTalentForm && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                {talentFormMode === "open" && (
                  <p className="text-xs text-amber-400/80">
                    Open slot — any crew member can claim this role.
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {talentFormMode === "specific" && (
                    <div>
                      <label className="block text-xs text-slate-400">Internal crew member</label>
                      <select
                        value={tPersonId}
                        onChange={(e) => setTPersonId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                      >
                        <option value="">External / no account</option>
                        {userList.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.displayName ?? u.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-slate-400">Role</label>
                    <input
                      value={tRole}
                      onChange={(e) => setTRole(e.target.value)}
                      placeholder="e.g. Camera Op"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                    />
                  </div>
                  {talentFormMode === "specific" && !tPersonId && (
                    <>
                      <div>
                        <label className="block text-xs text-slate-400">External name</label>
                        <input
                          value={tExtName}
                          onChange={(e) => setTExtName(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400">External contact</label>
                        <input
                          value={tExtContact}
                          onChange={(e) => setTExtContact(e.target.value)}
                          placeholder="email or phone"
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs text-slate-400">Rate (AUD ex GST, optional)</label>
                    <div className="mt-1 flex gap-2">
                      <input
                        value={tRate}
                        onChange={(e) => setTRate(e.target.value)}
                        type="number"
                        min="0"
                        step="0.01"
                        className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                      />
                      <div className="flex rounded-lg border border-white/10 overflow-hidden">
                        {(["hourly", "daily"] as const).map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setTRateUnit(u)}
                            className={`px-2.5 py-2 text-xs font-medium transition ${
                              tRateUnit === u
                                ? "bg-brand/40 text-white"
                                : "bg-black/20 text-slate-500 hover:text-white"
                            }`}
                          >
                            {u === "hourly" ? "/hr" : "/day"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {talentFormMode === "specific" && (
                    <div className="flex items-end">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={tConfirmed}
                          onChange={(e) => setTConfirmed(e.target.checked)}
                          className="rounded accent-brand"
                        />
                        Confirmed
                      </label>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busy || !tRole.trim()}
                  onClick={() => void addTalent()}
                  className="rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand/80 disabled:opacity-60"
                >
                  {busy ? "Adding…" : talentFormMode === "open" ? "Add open slot" : "Add"}
                </button>
              </div>
            )}

            {project.talent.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center text-sm text-slate-500">
                No talent assigned.
              </p>
            ) : (
              <ul className="space-y-2">
                {project.talent.map((t) => {
                  const isMyEntry = !!currentUserId && t.personId === currentUserId;
                  const isOpenSlot = t.isOpen && !t.personId;
                  const display = isOpenSlot
                    ? "Open slot"
                    : t.personId
                    ? (userList.find((u) => u.id === t.personId)?.displayName ??
                      userList.find((u) => u.id === t.personId)?.email ??
                      t.personId)
                    : (t.externalName ?? "External");
                  return (
                    <li
                      key={t.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                        isOpenSlot
                          ? "border-amber-500/20 bg-amber-500/[0.04]"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-sm font-medium ${isOpenSlot ? "text-amber-300/80 italic" : "text-white"}`}>{display}</p>
                          <span className="text-xs text-slate-500">{t.role}</span>
                          {isOpenSlot ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-400/80">
                              <Circle className="h-3 w-3" /> Open for claims
                            </span>
                          ) : t.requestStatus === "pending" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                              <Circle className="h-3 w-3" /> Requested
                            </span>
                          ) : t.requestStatus === "accepted" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" /> Accepted
                            </span>
                          ) : t.requestStatus === "declined" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-red-400">
                              <X className="h-3 w-3" /> Declined
                            </span>
                          ) : t.confirmed ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" /> Confirmed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Circle className="h-3 w-3" /> Unconfirmed
                            </span>
                          )}
                        </div>
                        {t.externalContact && (
                          <p className="mt-0.5 text-xs text-slate-500">{t.externalContact}</p>
                        )}
                        {t.rate !== undefined && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            ${t.rate.toFixed(2)}/{t.rateUnit === "hourly" ? "hr" : "day"}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {/* Crew member: claim open slot */}
                        {isOpenSlot && !canManage && (
                          <button
                            type="button"
                            onClick={() => void claimOpenSlot(t.id)}
                            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
                          >
                            Claim
                          </button>
                        )}
                        {/* Crew member: respond to a request directed at them */}
                        {isMyEntry && t.requestStatus === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() => void respondToRequest(t.id, "accepted")}
                              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => void respondToRequest(t.id, "declined")}
                              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {canManage && (
                          <>
                            {!isOpenSlot && (
                              <button
                                type="button"
                                onClick={() => void toggleTalentConfirmed(t.id, t.confirmed)}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-white"
                                title={t.confirmed ? "Mark unconfirmed" : "Mark confirmed"}
                              >
                                {t.confirmed ? (
                                  <X className="h-4 w-4" aria-hidden />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void removeTalent(t.id)}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/15 hover:text-red-300"
                              aria-label="Remove"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Pricing */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pricing</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-400">
                Total: <span className="font-semibold text-white">${lineTotal.toFixed(2)} ex GST</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowLineForm((v) => !v)}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      {showLineForm ? "Cancel" : "Add line item"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportTarget("line-items")}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
                    >
                      <FileSpreadsheet className="h-4 w-4" aria-hidden />
                      Import from spreadsheet
                    </button>
                  </>
                )}
                {canManage && project.lineItems.length > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void generateInvoice()}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/20 disabled:opacity-60"
                  >
                    <Receipt className="h-4 w-4" aria-hidden />
                    {busy ? "Creating…" : "Generate invoice"}
                  </button>
                )}
              </div>
            </div>

            {showLineForm && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-1">
                    <label className="block text-xs text-slate-400">Description</label>
                    <input
                      value={liDesc}
                      onChange={(e) => setLiDesc(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Qty</label>
                    <input
                      value={liQty}
                      onChange={(e) => setLiQty(e.target.value)}
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Unit price (AUD ex GST)</label>
                    <input
                      value={liPrice}
                      onChange={(e) => setLiPrice(e.target.value)}
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || !liDesc.trim()}
                  onClick={() => void addLineItem()}
                  className="rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand/80 disabled:opacity-60"
                >
                  {busy ? "Adding…" : "Add"}
                </button>
              </div>
            )}

            {project.lineItems.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center text-sm text-slate-500">
                No line items yet.
              </p>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Description</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                      {canManage && <th className="px-4 py-2.5" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {project.lineItems.map((li) => (
                      <tr key={li.id}>
                        <td className="px-4 py-2.5 text-white">{li.description}</td>
                        <td className="px-4 py-2.5 text-right text-slate-300">{li.quantity}</td>
                        <td className="px-4 py-2.5 text-right text-slate-300">${li.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-white">
                          ${(li.quantity * li.unitPrice).toFixed(2)}
                        </td>
                        {canManage && (
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => void removeLineItem(li.id)}
                              className="rounded p-1 text-slate-500 hover:bg-red-500/15 hover:text-red-300"
                              aria-label="Remove"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="bg-white/[0.02]">
                      <td colSpan={canManage ? 3 : 3} className="px-4 py-2.5 text-right text-xs text-slate-500">
                        Subtotal ex GST
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-white">
                        ${lineTotal.toFixed(2)}
                      </td>
                      {canManage && <td />}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Billing */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Billing</h2>
          {project.talent.some((t) => t.rate !== undefined) &&
            billingDocs.some((d) => ["sent", "accepted", "paid"].includes(d.status)) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-xs text-amber-200">
              Labour entries have rates set. If talent has changed since a quote or invoice was sent, review those documents — labour lines are not updated automatically after creation.
            </div>
          )}
          <div className="space-y-4">
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={billingBusy}
                  onClick={() => void createBillingDoc("quote")}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-60"
                >
                  <FileText className="h-4 w-4" aria-hidden />
                  {billingBusy ? "Creating…" : "New quote"}
                </button>
                <button
                  type="button"
                  disabled={billingBusy}
                  onClick={() => void createBillingDoc("invoice")}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/20 disabled:opacity-60"
                >
                  <Receipt className="h-4 w-4" aria-hidden />
                  {billingBusy ? "Creating…" : "New invoice"}
                </button>
              </div>
            )}

            {billingDocs.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center text-sm text-slate-500">
                No quotes or invoices yet.{canManage ? " Create one above." : ""}
              </p>
            ) : (
              <ul className="space-y-2">
                {billingDocs.map((doc) => {
                  const statusColors: Record<string, string> = {
                    draft: "text-slate-400 bg-slate-500/15 ring-slate-500/25",
                    sent: "text-blue-300 bg-blue-500/15 ring-blue-500/25",
                    accepted: "text-emerald-300 bg-emerald-500/15 ring-emerald-500/25",
                    paid: "text-emerald-300 bg-emerald-500/15 ring-emerald-500/25",
                    declined: "text-red-300 bg-red-500/15 ring-red-500/25",
                    void: "text-slate-500 bg-slate-500/10 ring-slate-500/20",
                  };
                  return (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {doc.kind}
                          </span>
                          <span className="text-sm font-medium text-white">{doc.number}</span>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${statusColors[doc.status] ?? statusColors.draft}`}
                          >
                            {doc.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{doc.customerName}</p>
                      </div>
                      <a
                        href={`/billing/${doc.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                      >
                        Open <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Timeline */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Timeline</h2>
          <GanttChart
            tracks={[{
              id:        project.id,
              slug:      project.slug,
              label:     project.name,
              status:    project.status,
              startDate: project.startDate,
              endDate:   project.endDate,
              canManage,
              milestones: project.milestones,
            }]}
            mode="single"
            onMilestoneDateChange={async (_slug, milestoneId, dueDate) => {
              const res = await fetch(`/api/projects/${slug}/milestones/${milestoneId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dueDate }),
              });
              if (!res.ok) throw new Error("Failed to update milestone");
              const data = (await res.json()) as { project: Project };
              setProject(data.project);
            }}
          />
        </section>

        {/* Milestones */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Milestones ({project.milestones.length})</h2>
          <div className="space-y-4">
            {canManage && (
              <button
                type="button"
                onClick={() => setShowMilestoneForm((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {showMilestoneForm ? "Cancel" : "Add milestone"}
              </button>
            )}

            {showMilestoneForm && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs text-slate-400">Title</label>
                    <input
                      value={msTitle}
                      onChange={(e) => setMsTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Due date</label>
                    <input
                      type="date"
                      value={msDue}
                      onChange={(e) => setMsDue(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || !msTitle.trim() || !msDue}
                  onClick={() => void addMilestone()}
                  className="rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand/80 disabled:opacity-60"
                >
                  {busy ? "Adding…" : "Add"}
                </button>
              </div>
            )}

            {project.milestones.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center text-sm text-slate-500">
                No milestones yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {[...project.milestones]
                  .sort((a, b) => {
                    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
                    return a.dueDate.localeCompare(b.dueDate);
                  })
                  .map((m) => {
                    const overdue = isOverdue(m.dueDate, m.status);
                    return (
                      <li
                        key={m.id}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${overdue ? "border-red-500/30 bg-red-500/[0.06]" : "border-white/10 bg-white/[0.03]"}`}
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() => canManage && void toggleMilestone(m.id, m.status)}
                            className="mt-0.5 shrink-0 text-slate-500 hover:text-brand/90 disabled:cursor-default disabled:opacity-50"
                            aria-label={m.status === "Done" ? "Mark pending" : "Mark done"}
                          >
                            {m.status === "Done" ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden />
                            ) : overdue ? (
                              <AlertCircle className="h-5 w-5 text-red-400" aria-hidden />
                            ) : (
                              <Circle className="h-5 w-5" aria-hidden />
                            )}
                          </button>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${m.status === "Done" ? "text-slate-500 line-through" : "text-white"}`}>
                              {m.title}
                            </p>
                            <p className={`mt-0.5 text-xs ${overdue ? "text-red-400" : "text-slate-500"}`}>
                              Due {fmtDate(m.dueDate)}
                              {overdue && " · Overdue"}
                            </p>
                          </div>
                        </div>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => void removeMilestone(m.id)}
                            className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-red-500/15 hover:text-red-300"
                            aria-label="Remove milestone"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </section>

      </div>
    </div>

    {importTarget && (
      <SpreadsheetImporter
        projectSlug={slug}
        target={importTarget}
        userList={userList}
        onComplete={() => {
          fetch(`/api/projects/${slug}`, { credentials: "same-origin" })
            .then((r) => r.json())
            .then((d) => { if (d.project) setProject(d.project as Project); })
            .catch(() => undefined);
        }}
        onClose={() => setImportTarget(null)}
      />
    )}
    </>
  );
}
