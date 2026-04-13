import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { IcalFeedCard } from "@/components/IcalFeedCard";
import { ShiftManageClient } from "@/components/ShiftManageClient";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";

function buildIcalFeedUrl(): string | null {
  const token = process.env.CREW_ICAL_TOKEN?.trim();
  if (!token) return null;
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base =
    host && host.length > 0
      ? `${proto}://${host}`
      : (process.env.NEXT_PUBLIC_CREW_PUBLIC_URL?.trim() || "http://127.0.0.1:38471");
  return `${base.replace(/\/$/, "")}/api/ical/shifts?token=${encodeURIComponent(token)}`;
}

export default async function ShiftsManagePage() {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "shifts_manage")) {
    redirect("/login?next=/shifts/manage");
  }

  const icalFeedUrl = buildIcalFeedUrl();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <Link
            href="/shifts"
            className="text-sm text-brand/90 hover:text-brand/80"
          >
            ← Shifts
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Manage shifts</h1>
          <p className="mt-1 text-sm text-slate-400">
            Post shifts, approve claims, or assign someone directly.
          </p>
        </div>
        <IcalFeedCard feedUrl={icalFeedUrl} />
        <ShiftManageClient />
      </div>
    </div>
  );
}
