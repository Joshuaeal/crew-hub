import { headers } from "next/headers";
import { EmbeddedApp } from "@/components/EmbeddedApp";
import { serviceUrls } from "@/lib/service-urls";
import { readInstanceSettings } from "@/lib/instance-settings-store";
import { matrixProvisioningEnabled } from "@/lib/matrix-provision";

export async function MatrixClientEmbed() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() || "http";
  const hubOrigin = host ? `${proto}://${host}` : "";
  const inst = await readInstanceSettings();

  const explicitClientUrl = inst.matrixClientUrl?.trim();
  const elementProxied = Boolean(process.env.ELEMENT_UPSTREAM_URL?.trim());
  const autoLogin = elementProxied && matrixProvisioningEnabled();

  // If Element is proxied same-origin and admin token is set, use the auto-login relay page.
  // Otherwise fall back to the configured/default Element URL.
  const src = autoLogin
    ? "/element-init"
    : explicitClientUrl || serviceUrls.matrixClient;

  const description = hubOrigin
    ? `Element Web (Matrix client). In the login screen, set Homeserver to ${hubOrigin} so requests use Crew Hub's /_matrix proxy (avoids CORS).`
    : "Element Web (Matrix client). In the login screen, set Homeserver to this site's URL so requests use Crew Hub's /_matrix proxy (avoids CORS).";

  return (
    <EmbeddedApp
      title="Channels (Element)"
      description={autoLogin ? undefined : description}
      src={src}
      envVarName={explicitClientUrl ? undefined : "NEXT_PUBLIC_SERVICE_MATRIX_CLIENT_URL"}
      onboardHref="/onboard/matrix-crew"
    />
  );
}
