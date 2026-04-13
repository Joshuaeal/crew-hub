import { headers } from "next/headers";
import { TranscribeApp } from "@/components/TranscribeApp";
import {
  getMatrixClientBaseUrlFromRequest,
  matrixUsesHubProxy,
} from "@/lib/service-urls";

export default function TranscribePage() {
  const h = headers();
  const defaultHomeserver = getMatrixClientBaseUrlFromRequest(
    h.get("x-forwarded-host") ?? h.get("host"),
    h.get("x-forwarded-proto"),
  );
  const matrixDomain =
    process.env.CREW_SYNAPSE_SERVER_NAME ??
    process.env.SYNAPSE_SERVER_NAME ??
    "localhost";

  return (
    <TranscribeApp
      defaultHomeserver={defaultHomeserver}
      matrixDomain={matrixDomain}
      matrixUsesHubProxy={matrixUsesHubProxy()}
    />
  );
}
