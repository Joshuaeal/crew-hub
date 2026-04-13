import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@/lib/session";
import {
  canAccessHr,
  canAccessSchedule,
  canAccessShiftsList,
  hasPermission,
} from "@/types/permissions";

function isSubcontractorInvoicePath(pathname: string) {
  return pathname === "/subcontractor/invoices" || pathname.startsWith("/subcontractor/invoices/");
}

/** Matrix Channels UI — requires `comms` */
function isCommsPath(pathname: string) {
  if (pathname === "/comms/vdo" || pathname.startsWith("/comms/vdo/")) return false;
  return pathname === "/comms" || pathname.startsWith("/comms/");
}

/** VDO.Ninja hub — `comms` or subcontractor invoice workspace */
function isCommsVdoPath(pathname: string) {
  return pathname === "/comms/vdo" || pathname.startsWith("/comms/vdo/");
}

function isBillingPath(pathname: string) {
  return pathname === "/billing" || pathname.startsWith("/billing/");
}

function isInventoryPath(pathname: string) {
  return pathname === "/inventory" || pathname.startsWith("/inventory/");
}

/** Second segment of /inventory/... — UUID detail is "detail". */
function inventoryRouteKind(pathname: string): "index" | "new" | "checkout" | "requests" | "import" | "jobs" | "my-requests" | "detail" {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return "index";
  const seg = parts[1] ?? "";
  if (seg === "new") return "new";
  if (seg === "checkout") return "checkout";
  if (seg === "requests") return "requests";
  if (seg === "import") return "import";
  if (seg === "jobs") return "jobs";
  if (seg === "my-requests") return "my-requests";
  return "detail";
}

function isEmbedSynapse(pathname: string) {
  return (
    pathname === "/synapse" ||
    pathname.startsWith("/synapse/") ||
    pathname === "/admin/synapse" ||
    pathname.startsWith("/admin/synapse/")
  );
}

/**
 * CORS preflight only for Synapse proxy paths.
 * Do NOT call NextResponse.next() with extra headers for GET/POST here — that breaks external rewrites
 * (empty body to Synapse → 4xx/5xx / “failed to fetch” in Comms). See next.config.mjs headers().
 */
function isMatrixProxyPath(pathname: string) {
  return (
    pathname.startsWith("/_matrix") ||
    pathname.startsWith("/_synapse") ||
    pathname.startsWith("/.well-known/matrix")
  );
}

function matrixCorsPreflightHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get("origin");
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      request.headers.get("access-control-request-headers") ??
      "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
  if (origin) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Credentials"] = "true";
    h.Vary = "Origin";
  } else {
    h["Access-Control-Allow-Origin"] = "*";
  }
  return h;
}

function isShiftsManagePath(pathname: string) {
  return pathname === "/shifts/manage" || pathname.startsWith("/shifts/manage/");
}

/** Admin hub and users-only notices under /admin (not /admin/users). */
function isAdminHubPath(pathname: string) {
  if (pathname === "/admin" || pathname === "/admin/") return true;
  if (pathname === "/admin/hr-document-storage" || pathname.startsWith("/admin/hr-document-storage/")) return true;
  return false;
}

function isAdminUsersPath(pathname: string) {
  return pathname === "/admin/users" || pathname.startsWith("/admin/users/");
}

/** Legacy path → same permission as users */
function isAdminMembersPath(pathname: string) {
  return pathname === "/admin/members" || pathname.startsWith("/admin/members/");
}

function isShiftsListPath(pathname: string) {
  if (pathname === "/shifts") return true;
  if (pathname.startsWith("/shifts/") && !pathname.startsWith("/shifts/manage")) return true;
  return false;
}

function isCalendarPath(pathname: string) {
  return pathname === "/calendar" || pathname.startsWith("/calendar/");
}

function isHrPath(pathname: string) {
  return pathname === "/hr" || pathname.startsWith("/hr/");
}

function isSetupPath(pathname: string) {
  return pathname === "/setup" || pathname.startsWith("/setup/");
}

function isProtectedPath(pathname: string) {
  return (
    isSubcontractorInvoicePath(pathname) ||
    isBillingPath(pathname) ||
    isInventoryPath(pathname) ||
    isEmbedSynapse(pathname) ||
    isShiftsManagePath(pathname) ||
    isAdminUsersPath(pathname) ||
    isAdminMembersPath(pathname) ||
    isShiftsListPath(pathname) ||
    isCalendarPath(pathname) ||
    isAdminHubPath(pathname) ||
    isHrPath(pathname) ||
    isSetupPath(pathname)
  );
}

function loginRedirect(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

function permList(payload: Record<string, unknown>): string[] | null {
  const p = payload.permissions;
  if (!Array.isArray(p) || !p.every((x) => typeof x === "string")) return null;
  return p as string[];
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const secret = process.env.CREW_SESSION_SECRET;

  if (isMatrixProxyPath(pathname) && request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: matrixCorsPreflightHeaders(request) });
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!secret || secret.length < 16) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "config");
    return NextResponse.redirect(url);
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return loginRedirect(request, pathname);
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const perms = permList(payload as Record<string, unknown>);
    if (!perms) {
      return loginRedirect(request, pathname);
    }

    if (isSubcontractorInvoicePath(pathname)) {
      if (!hasPermission(perms, "invoices_subcontractor")) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    if (isCommsVdoPath(pathname)) {
      if (
        !hasPermission(perms, "comms") &&
        !hasPermission(perms, "invoices_subcontractor")
      ) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    if (isCommsPath(pathname)) {
      if (!hasPermission(perms, "comms")) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    if (isBillingPath(pathname)) {
      if (!hasPermission(perms, "billing")) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    if (isInventoryPath(pathname)) {
      const kind = inventoryRouteKind(pathname);
      if (kind === "requests" || kind === "import") {
        if (!hasPermission(perms, "users_manage")) {
          return NextResponse.redirect(new URL("/", request.url));
        }
        return NextResponse.next();
      }
      if (kind === "new" || kind === "detail") {
        if (!hasPermission(perms, "inventory") && !hasPermission(perms, "users_manage")) {
          return NextResponse.redirect(new URL("/", request.url));
        }
        return NextResponse.next();
      }
      if (
        !hasPermission(perms, "inventory") &&
        !hasPermission(perms, "inventory_request") &&
        !hasPermission(perms, "users_manage")
      ) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    if (isEmbedSynapse(pathname)) {
      if (!hasPermission(perms, "embed_synapse")) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    if (isShiftsManagePath(pathname)) {
      if (!hasPermission(perms, "shifts_manage")) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    if (isAdminHubPath(pathname)) {
      if (
        !hasPermission(perms, "users_manage") &&
        !hasPermission(perms, "shifts_manage") &&
        !hasPermission(perms, "embed_synapse") &&
        !hasPermission(perms, "billing")
      ) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    if (isAdminUsersPath(pathname) || isAdminMembersPath(pathname)) {
      if (!hasPermission(perms, "users_manage")) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    if (isShiftsListPath(pathname)) {
      if (!canAccessShiftsList(perms)) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    if (isCalendarPath(pathname)) {
      if (!canAccessSchedule(perms)) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    if (isHrPath(pathname)) {
      if (!canAccessHr(perms)) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    return NextResponse.next();
  } catch {
    return loginRedirect(request, pathname);
  }
}

export const config = {
  matcher: [
    "/_matrix/:path*",
    "/_synapse/:path*",
    "/.well-known/matrix/:path*",
    "/subcontractor/invoices",
    "/subcontractor/invoices/:path*",
    "/synapse",
    "/synapse/:path*",
    "/admin/synapse",
    "/admin/synapse/:path*",
    "/billing",
    "/billing/:path*",
    "/inventory",
    "/inventory/:path*",
    "/shifts",
    "/shifts/:path*",
    "/calendar",
    "/calendar/:path*",
    "/admin",
    "/admin/hr-document-storage",
    "/admin/hr-document-storage/:path*",
    "/admin/users",
    "/admin/users/:path*",
    "/admin/members",
    "/admin/members/:path*",
    "/hr",
    "/hr/:path*",
  ],
};
