"use client";

import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Request failed");
        return;
      }
      setMessage(
        typeof data.message === "string"
          ? data.message
          : "If an account exists, check your email for a reset link."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      )}
      <p className="text-sm text-slate-400">
        Enter the email on your account. We will send a reset link if SMTP is configured (
        <code className="rounded bg-white/10 px-1">SMTP_HOST</code>, etc.).
      </p>
      <div>
        <label htmlFor="fp-email" className="block text-sm font-medium text-slate-300">
          Email
        </label>
        <input
          id="fp-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand/90 py-2.5 text-sm font-semibold text-slate-950 hover:bg-brand/90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="text-brand/90 hover:text-brand/80">
          ← Back to sign in
        </Link>
      </p>
    </form>
  );
}
