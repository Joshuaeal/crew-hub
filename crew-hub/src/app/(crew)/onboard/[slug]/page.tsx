import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getServiceById } from "@/lib/services";
import { getMatrixHomeserverUrl } from "@/lib/service-urls";
import { readInstanceSettings } from "@/lib/instance-settings-store";

const appHrefByServiceId: Record<string, string> = {
  "matrix-crew": "/comms",
  "crew-hr": "/hr",
};

type PageProps = { params: { slug: string } };

export default async function OnboardPage({ params }: PageProps) {
  const service = getServiceById(params.slug);
  if (!service) notFound();

  const inst = await readInstanceSettings().catch(() => null);
  const openUrl =
    service.id === "matrix-crew"
      ? (inst?.matrixHomeserverUrl?.trim() || getMatrixHomeserverUrl())
      : undefined;
  const inAppHref = appHrefByServiceId[service.id];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <Link
          href="/onboard"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All guides
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-wide text-brand/90">Onboarding</p>
          <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{service.name}</h1>
          <p className="mt-2 max-w-2xl text-slate-400">{service.tagline}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            {inAppHref && (
              <Link
                href={inAppHref}
                className="inline-flex items-center gap-2 rounded-lg bg-brand/25 px-4 py-2.5 text-sm font-medium text-cream ring-1 ring-brand/40 hover:bg-brand/35"
              >
                Open in Crew
              </Link>
            )}
            {openUrl ? (
              <a
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                Open in new tab
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            ) : inAppHref ? (
              <p className="text-sm text-slate-500">No separate service URL — runs inside Crew Hub.</p>
            ) : (
              <p className="text-sm text-amber-200/90">
                Set the matching <code className="rounded bg-white/10 px-1.5 py-0.5">NEXT_PUBLIC_*</code>{" "}
                URL in your environment to enable the embedded view.
              </p>
            )}
            {service.upstreamUrl ? (
              <a
                href={service.upstreamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-slate-300 ring-1 ring-white/10 hover:bg-white/5"
              >
                Upstream repo
              </a>
            ) : null}
          </div>

          <h2 className="mt-10 text-lg font-semibold text-white">Checklist</h2>
          <ol className="mt-4 space-y-4">
            {service.steps.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-4 rounded-xl border border-white/5 bg-black/20 p-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-medium text-slate-100">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          {service.envVars.length > 0 && (
            <>
              <h2 className="mt-10 text-lg font-semibold text-white">Environment hints</h2>
              <ul className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10">
                {service.envVars.map((v) => (
                  <li
                    key={v.name}
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <code className="text-sm text-brand/70">{v.name}</code>
                    <span className="text-sm text-slate-400">{v.description}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
