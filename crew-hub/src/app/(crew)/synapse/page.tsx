import { redirect } from "next/navigation";

/** @deprecated Use /admin/synapse */
export default function SynapseRedirectPage() {
  redirect("/admin/synapse");
}
