import { redirect } from "next/navigation";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function SubcontractorLoginRedirect({ searchParams }: Props) {
  const err = searchParams.error;
  const q = new URLSearchParams();
  q.set("next", "/subcontractor/invoices");
  if (err === "config") q.set("error", "config");
  redirect(`/login?${q.toString()}`);
}
