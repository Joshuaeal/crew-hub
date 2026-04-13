import { headers } from "next/headers";

export default function ElementWebEmbed() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    (h.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() || "http";
  const hubOrigin = host ? `${proto}://${host}` : "";

  const elementWebUrl = hubOrigin
    ? `${hubOrigin}/_matrix/client/latest/#room/#company-core:${hubOrigin}`
    : "http://localhost:8088/#/room/#company-core:localhost";

  return (
    <div className="min-h-0 flex-1 flex items-center justify-center bg-black/40">
      <iframe
        src={elementWebUrl}
        className="h-full w-full"
        title="Element Web"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        allow="clipboard-read; clipboard-write; fullscreen; microphone; camera"
      />
    </div>
  );
}
