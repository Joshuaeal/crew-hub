type Props = {
  /** Full subscribe URL including secret token; only pass from trusted server context. */
  feedUrl: string | null;
};

export function IcalFeedCard({ feedUrl }: Props) {
  if (!feedUrl) {
    return (
      <section className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-4 text-sm text-amber-100/90">
        <h2 className="font-semibold text-amber-50">Google Calendar / iCal feed</h2>
        <p className="mt-2 text-amber-100/80">
          Set <code className="rounded bg-black/30 px-1">CREW_ICAL_TOKEN</code> on the server (e.g.{" "}
          <code className="rounded bg-black/30 px-1">openssl rand -hex 32</code>), restart the app,
          then reload this page for a private <code className="rounded bg-black/30 px-1">.ics</code> URL
          for Google Calendar → Add calendar → From URL (or any iCal client).
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 p-4 text-sm text-slate-300">
      <h2 className="font-semibold text-white">Google Calendar / iCal feed</h2>
      <p className="mt-2 text-slate-400">
        Subscribe with this secret URL (treat it like a password—anyone with the link sees all shifts
        in the feed). Google refreshes periodically; you can also re-add the URL after changes.
      </p>
      <p className="mt-3 break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-emerald-100/95 sm:text-xs">
        {feedUrl}
      </p>
    </section>
  );
}
