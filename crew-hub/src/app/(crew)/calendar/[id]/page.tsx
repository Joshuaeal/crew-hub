import { notFound } from "next/navigation";
import { CalendarEventForm } from "@/components/CalendarEventForm";
import { getCalendarEvent } from "@/lib/calendar-events-store";

type PageProps = { params: { id: string } };

export default async function CalendarEventDetailPage({ params }: PageProps) {
  const ev = await getCalendarEvent(params.id);
  if (!ev) notFound();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-lg space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Edit event</h1>
          <p className="mt-1 text-sm text-slate-500">Last updated {new Date(ev.updatedAt).toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <CalendarEventForm mode="edit" initial={ev} />
        </div>
      </div>
    </div>
  );
}
