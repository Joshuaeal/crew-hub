import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function SubcontractorHomePage() {
  const session = await getSession();
  if (!session) {
    redirect("/subcontractor/login");
  }
  // Members and subcontractors now share the same landing dashboard at `/`.
  redirect("/");
}
