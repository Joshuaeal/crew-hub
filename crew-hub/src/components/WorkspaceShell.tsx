"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageSquare,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  Shield,
  Calendar,
  ClipboardList,
  Receipt,
  Boxes,
  Building2,
  UserCircle,
  Video,
  Share2,
  PenSquare,
} from "lucide-react";
import {
  canAccessAffine,
  canAccessHr,
  canAccessNotetaker,
  canAccessProjects,
  canAccessSchedule,
  canAccessShiftsList,
  canAccessSocials,
  hasPermission,
} from "@/types/permissions";
import type { CrewSession } from "@/lib/session";
import { BrandLogo } from "@/components/BrandLogo";

type Session = {
  authenticated: boolean;
  role: "admin" | "subcontractor" | "member" | null;
  email: string | null;
  username: string | null;
  permissions: string[];
};

function sessionFromServer(s: CrewSession): Session {
  return {
    authenticated: true,
    role: s.role,
    email: s.email,
    username: s.username,
    permissions: s.permissions,
  };
}

function can(permissions: string[], key: string): boolean {
  return hasPermission(permissions, key);
}

type SectionLink = { href: string; label: string; icon: LucideIcon; active: boolean; visible: boolean };

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "raconteur-nav-active font-medium"
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function modEnabled(mods: string[] | undefined, id: string): boolean {
  if (!mods || mods.length === 0) return true;
  return mods.includes(id);
}

export function WorkspaceShell({
  children,
  initialSession,
  enabledModules,
}: {
  children: React.ReactNode;
  initialSession: CrewSession | null;
  enabledModules?: string[];
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [session, setSession] = useState<Session | null>(() =>
    initialSession ? sessionFromServer(initialSession) : null,
  );

  const refreshSession = useCallback(() => {
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error(`session ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data.authenticated) {
          setSession({
            authenticated: true,
            role: data.role ?? null,
            email: data.email ?? null,
            username: data.username ?? null,
            permissions: Array.isArray(data.permissions) ? data.permissions : [],
          });
        } else {
          // Only clear the session if we don't already have an authenticated one.
          // Route-change refreshes should not log out a currently authenticated user
          // — the server-provided initialSession is authoritative until an explicit
          // logout or a real 401 from a protected API route.
          setSession((prev) => {
            if (prev?.authenticated) return prev;
            return { authenticated: false, role: null, email: null, username: null, permissions: [] };
          });
        }
      })
      .catch(() => {
        /* Keep existing session on transient errors. */
      });
  }, []);

  const skipInitialPathEffect = useRef(true);
  useEffect(() => {
    if (skipInitialPathEffect.current) {
      skipInitialPathEffect.current = false;
      return;
    }
    refreshSession();
  }, [pathname, refreshSession]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const role = session?.role ?? null;
  const perms = session?.permissions ?? [];
  const signedIn = Boolean(session?.authenticated);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Explicitly clear session state; don't rely on the refresh guard.
    setSession({ authenticated: false, role: null, email: null, username: null, permissions: [] });
    setMobileOpen(false);
    window.location.href = "/";
  }

  const showCrewNav =
    signedIn && modEnabled(enabledModules, "shifts") && canAccessShiftsList(perms);
  const showSchedule = signedIn && canAccessSchedule(perms);
  const showComms = signedIn && modEnabled(enabledModules, "comms") && can(perms, "comms");
  const showVdoNinja =
    signedIn && modEnabled(enabledModules, "comms") &&
    (can(perms, "comms") || (modEnabled(enabledModules, "subcontractors") && can(perms, "invoices_subcontractor")));
  const showBilling = signedIn && modEnabled(enabledModules, "billing") && can(perms, "billing");
  const showContractors = signedIn && modEnabled(enabledModules, "subcontractors") && role === "member";
  const showInventory =
    signedIn && modEnabled(enabledModules, "inventory") &&
    (can(perms, "inventory") || can(perms, "inventory_request"));
  const showHr = signedIn && modEnabled(enabledModules, "hr") && canAccessHr(perms);
  const showProjects = signedIn && modEnabled(enabledModules, "projects") && canAccessProjects(perms);
  const showSocials = signedIn && modEnabled(enabledModules, "socials") && canAccessSocials(perms);
  const showAffine = signedIn && modEnabled(enabledModules, "affine") && canAccessAffine(perms);
  const showNotetaker = signedIn && canAccessNotetaker(perms);
  const showAdminTools =
    signedIn && (can(perms, "shifts_manage") || can(perms, "users_manage"));

  const isSubcontractor = signedIn && role === "subcontractor";
  const homeHref = isSubcontractor ? "/subcontractor" : "/";

  const sectionLinks: SectionLink[] = (() => {
    const on = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
    const links: SectionLink[] = [];

    if (pathname.startsWith("/comms")) {
      links.push(
        { href: "/comms", label: "Channels", icon: MessageSquare, active: on("/comms") && !pathname.startsWith("/comms/vdo") && !pathname.startsWith("/comms/radio"), visible: true },
        { href: "/comms/vdo", label: "Production video", icon: Video, active: on("/comms/vdo"), visible: signedIn },
        { href: "/comms/radio", label: "Radio", icon: Mic, active: on("/comms/radio"), visible: true },
      );
    }

    if (signedIn && !isSubcontractor && pathname.startsWith("/hr")) {
      const canDir = can(perms, "hr_manage") || can(perms, "users_manage");
      links.push(
        { href: "/hr", label: "Overview", icon: Building2, active: pathname === "/hr", visible: showHr },
        { href: "/hr/profile", label: "My profile", icon: UserCircle, active: on("/hr/profile"), visible: showHr },
        { href: "/hr/leave", label: "Leave", icon: Calendar, active: on("/hr/leave"), visible: showHr },
        { href: "/hr/directory", label: "Directory", icon: Building2, active: on("/hr/directory"), visible: showHr && canDir },
      );
    }

    if (signedIn && !isSubcontractor && pathname.startsWith("/billing")) {
      links.push(
        { href: "/billing", label: "Documents", icon: Receipt, active: pathname === "/billing" || (pathname.startsWith("/billing/") && !pathname.startsWith("/billing/clients") && !pathname.startsWith("/billing/catalog") && !pathname.startsWith("/billing/payables") && !pathname.startsWith("/billing/settings")), visible: showBilling },
        { href: "/billing/new", label: "New invoice", icon: Receipt, active: on("/billing/new"), visible: showBilling },
        { href: "/billing/clients", label: "Clients", icon: Building2, active: on("/billing/clients"), visible: showBilling },
        { href: "/billing/catalog", label: "Catalog", icon: Boxes, active: on("/billing/catalog"), visible: showBilling },
        { href: "/billing/payables", label: "Payables", icon: FileText, active: on("/billing/payables"), visible: showBilling },
        { href: "/billing/settings", label: "Settings", icon: Shield, active: on("/billing/settings"), visible: showBilling },
      );
    }

    if (signedIn && !isSubcontractor && pathname.startsWith("/projects")) {
      const canManage = can(perms, "projects_manage");
      links.push(
        { href: "/projects", label: "All projects", icon: FolderKanban, active: pathname === "/projects", visible: showProjects },
        { href: "/projects/new", label: "New project", icon: FolderKanban, active: pathname === "/projects/new", visible: showProjects && canManage },
      );
    }

    if (signedIn && !isSubcontractor && pathname.startsWith("/inventory")) {
      const canManage = can(perms, "inventory") || can(perms, "users_manage");
      const canApprove = can(perms, "users_manage");
      links.push(
        { href: "/inventory", label: "Items", icon: Boxes, active: pathname === "/inventory" || (pathname.startsWith("/inventory/") && !pathname.startsWith("/inventory/checkout") && !pathname.startsWith("/inventory/requests") && !pathname.startsWith("/inventory/import") && !pathname.startsWith("/inventory/jobs") && !pathname.startsWith("/inventory/my-requests") && !pathname.startsWith("/inventory/new")), visible: showInventory },
        { href: "/inventory/checkout", label: "Checkout", icon: Boxes, active: on("/inventory/checkout"), visible: showInventory },
        { href: "/inventory/my-requests", label: "My requests", icon: FileText, active: on("/inventory/my-requests"), visible: showInventory },
        { href: "/inventory/jobs", label: "Jobs", icon: ClipboardList, active: on("/inventory/jobs"), visible: showInventory },
        { href: "/inventory/requests", label: "Approvals", icon: Shield, active: on("/inventory/requests"), visible: showInventory && canApprove },
        { href: "/inventory/import", label: "Import", icon: FileText, active: on("/inventory/import"), visible: showInventory && canApprove },
        { href: "/inventory/new", label: "New item", icon: Boxes, active: on("/inventory/new"), visible: showInventory && canManage },
      );
    }

    if (signedIn && !isSubcontractor && pathname.startsWith("/shifts")) {
      links.push(
        { href: "/shifts", label: "Shift list", icon: ClipboardList, active: on("/shifts") && !pathname.startsWith("/shifts/manage"), visible: canAccessShiftsList(perms) },
        { href: "/shifts/manage", label: "Manage", icon: Shield, active: on("/shifts/manage"), visible: can(perms, "shifts_manage") },
      );
    }

    if (signedIn && !isSubcontractor && pathname.startsWith("/notetaker")) {
      links.push(
        { href: "/notetaker", label: "Notetaker", icon: BookOpen, active: pathname === "/notetaker", visible: showNotetaker },
        { href: "/notetaker/library", label: "Library", icon: BookOpen, active: on("/notetaker/library"), visible: showNotetaker },
      );
    }

    if (signedIn && !isSubcontractor && pathname.startsWith("/admin")) {
      const canSynapse = can(perms, "embed_synapse");
      const canUsers = can(perms, "users_manage");
      links.push(
        { href: "/admin", label: "Admin panel", icon: Shield, active: pathname === "/admin", visible: true },
        { href: "/admin/users", label: "Users", icon: UserCircle, active: on("/admin/users"), visible: canUsers },
        { href: "/admin/members", label: "Members", icon: UserCircle, active: on("/admin/members"), visible: canUsers },
        { href: "/admin/hr-document-storage", label: "HR storage", icon: Building2, active: on("/admin/hr-document-storage"), visible: canUsers },
        { href: "/admin/synapse", label: "Synapse admin", icon: Server, active: on("/admin/synapse"), visible: canSynapse },
      );
    }

    return links.filter((l) => l.visible);
  })();

  const toggleButton = (
    <button
      type="button"
      onClick={() => setSidebarHidden((v) => !v)}
      className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300 transition"
      aria-label={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
      title={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
    >
      {sidebarHidden ? (
        <PanelLeftOpen className="h-4 w-4" aria-hidden />
      ) : (
        <PanelLeftClose className="h-4 w-4" aria-hidden />
      )}
    </button>
  );

  const sidebar = (
    <>
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={homeHref}
            className="flex flex-col gap-1"
            onClick={() => setMobileOpen(false)}
          >
            <BrandLogo heightClass="h-9" priority />
            <span className="sr-only">Crew Hub — home</span>
          </Link>
          <div className="mt-1 shrink-0">{toggleButton}</div>
        </div>
        <p className="mt-2 text-xs leading-snug text-slate-500">
          {signedIn && session?.username && (
            <span className="text-brand/90">
              {session.username}
              {session.email && (
                <span className="text-slate-500"> · {session.email}</span>
              )}
            </span>
          )}
          {signedIn && role && (
            <span className="ml-1 text-slate-600">
              ·{" "}
              {role === "admin"
                ? "admin"
                : role === "member"
                  ? "member"
                  : "subcontractor"}
            </span>
          )}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {/* ── Main ── */}
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Main
        </p>
        <div className="space-y-0.5">
          {!signedIn ? (
            <>
              <NavLink
                href="/comms"
                label="Channels"
                icon={MessageSquare}
                active={isActive("/comms") && !pathname.startsWith("/comms/radio")}
                onNavigate={() => setMobileOpen(false)}
              />
              <NavLink
                href="/comms/radio"
                label="Radio"
                icon={Mic}
                active={pathname.startsWith("/comms/radio")}
                onNavigate={() => setMobileOpen(false)}
              />
            </>
          ) : isSubcontractor ? (
            <>
              <NavLink
                href="/subcontractor"
                label="Home"
                icon={LayoutDashboard}
                active={pathname === "/subcontractor"}
                onNavigate={() => setMobileOpen(false)}
              />
              <NavLink
                href="/subcontractor/invoices"
                label="Submit invoice"
                icon={FileText}
                active={isActive("/subcontractor/invoices")}
                onNavigate={() => setMobileOpen(false)}
              />
              {showVdoNinja && (
                <NavLink
                  href="/comms/vdo"
                  label="Production video"
                  icon={Video}
                  active={pathname.startsWith("/comms/vdo")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
            </>
          ) : (
            <NavLink
              href="/"
              label="Dashboard"
              icon={LayoutDashboard}
              active={isActive("/")}
              onNavigate={() => setMobileOpen(false)}
            />
          )}
        </div>

        {/* ── In this section ── */}
        {sectionLinks.length >= 2 && (
          <>
            <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              In this section
            </p>
            <div className="space-y-0.5">
              {sectionLinks.map((l) => (
                <NavLink
                  key={l.href}
                  href={l.href}
                  label={l.label}
                  icon={l.icon}
                  active={l.active}
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Crew ── */}
        {signedIn && !isSubcontractor && (showCrewNav || showSchedule) && (
          <>
            <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Crew
            </p>
            <div className="space-y-0.5">
              {showCrewNav && (
                <NavLink
                  href="/shifts"
                  label="Shifts"
                  icon={ClipboardList}
                  active={pathname === "/shifts"}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              {showSchedule && (
                <NavLink
                  href="/calendar"
                  label="Schedule"
                  icon={Calendar}
                  active={isActive("/calendar")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
            </div>
          </>
        )}

        {/* ── Native (team) ── */}
        {signedIn && !isSubcontractor &&
          (showComms || showVdoNinja || showBilling || showContractors || showInventory || showHr || showProjects || showSocials || showNotetaker) && (
          <>
            <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Native (team)
            </p>
            <div className="space-y-0.5">
              {showHr && (
                <>
                  <NavLink
                    href="/hr"
                    label="HR"
                    icon={Building2}
                    active={isActive("/hr") && !pathname.startsWith("/hr/profile")}
                    onNavigate={() => setMobileOpen(false)}
                  />
                  <NavLink
                    href="/hr/profile"
                    label="My profile"
                    icon={UserCircle}
                    active={pathname === "/hr/profile" || pathname.startsWith("/hr/profile/")}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </>
              )}
              {showComms && (
                <NavLink
                  href="/comms"
                  label="Matrix channels"
                  icon={MessageSquare}
                  active={isActive("/comms") && !pathname.startsWith("/comms/vdo")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              {showVdoNinja && (
                <NavLink
                  href="/comms/vdo"
                  label="Production video"
                  icon={Video}
                  active={pathname.startsWith("/comms/vdo")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              {showComms && (
                <NavLink
                  href="/comms/radio"
                  label="Radio"
                  icon={Mic}
                  active={pathname.startsWith("/comms/radio")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              {showContractors && (
                <NavLink
                  href="/contractors"
                  label="Contractors"
                  icon={FileText}
                  active={isActive("/contractors")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              {showBilling && (
                <NavLink
                  href="/billing"
                  label="Billing"
                  icon={Receipt}
                  active={isActive("/billing")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              {showInventory && (
                <NavLink
                  href="/inventory"
                  label="Inventory"
                  icon={Boxes}
                  active={isActive("/inventory")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              {showProjects && (
                <NavLink
                  href="/projects"
                  label="Projects"
                  icon={FolderKanban}
                  active={isActive("/projects")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              {showSocials && (
                <NavLink
                  href="/socials"
                  label="Socials"
                  icon={Share2}
                  active={isActive("/socials")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              {showAffine && (
                <NavLink
                  href="/workspace"
                  label="Workspace"
                  icon={PenSquare}
                  active={isActive("/workspace")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              {showNotetaker && (
                <NavLink
                  href="/notetaker"
                  label="Notetaker"
                  icon={BookOpen}
                  active={isActive("/notetaker")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
            </div>
          </>
        )}

        {/* ── Admin ── */}
        {signedIn && !isSubcontractor && showAdminTools && (
          <>
            <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Admin
            </p>
            <div className="space-y-0.5">
              <NavLink
                href="/admin"
                label="Admin panel"
                icon={Shield}
                active={pathname === "/admin" || pathname.startsWith("/admin/hr-document-storage")}
                onNavigate={() => setMobileOpen(false)}
              />
              <NavLink
                href="/setup"
                label="Setup"
                icon={Shield}
                active={isActive("/setup")}
                onNavigate={() => setMobileOpen(false)}
              />
              {can(perms, "embed_synapse") && (
                <NavLink
                  href="/admin/synapse"
                  label="Synapse admin"
                  icon={Server}
                  active={isActive("/admin/synapse")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              {can(perms, "shifts_manage") && (
                <NavLink
                  href="/shifts/manage"
                  label="Manage shifts"
                  icon={ClipboardList}
                  active={isActive("/shifts/manage")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              {can(perms, "users_manage") && (
                <NavLink
                  href="/inventory/requests"
                  label="Stock approvals"
                  icon={Boxes}
                  active={isActive("/inventory/requests")}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
            </div>
          </>
        )}

        {/* ── Access ── */}
        <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Access
        </p>
        <div className="space-y-0.5">
          {!signedIn && (
            <NavLink
              href="/login"
              label="Sign in"
              icon={LogIn}
              active={isActive("/login")}
              onNavigate={() => setMobileOpen(false)}
            />
          )}
          {signedIn && (
            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              Sign out
            </button>
          )}
        </div>

        {/* ── Help ── */}
        <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Help
        </p>
        <div className="space-y-0.5">
          <NavLink
            href="/onboard"
            label="Deployment guides"
            icon={BookOpen}
            active={isActive("/onboard")}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      </nav>
    </>
  );

  return (
    <div className="flex h-dvh w-full flex-col bg-[#060405] text-slate-100 md:flex-row">
      {/* Mobile header */}
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#060405]/95 px-4 py-3 backdrop-blur md:hidden">
        <Link
          href={homeHref}
          className="flex items-center"
          aria-label="Crew Hub home"
        >
          <BrandLogo heightClass="h-8" priority />
        </Link>
        <button
          type="button"
          className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          aria-label="Menu"
          onClick={() => setMobileOpen((o) => !o)}
        >
          <span className="sr-only">Menu</span>
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {mobileOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative ml-auto flex h-full w-[min(100%,280px)] flex-col border-l border-white/10 bg-surface shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Desktop sidebar — fully hidden when sidebarHidden */}
      {!sidebarHidden && (
        <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-nav md:flex lg:w-64">
          {sidebar}
        </aside>
      )}

      {/* Edge tab to restore hidden sidebar */}
      {sidebarHidden && (
        <button
          type="button"
          onClick={() => setSidebarHidden(false)}
          aria-label="Show sidebar"
          title="Show sidebar"
          className="fixed left-0 top-1/2 z-40 hidden -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-white/10 bg-nav px-1.5 py-3 text-slate-400 shadow-lg hover:text-white transition md:flex"
        >
          <PanelLeftOpen className="h-4 w-4" aria-hidden />
        </button>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        {children}
      </div>
    </div>
  );
}
