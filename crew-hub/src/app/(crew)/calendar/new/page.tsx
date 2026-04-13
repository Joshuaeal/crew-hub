import { CalendarEventForm } from "@/components/CalendarEventForm";

export default function NewCalendarEventPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-lg space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">New event</h1>
          <p className="mt-1 text-sm text-slate-400">
            Appears in the combined iCal feed with shifts (same secret URL as Manage shifts).
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <CalendarEventForm mode="create" />
        </div>
      </div>
    </div>
  );
}
