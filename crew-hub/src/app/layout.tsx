import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { readInstanceSettings } from "@/lib/instance-settings-store";

export const dynamic = "force-dynamic";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

/** Favicons: `src/app/icon.png` and `src/app/apple-icon.png` (Raconteur logo, alpha preserved). */
export const metadata: Metadata = {
  title: "Crew Hub — Billing, Matrix, HR, Shifts",
  description:
    "Unified workspace: billing (AUD/GST), Matrix channels, shifts and schedule, HR directory & leave, inventory, subcontractor tools.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    if ([r, g, b].some((x) => Number.isNaN(x))) return null;
    return { r, g, b };
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some((x) => Number.isNaN(x))) return null;
    return { r, g, b };
  }
  return null;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const inst = await readInstanceSettings().catch(() => null);
  const brand = inst?.palette?.brand?.trim() || "#5b8cff";
  const accent = inst?.palette?.accent?.trim() || "#22c55e";
  const uiCss = inst?.uiCss?.trim() || "";
  const rgb = hexToRgb(brand);
  const rgb2 = hexToRgb(accent);
  const highlightBg = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)` : "rgba(91, 140, 255, 0.22)";
  const highlightRing = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)` : "rgba(91, 140, 255, 0.55)";
  const selectionBg = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)` : "rgba(91, 140, 255, 0.35)";

  return (
    <html
      lang="en"
      style={
        {
          ["--brand" as string]: brand,
          ["--instance-accent" as string]: accent,
          ["--accent" as string]: brand,
          ["--secondary" as string]: accent,
          ["--accent-rgb" as string]: rgb ? `${rgb.r} ${rgb.g} ${rgb.b}` : "91 140 255",
          ["--secondary-rgb" as string]: rgb2 ? `${rgb2.r} ${rgb2.g} ${rgb2.b}` : "34 197 94",
          ["--highlight-bg" as string]: highlightBg,
          ["--highlight-ring" as string]: highlightRing,
          ["--selection-bg" as string]: selectionBg,
        } as React.CSSProperties
      }
    >
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
        {uiCss ? <style id="instance-ui-css">{uiCss}</style> : null}
        {children}
      </body>
    </html>
  );
}
