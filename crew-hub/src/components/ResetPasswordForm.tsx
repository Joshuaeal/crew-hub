"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("Missing token. Open the link from your email.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Reset failed");
        return;
      }
      router.push("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-amber-200/90">
        Invalid or missing reset link. Request a new one from{" "}
        <Link href="/forgot-password" className="text-brand/90 underline">
          forgot password
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-slate-300">
          New password (8+ characters)
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
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
        {pending ? "Saving…" : "Set password"}
      </button>
      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="text-brand/90 hover:text-brand/80">
          ← Sign in
        </Link>
      </p>
    </form>
  );
}
