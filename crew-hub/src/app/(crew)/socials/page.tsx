import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";
import { readSocialPosts } from "@/lib/socials-store";
import { SocialsClient } from "@/components/SocialsClient";
import { redirect } from "next/navigation";

export default async function SocialsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/socials");

  const perms = session.permissions;
  const canView =
    hasPermission(perms, "socials_view") ||
    hasPermission(perms, "socials_manage") ||
    hasPermission(perms, "*");
  if (!canView) redirect("/");

  const canManage = hasPermission(perms, "socials_manage") || hasPermission(perms, "*");
  const posts = await readSocialPosts();

  return <SocialsClient initialPosts={posts} canManage={canManage} />;
}
