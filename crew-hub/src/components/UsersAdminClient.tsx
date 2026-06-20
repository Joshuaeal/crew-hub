"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GRANULAR_PERMISSIONS,
  PERMISSION_LABELS,
  defaultPermissionsForRole,
} from "@/types/permissions";
import type { CrewRole } from "@/types/crew-role";
import { Loader2, Trash2 } from "lucide-react";

type UserRow = {
  id: string;
  username: string;
  email: string;
  role: CrewRole;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  displayName: string;
  crewHandsRateAudExGst: number | null;
  crewHandsDailyRateAudExGst: number | null;
};

const ROLES: CrewRole[] = ["admin", "member", "subcontractor"];

export function UsersAdminClient() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [matrixEnabled, setMatrixEnabled] = useState<boolean | null>(null);
  const [matrixDiag, setMatrixDiag] = useState<{
    upstreamConfigured: boolean;
    serverNameConfigured: boolean;
    tokenConfigured: boolean;
    tokenPrefix: string;
    tokenLength: number;
  } | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CrewRole>("member");
  const [fullAccess, setFullAccess] = useState(false);
  const [permSet, setPermSet] = useState<Set<string>>(() => new Set(defaultPermissionsForRole("member")));
  const [displayName, setDisplayName] = useState("");
  const [crewHandsRate, setCrewHandsRate] = useState("");
  const [crewHandsDailyRate, setCrewHandsDailyRate] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load users");
        return;
      }
      setUsers(Array.isArray(data.users) ? data.users : []);
      setMatrixEnabled(typeof data.matrixProvisioningEnabled === "boolean" ? data.matrixProvisioningEnabled : null);
      if (data.matrixProvisioning && typeof data.matrixProvisioning === "object") {
        const mp = data.matrixProvisioning as Partial<{
          upstreamConfigured: unknown;
          serverNameConfigured: unknown;
          tokenConfigured: unknown;
          tokenPrefix: unknown;
          tokenLength: unknown;
        }>;
        setMatrixDiag({
          upstreamConfigured: Boolean(mp.upstreamConfigured),
          serverNameConfigured: Boolean(mp.serverNameConfigured),
          tokenConfigured: Boolean(mp.tokenConfigured),
          tokenPrefix: typeof mp.tokenPrefix === "string" ? mp.tokenPrefix : "",
          tokenLength: typeof mp.tokenLength === "number" ? mp.tokenLength : 0,
        });
      } else {
        setMatrixDiag(null);
      }
    } catch {
      setError("Failed to load users");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!fullAccess) {
      setPermSet(new Set(defaultPermissionsForRole(role)));
    }
  }, [role, fullAccess]);

  function togglePerm(key: string) {
    setPermSet((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  function permissionsPayload(): string[] {
    if (fullAccess) return ["*"];
    return Array.from(permSet);
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          role,
          permissions: permissionsPayload(),
          displayName: displayName.trim() || undefined,
          crewHandsRateAudExGst:
            crewHandsRate.trim() === ""
              ? undefined
              : (() => {
                  const n = parseFloat(crewHandsRate);
                  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
                })(),
          crewHandsDailyRateAudExGst:
            crewHandsDailyRate.trim() === ""
              ? undefined
              : (() => {
                  const n = parseFloat(crewHandsDailyRate);
                  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
                })(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Create failed");
        return;
      }
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("member");
      setFullAccess(false);
      setDisplayName("");
      setCrewHandsRate("");
      setCrewHandsDailyRate("");
      await load();
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(u: UserRow, newPassword?: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: u.username,
          email: u.email,
          role: u.role,
          permissions: u.permissions,
          displayName: u.displayName.trim() ? u.displayName.trim() : null,
          crewHandsRateAudExGst: u.crewHandsRateAudExGst,
          crewHandsDailyRateAudExGst: u.crewHandsDailyRateAudExGst,
          ...(newPassword?.trim() ? { password: newPassword.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Update failed");
        return;
      }
      if (data.matrixSyncFailed === true) {
        setError(
          `Saved in Crew Hub, but Element/Matrix password sync failed: ${typeof data.matrixSyncError === "string" ? data.matrixSyncError : "unknown error"}`
        );
      }
      setEditingId(null);
      await load();
    } finally {
      setPending(false);
    }
  }

  async function removeUser(id: string) {
    if (!confirm("Delete this user?")) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Delete failed");
        return;
      }
      await load();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-10">
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Create user</h2>
        <p className="mt-1 text-sm text-slate-500">
          New users sign in at <code className="rounded bg-white/10 px-1">/login</code> with username or
          email. Set role and permissions below. When the server has{" "}
          <code className="rounded bg-white/10 px-1">CREW_SYNAPSE_ADMIN_ACCESS_TOKEN</code> set, each new account
          is also created on Synapse with the same username and password (Element can log in while registration is
          off).
        </p>
        {matrixEnabled === false && (
          <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Matrix user creation is currently <strong>disabled</strong>. Set{" "}
            <code className="rounded bg-black/30 px-1">CREW_SYNAPSE_ADMIN_ACCESS_TOKEN</code> (and ensure{" "}
            <code className="rounded bg-black/30 px-1">MATRIX_UPSTREAM_URL</code> is reachable from the hub container),
            then rebuild/restart.
            {matrixDiag && (
              <>
                {" "}
                <span className="text-amber-200/90">
                  (diagnostics: upstream={String(matrixDiag.upstreamConfigured)}, serverName=
                  {String(matrixDiag.serverNameConfigured)}, token={String(matrixDiag.tokenConfigured)}{" "}
                  {matrixDiag.tokenPrefix ? `${matrixDiag.tokenPrefix}…` : ""} len={matrixDiag.tokenLength})
                </span>
              </>
            )}
          </p>
        )}
        <form onSubmit={createUser} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-slate-400">Username</label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400">Display name (optional, HR / invoices)</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400">Crew hourly rate (AUD/h ex GST, optional)</label>
            <input
              value={crewHandsRate}
              onChange={(e) => setCrewHandsRate(e.target.value)}
              placeholder="e.g. 85"
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400">Crew daily rate (AUD/day ex GST, optional)</label>
            <input
              value={crewHandsDailyRate}
              onChange={(e) => setCrewHandsDailyRate(e.target.value)}
              placeholder="e.g. 600"
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-slate-400">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as CrewRole)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={fullAccess}
                onChange={(e) => setFullAccess(e.target.checked)}
                className="rounded border-white/20"
              />
              Full access (superuser)
            </label>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-slate-500">Permissions</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {GRANULAR_PERMISSIONS.map((key) => (
                <label
                  key={key}
                  className={`flex items-center gap-2 text-sm ${fullAccess ? "opacity-40" : ""}`}
                >
                  <input
                    type="checkbox"
                    disabled={fullAccess}
                    checked={permSet.has(key)}
                    onChange={() => togglePerm(key)}
                    className="rounded border-white/20"
                  />
                  <span className="text-slate-300">{PERMISSION_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-brand/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Create user"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">All users</h2>
        {users === null ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : users.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No users.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {users.map((u) => (
              <li
                key={u.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300"
              >
                {editingId === u.id ? (
                  <UserEditRow
                    user={u}
                    onCancel={() => setEditingId(null)}
                    onSave={(row, pwd) => void saveEdit(row, pwd)}
                    pending={pending}
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="font-medium text-white">{u.username}</span>
                        {u.displayName ? (
                          <span className="text-slate-400"> · {u.displayName}</span>
                        ) : null}
                        <span className="text-slate-500"> · {u.email}</span>
                        {u.crewHandsRateAudExGst != null ? (
                          <span className="text-slate-500"> · {u.crewHandsRateAudExGst.toFixed(2)} AUD/h</span>
                        ) : null}
                        {u.crewHandsDailyRateAudExGst != null ? (
                          <span className="text-slate-500"> · {u.crewHandsDailyRateAudExGst.toFixed(2)} AUD/day</span>
                        ) : null}
                        <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-xs text-slate-400">
                          {u.role}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(u.id)}
                          className="rounded-lg bg-white/10 px-2 py-1 text-xs text-white ring-1 ring-white/15 hover:bg-white/15"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeUser(u.id)}
                          className="rounded-lg bg-red-500/20 p-1.5 text-red-200 ring-1 ring-red-500/30 hover:bg-red-500/30"
                          aria-label="Delete user"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 break-all text-xs text-slate-500">
                      {u.permissions.includes("*") ? "*" : u.permissions.join(", ")}
                    </p>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function UserEditRow({
  user,
  onCancel,
  onSave,
  pending,
}: {
  user: UserRow;
  onCancel: () => void;
  onSave: (u: UserRow, newPassword?: string) => void;
  pending: boolean;
}) {
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [crewHandsRate, setCrewHandsRate] = useState(
    user.crewHandsRateAudExGst != null ? String(user.crewHandsRateAudExGst) : ""
  );
  const [crewHandsDailyRate, setCrewHandsDailyRate] = useState(
    user.crewHandsDailyRateAudExGst != null ? String(user.crewHandsDailyRateAudExGst) : ""
  );
  const [newPassword, setNewPassword] = useState("");
  const [role, setRole] = useState<CrewRole>(user.role);
  const [fullAccess, setFullAccess] = useState(user.permissions.includes("*"));
  const [permSet, setPermSet] = useState<Set<string>>(() => {
    if (user.permissions.includes("*")) return new Set<string>();
    return new Set(user.permissions);
  });

  function togglePerm(key: string) {
    setPermSet((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-white"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-white"
        />
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name (HR / invoices)"
          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-white"
        />
        <input
          value={crewHandsRate}
          onChange={(e) => setCrewHandsRate(e.target.value)}
          placeholder="Hourly AUD/h ex GST"
          inputMode="decimal"
          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-white"
        />
        <input
          value={crewHandsDailyRate}
          onChange={(e) => setCrewHandsDailyRate(e.target.value)}
          placeholder="Daily AUD/day ex GST"
          inputMode="decimal"
          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-white"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500">New password (optional)</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Leave blank to keep current — also syncs to Element/Matrix when set"
          autoComplete="new-password"
          className="mt-1 w-full max-w-lg rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-white"
        />
      </div>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as CrewRole)}
        className="w-full max-w-xs rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-white"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={fullAccess}
          onChange={(e) => setFullAccess(e.target.checked)}
          className="rounded border-white/20"
        />
        Full access (*)
      </label>
      <div className="grid gap-1 sm:grid-cols-2">
        {GRANULAR_PERMISSIONS.map((key) => (
          <label key={key} className={`flex items-center gap-2 text-xs ${fullAccess ? "opacity-40" : ""}`}>
            <input
              type="checkbox"
              disabled={fullAccess}
              checked={permSet.has(key)}
              onChange={() => togglePerm(key)}
              className="rounded border-white/20"
            />
            {PERMISSION_LABELS[key]}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            let crewHandsRateAudExGst: number | null = null;
            const r = crewHandsRate.trim();
            if (r !== "") {
              const n = parseFloat(r);
              if (!Number.isFinite(n) || n < 0) {
                window.alert("Hourly rate must be a non-negative number, or leave blank to clear.");
                return;
              }
              crewHandsRateAudExGst = Math.round(n * 100) / 100;
            }
            let crewHandsDailyRateAudExGst: number | null = null;
            const dr = crewHandsDailyRate.trim();
            if (dr !== "") {
              const n = parseFloat(dr);
              if (!Number.isFinite(n) || n < 0) {
                window.alert("Daily rate must be a non-negative number, or leave blank to clear.");
                return;
              }
              crewHandsDailyRateAudExGst = Math.round(n * 100) / 100;
            }
            onSave(
              {
                ...user,
                username,
                email,
                displayName: displayName.trim(),
                crewHandsRateAudExGst,
                crewHandsDailyRateAudExGst,
                role,
                permissions: fullAccess ? ["*"] : Array.from(permSet),
              },
              newPassword.trim() || undefined
            );
          }}
          className="rounded-lg bg-brand/80 px-3 py-1.5 text-sm text-slate-950"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
