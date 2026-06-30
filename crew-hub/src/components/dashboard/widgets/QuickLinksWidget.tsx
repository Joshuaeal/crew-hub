"use client";

import Link from "next/link";
import {
  Calendar,
  Briefcase,
  Users,
  FileText,
  Radio,
  BarChart2,
  Package,
  MessageSquare,
  LayoutGrid,
} from "lucide-react";

const LINKS = [
  { label: "Radio", desc: "Multi-channel PTT comms.", href: "/comms/radio", icon: Radio },
  { label: "Schedule", desc: "Upcoming events and calendar.", href: "/calendar", icon: Calendar },
  { label: "Shifts", desc: "Your shifts and availability.", href: "/shifts", icon: Briefcase },
  { label: "Team", desc: "HR profiles and leave.", href: "/hr", icon: Users },
  { label: "Projects", desc: "Active jobs and timelines.", href: "/projects", icon: BarChart2 },
  { label: "Inventory", desc: "Gear, requests and jobs.", href: "/inventory", icon: Package },
  { label: "Channels", desc: "Matrix messaging.", href: "/comms", icon: MessageSquare },
  { label: "Billing", desc: "Invoices and payables.", href: "/billing", icon: FileText },
  { label: "Boards", desc: "AFFiNE collaborative workspace.", href: "/boards", icon: LayoutGrid },
];

export function QuickLinksWidget() {
  return (
    <ul className="grid grid-cols-2 gap-px p-4 h-full content-start">
      {LINKS.map(({ label, desc, href, icon: Icon }) => (
        <li key={href}>
          <Link
            href={href}
            className="flex flex-col items-center justify-center gap-2 rounded-xl p-4 text-center transition hover:bg-gray-50 active:scale-95"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
              <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </span>
            <span className="text-xs font-semibold text-gray-700">{label}</span>
            <span className="text-[11px] leading-snug text-gray-400">{desc}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
