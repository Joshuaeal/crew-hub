"use client";

import { useEffect, useState } from "react";

type Props = {
  /** Tailwind height class; width follows aspect ratio (alpha preserved). */
  className?: string;
  heightClass?: string;
  priority?: boolean;
};

type InstanceSettings = {
  companyName: string;
  invoiceLogoDataUrl?: string;
};

export function BrandLogo({
  className = "",
  heightClass = "h-9",
  priority = false,
}: Props) {
  const [inst, setInst] = useState<InstanceSettings | null>(null);

  useEffect(() => {
    fetch("/api/instance/settings", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const s = data?.settings as InstanceSettings | undefined;
        if (s?.companyName) setInst(s);
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  const logo = inst?.invoiceLogoDataUrl?.trim();
  const name = inst?.companyName?.trim() || "Crew Hub";

  if (!logo) {
    return (
      <span className={`select-none font-semibold tracking-tight text-white ${heightClass} ${className}`}>
        {name}
      </span>
    );
  }

  return (
    // Use a plain <img> so the logo never stretches to layout constraints.
    // (Next/Image can apply sizing styles that look distorted in tight nav containers.)
    <img
      src={logo}
      alt={name}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`block w-auto max-w-[min(100%,14rem)] object-contain ${heightClass} ${className}`}
    />
  );
}
