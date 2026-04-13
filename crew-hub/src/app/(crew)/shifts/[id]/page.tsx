import Link from "next/link";
import { redirect } from "next/navigation";
import { ShiftDetailClient } from "@/components/ShiftDetailClient";
import { getSession } from "@/lib/session";
import { canAccessShiftsList, hasPermission } from "@/types/permissions";

type Props = { params: Promise<{ id: string }> };

export default async function ShiftDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  const canView = session && canAccessShiftsList(session.permissions);
  if (!session || !canView) {
    redirect(`/login?next=${encodeURIComponent(`/shifts/${id}`)}`);
  }

  const canClaim = hasPermission(session.permissions, "shifts_claim");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href="/shifts" className="text-sm text-brand/90 hover:text-brand/80">
          ← Shifts
        </Link>
        <ShiftDetailClient shiftId={id} email={session.email} canClaim={canClaim} />
      </div>
    </div>
  );
}
