import { redirect } from "next/navigation";

export default function CrewLoginRedirect() {
  redirect("/login?next=/shifts");
}
