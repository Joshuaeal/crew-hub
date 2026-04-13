"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function UnifiedLoginForm() {
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next");
  const next =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";
  const configError = searchParams.get("error") === "config";

  const [setupLoading, setSetupLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password2, setPassword2] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [setupContinue, setSetupContinue] = useState<{ dest: string; matrixWarning?: string } | null>(
    null
  );

  useEffect(() => {
    fetch("/api/auth/setup-status")
      .then((r) => r.json())
      .then((d) => setNeedsSetup(Boolean(d.needsSetup)))
      .catch(() => setNeedsSetup(false))
      .finally(() => setSetupLoading(false));
  }, []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Sign-in failed");
        return;
      }
      let dest = next;
      if (next === "/") {
        // Default dashboard for all roles; `/subcontractor` is no longer a separate landing.
        // Avoid permission-based redirects (admins often have "*" which includes invoices_subcontractor).
        dest = "/";
      }
      setTimeout(() => {
        window.location.assign(dest);
      }, 0);
    } finally {
      setPending(false);
    }
  }

  async function onCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          username,
          email,
          password: password2,
          passwordConfirm,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create account");
        return;
      }
      let dest = next;
      if (next === "/") {
        dest = "/";
      }
      if (data.matrixSyncFailed === true) {
        const w =
          typeof data.matrixSyncError === "string"
            ? data.matrixSyncError
            : "Element/Matrix sync failed";
        setSetupContinue({ dest, matrixWarning: w });
        return;
      }
      setTimeout(() => {
        window.location.assign(dest);
      }, 0);
    } finally {
      setPending(false);
    }
  }

  if (setupLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (needsSetup) {
    if (setupContinue) {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Account ready</h2>
            <p className="mt-1 text-sm text-slate-400">You are signed in to Crew Hub.</p>
          </div>
          {setupContinue.matrixWarning && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {setupContinue.matrixWarning}
            </p>
          )}
          <button
            type="button"
            className="w-full rounded-lg bg-brand/90 py-2.5 text-sm font-semibold text-slate-950 hover:bg-brand/90"
            onClick={() => {
              window.location.assign(setupContinue.dest);
            }}
          >
            Continue to dashboard
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Create administrator account</h2>
          <p className="mt-1 text-sm text-slate-400">
            No users exist yet. Create the first account—you will have full access to Crew Hub.
          </p>
        </div>
        <form onSubmit={(e) => void onCreateAccount(e)} className="space-y-4">
          {configError && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Set <code className="rounded bg-black/30 px-1">CREW_SESSION_SECRET</code> (16+ chars) in{" "}
              <code className="rounded bg-black/30 px-1">.env</code>, then restart.
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="setup-username" className="block text-sm font-medium text-slate-300">
              Username
            </label>
            <input
              id="setup-username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
            <p className="mt-1 text-xs text-slate-600">Lowercase letters, digits, underscore (2–64 chars).</p>
          </div>
          <div>
            <label htmlFor="setup-email" className="block text-sm font-medium text-slate-300">
              Email
            </label>
            <input
              id="setup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div>
            <label htmlFor="setup-password" className="block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              id="setup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
            <p className="mt-1 text-xs text-slate-600">At least 10 characters.</p>
          </div>
          <div>
            <label htmlFor="setup-password2" className="block text-sm font-medium text-slate-300">
              Confirm password
            </label>
            <input
              id="setup-password2"
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand/90 py-2.5 text-sm font-semibold text-slate-950 hover:bg-brand/90 disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create account & sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onLogin(e)} className="space-y-4">
      {configError && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Set <code className="rounded bg-black/30 px-1">CREW_SESSION_SECRET</code> (16+ chars) in{" "}
          <code className="rounded bg-black/30 px-1">.env</code>, then restart.
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="identifier" className="block text-sm font-medium text-slate-300">
          Username or email
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand/90 py-2.5 text-sm font-semibold text-slate-950 hover:bg-brand/90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-slate-500">
        <Link href="/forgot-password" className="text-brand/90 hover:text-brand/80">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
