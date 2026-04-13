import Link from "next/link";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-md p-4 py-8 sm:p-6 sm:py-12">
        <h1 className="text-2xl font-semibold text-white">Choose a new password</h1>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
            <ResetPasswordForm />
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
