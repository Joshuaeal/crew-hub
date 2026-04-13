import { redirect } from "next/navigation";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function AdminLoginRedirect({ searchParams }: Props) {
  const next = typeof searchParams.next === "string" ? searchParams.next : undefined;
  const err = searchParams.error;
  const q = new URLSearchParams();
  if (next) q.set("next", next);
  if (err === "config") q.set("error", "config");
  const s = q.toString();
  redirect(s ? `/login?${s}` : "/login");
}
