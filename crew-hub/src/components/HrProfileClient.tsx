"use client";

import { useCallback, useEffect, useState } from "react";
import type { EmergencyContact, HrEmployeeProfile } from "@/types/hr-profile";
import { emptyHrProfile } from "@/types/hr-profile";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function HrProfileClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<HrEmployeeProfile>(() => emptyHrProfile());
  const [qualLabel, setQualLabel] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/hr/profile", { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not load profile");
        return;
      }
      if (data.profile) setProfile(data.profile as HrEmployeeProfile);
    } catch {
      setError("Could not load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hr/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          legalName: profile.legalName,
          dateOfBirth: profile.dateOfBirth,
          abn: profile.abn,
          phone: profile.phone,
          addressLine1: profile.addressLine1,
          addressSuburb: profile.addressSuburb,
          addressState: profile.addressState,
          addressPostcode: profile.addressPostcode,
          emergencyContacts: profile.emergencyContacts,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      if (data.profile) setProfile(data.profile as HrEmployeeProfile);
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }

  function setContact(i: number, patch: Partial<EmergencyContact>) {
    setProfile((p) => {
      const next = [...p.emergencyContacts];
      next[i] = { ...next[i], ...patch };
      return { ...p, emergencyContacts: next };
    });
  }

  function addContact() {
    setProfile((p) => ({
      ...p,
      emergencyContacts: [...p.emergencyContacts, { name: "", relationship: "", phone: "" }].slice(0, 6),
    }));
  }

  function removeContact(i: number) {
    setProfile((p) => ({
      ...p,
      emergencyContacts: p.emergencyContacts.filter((_, j) => j !== i),
    }));
  }

  async function uploadDoc(category: "wwcc" | "police_check" | "qualification") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,application/pdf/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(category);
      setError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("category", category);
        if (category === "qualification") {
          fd.append("label", qualLabel.trim() || "Qualification");
        }
        const res = await fetch("/api/hr/profile/documents", {
          method: "POST",
          body: fd,
          credentials: "same-origin",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Upload failed");
          return;
        }
        if (data.profile) setProfile(data.profile as HrEmployeeProfile);
        if (category === "qualification") setQualLabel("");
      } catch {
        setError("Upload failed");
      } finally {
        setUploading(null);
      }
    };
    input.click();
  }

  async function removeDoc(docId: string) {
    if (!confirm("Remove this file from your profile?")) return;
    setError(null);
    try {
      const res = await fetch("/api/hr/profile/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ docId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Remove failed");
        return;
      }
      if (data.profile) setProfile(data.profile as HrEmployeeProfile);
    } catch {
      setError("Remove failed");
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading profile…
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Personal details</h2>
        <p className="mt-1 text-sm text-slate-500">
          This information is stored in your organisation&apos;s Crew Hub data directory (on the server), not in a
          public cloud.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-400">Legal name</span>
            <input
              value={profile.legalName}
              onChange={(e) => setProfile((p) => ({ ...p, legalName: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Date of birth</span>
            <input
              type="date"
              value={profile.dateOfBirth}
              onChange={(e) => setProfile((p) => ({ ...p, dateOfBirth: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">ABN (if applicable)</span>
            <input
              value={profile.abn}
              onChange={(e) => setProfile((p) => ({ ...p, abn: e.target.value }))}
              placeholder="11 digits"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Phone</span>
            <input
              value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-400">Address line 1</span>
            <input
              value={profile.addressLine1}
              onChange={(e) => setProfile((p) => ({ ...p, addressLine1: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Suburb</span>
            <input
              value={profile.addressSuburb}
              onChange={(e) => setProfile((p) => ({ ...p, addressSuburb: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">State</span>
            <input
              value={profile.addressState}
              onChange={(e) => setProfile((p) => ({ ...p, addressState: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Postcode</span>
            <input
              value={profile.addressPostcode}
              onChange={(e) => setProfile((p) => ({ ...p, addressPostcode: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Emergency contacts</h2>
        <p className="mt-1 text-sm text-slate-500">Up to six contacts.</p>
        <div className="mt-4 space-y-4">
          {profile.emergencyContacts.map((c, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-lg border border-white/5 bg-black/20 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <input
                placeholder="Name"
                value={c.name}
                onChange={(e) => setContact(i, { name: e.target.value })}
                className="rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
              />
              <input
                placeholder="Relationship"
                value={c.relationship}
                onChange={(e) => setContact(i, { relationship: e.target.value })}
                className="rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
              />
              <input
                placeholder="Phone"
                value={c.phone}
                onChange={(e) => setContact(i, { phone: e.target.value })}
                className="rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
              />
              <button
                type="button"
                onClick={() => removeContact(i)}
                className="flex items-center justify-center rounded p-2 text-slate-500 hover:bg-white/10 hover:text-red-300"
                aria-label="Remove contact"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        {profile.emergencyContacts.length < 6 && (
          <button
            type="button"
            onClick={addContact}
            className="mt-3 inline-flex items-center gap-1 text-sm text-brand/90 hover:text-brand/80"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add contact
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Compliance documents</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload PDF or images (max 15 MB each). Files are stored only on this server&apos;s disk under the
          organisation&apos;s data folder — not in third-party cloud storage.
        </p>

        <div className="mt-6 space-y-6">
          <DocSlot
            title="Working With Children Check (WWCC)"
            meta={profile.wwcc}
            uploading={uploading === "wwcc"}
            onUpload={() => void uploadDoc("wwcc")}
            onRemove={profile.wwcc ? () => void removeDoc(profile.wwcc!.id) : undefined}
          />
          <DocSlot
            title="Police check"
            meta={profile.policeCheck}
            uploading={uploading === "police_check"}
            onUpload={() => void uploadDoc("police_check")}
            onRemove={profile.policeCheck ? () => void removeDoc(profile.policeCheck!.id) : undefined}
          />

          <div>
            <h3 className="text-sm font-medium text-slate-300">Other qualifications</h3>
            <p className="mt-1 text-xs text-slate-500">
              Add a label (e.g. &quot;First aid&quot;) then upload the certificate.
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-sm">
                <span className="text-slate-500">Label</span>
                <input
                  value={qualLabel}
                  onChange={(e) => setQualLabel(e.target.value)}
                  placeholder="e.g. Working at heights"
                  className="mt-1 w-full min-w-[200px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                />
              </label>
              <button
                type="button"
                disabled={uploading === "qualification"}
                onClick={() => void uploadDoc("qualification")}
                className="inline-flex items-center gap-2 rounded-lg bg-brand/25 px-4 py-2 text-sm font-medium text-cream ring-1 ring-brand/40 hover:bg-brand/35 disabled:opacity-50"
              >
                {uploading === "qualification" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden />
                )}
                Upload qualification
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {profile.qualifications.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium text-slate-200">{q.label}</span>
                    <span className="text-slate-500"> · {q.originalName}</span>
                    <span className="text-slate-600"> · {fmtBytes(q.sizeBytes)}</span>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/api/hr/documents/${q.id}`}
                      className="text-xs text-brand/90 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => void removeDoc(q.id)}
                      className="text-xs text-red-300 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-brand/90 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-brand/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
        <p className="text-xs text-slate-600">Last updated: {new Date(profile.updatedAt).toLocaleString()}</p>
      </div>
    </div>
  );
}

function DocSlot({
  title,
  meta,
  uploading,
  onUpload,
  onRemove,
}: {
  title: string;
  meta: { id: string; originalName: string; sizeBytes: number } | null;
  uploading: boolean;
  onUpload: () => void;
  onRemove?: () => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-300">{title}</h3>
      {meta ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm">
          <span className="text-slate-300">
            {meta.originalName} <span className="text-slate-600">· {fmtBytes(meta.sizeBytes)}</span>
          </span>
          <div className="flex gap-2">
            <a
              href={`/api/hr/documents/${meta.id}`}
              className="text-xs text-brand/90 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Download
            </a>
            <button type="button" onClick={onRemove} className="text-xs text-red-300 hover:underline">
              Remove
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={onUpload}
              className="text-xs text-slate-400 hover:text-white"
            >
              Replace
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={onUpload}
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
          Upload
        </button>
      )}
    </div>
  );
}
