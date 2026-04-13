import Link from "next/link";
import { Suspense } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { UnifiedLoginForm } from "@/components/UnifiedLoginForm";

export default function LoginPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-md p-4 py-8 sm:p-6 sm:py-12">
        <div className="mb-6 flex justify-center">
          <BrandLogo heightClass="h-11 sm:h-12" priority />
        </div>
        <h1 className="text-2xl font-semibold text-white">Account</h1>
        <p className="mt-2 text-sm text-slate-400">
          Sign in with your username or email, or—on a fresh install—create the first administrator
          below.
        </p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
            <UnifiedLoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="text-brand/90 hover:text-brand/80">
            ← Dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
