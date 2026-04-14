import { readInstanceSettings } from "@/lib/instance-settings-store";
import { getSession } from "@/lib/session";
import { RadioApp } from "@/components/RadioApp";

export const dynamic = "force-dynamic";

export default async function RadioPage() {
  const [settings, session] = await Promise.all([
    readInstanceSettings().catch(() => null),
    getSession(),
  ]);

  return (
    <RadioApp
      livekitUrl={settings?.livekitUrl ?? null}
      radioChannels={settings?.radioChannels ?? null}
      username={session?.username ?? session?.email ?? null}
    />
  );
}
