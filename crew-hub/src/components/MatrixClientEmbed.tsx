import { headers } from "next/headers";
import { EmbeddedApp } from "@/components/EmbeddedApp";
import { serviceUrls } from "@/lib/service-urls";
import { readInstanceSettings } from "@/lib/instance-settings-store";

export async function MatrixClientEmbed() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() || "http";
  const hubOrigin = host ? `${proto}://${host}` : "";
  const inst = await readInstanceSettings();
  const src = inst.matrixClientUrl?.trim() || serviceUrls.matrixClient;

  return (
    <EmbeddedApp
      title="Channels (Element)"
      description={
        hubOrigin
          ? `Element Web (Matrix client). In the login screen, set Homeserver to ${hubOrigin} so requests use Crew Hub’s /_matrix proxy (avoids CORS).`
          : "Element Web (Matrix client). In the login screen, set Homeserver to this site’s URL so requests use Crew Hub’s /_matrix proxy (avoids CORS)."
      }
      src={src}
      envVarName={inst.matrixClientUrl?.trim() ? undefined : "NEXT_PUBLIC_SERVICE_MATRIX_CLIENT_URL"}
      onboardHref="/onboard/matrix-crew"
    />
  );
}

