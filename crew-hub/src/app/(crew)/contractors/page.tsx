import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ContractorsDashboardMember } from "@/components/ContractorsDashboardMember";

export default async function ContractorsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/contractors");
  if (session.role !== "member") redirect("/");

  return <ContractorsDashboardMember session={session} />;
}

