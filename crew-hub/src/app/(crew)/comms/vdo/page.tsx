import Link from "next/link";
import { VdoNinjaHub } from "@/components/VdoNinjaHub";
import { getVdoNinjaBasesFromEnv, getVdoRoomPasswordFromEnv } from "@/lib/vdo-ninja-urls";
import { readInstanceSettings } from "@/lib/instance-settings-store";

export default async function VdoNinjaPage() {
  const inst = await readInstanceSettings();
  const bases = inst.vdoNinjaUrls && inst.vdoNinjaUrls.length ? inst.vdoNinjaUrls : getVdoNinjaBasesFromEnv();
  const roomPassword = inst.vdoRoomPassword?.trim() || getVdoRoomPasswordFromEnv();
  const roomPrefix = inst.vdoRoomPrefix?.trim() || undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/10 bg-black/30 px-4 py-2">
        <Link href="/comms" className="text-xs text-brand/90 hover:text-brand/80">
          ← Matrix channels
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <VdoNinjaHub initialBases={bases} roomPassword={roomPassword} roomPrefix={roomPrefix} />
      </div>
    </div>
  );
}
