"use client";

import { useEffect, useState } from "react";

export default function ElementInit() {
  const [status, setStatus] = useState("Connecting…");

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/matrix/token");
        if (!res.ok) {
          const { error } = await res.json() as { error?: string };
          setStatus(error ?? "Failed to get Matrix token");
          return;
        }
        const { accessToken, userId, deviceId, homeserverUrl } =
          await res.json() as {
            accessToken: string;
            userId: string;
            deviceId?: string;
            homeserverUrl: string;
          };

        localStorage.setItem("mx_hs_url", homeserverUrl);
        localStorage.setItem("mx_access_token", accessToken);
        localStorage.setItem("mx_user_id", userId);
        localStorage.setItem("mx_is_guest", "false");
        if (deviceId) localStorage.setItem("mx_device_id", deviceId);

        window.location.replace("/element/#/home");
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Unexpected error");
      }
    }
    void init();
  }, []);

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#15191e]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
        <p className="text-sm text-white/50">{status}</p>
      </div>
    </div>
  );
}
