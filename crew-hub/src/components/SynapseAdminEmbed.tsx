import { headers } from "next/headers";
import { EmbeddedApp } from "@/components/EmbeddedApp";
import { getSynapseAdminUrlFromRequest } from "@/lib/service-urls";
import { readInstanceSettings } from "@/lib/instance-settings-store";

export async function SynapseAdminEmbed() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    (h.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() || "http";
  const hubOrigin = host ? `${proto}://${host}` : "";
  const inst = await readInstanceSettings().catch(() => null);
  const src = inst?.synapseAdminUrl?.trim() || getSynapseAdminUrlFromRequest(host, proto);

  return (
    <EmbeddedApp
      title="Synapse Admin"
      description={
        hubOrigin
          ? `synapse-admin (users, rooms, server checks). On the login form, set Homeserver to ${hubOrigin} so requests use this hub's /_matrix and /_synapse proxies — or use your direct Synapse URL (e.g. http://127.0.0.1:8008) if the browser can reach it. Sign in with a Matrix account that has Synapse server-admin.`
          : `synapse-admin (users, rooms, server checks). On the login form, set Homeserver to this site's URL (same as the address bar) so /_synapse is proxied through Crew Hub, or point at Synapse directly. Sign in with a server-admin Matrix account.`
      }
      src={src}
      envVarName={inst?.synapseAdminUrl?.trim() ? undefined : "NEXT_PUBLIC_SERVICE_SYNAPSE_URL"}
      onboardHref="/onboard/matrix-crew"
    />
  );
}
