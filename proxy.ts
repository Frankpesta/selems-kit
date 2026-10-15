import type { NextFetchEvent, NextRequest } from "next/server";
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// Admin route protection and the Convex Auth cookie bridge (docs/03, docs/04).
// Runs only on /admin and /api/auth (see `config.matcher`), so public pages
// stay static and never touch auth.

const isLogin = createRouteMatcher(["/admin/login"]);

/** Set by the sign-in form when "Keep me signed in on this device" is ticked. */
const KEEP_COOKIE = "selems_keep";
const THIRTY_DAYS = 30 * 24 * 60 * 60;

type Handler = Parameters<typeof convexAuthNextjsMiddleware>[0];

const protect: Handler = async (request, { convexAuth }) => {
  const signedIn = await convexAuth.isAuthenticated();
  if (isLogin(request)) {
    // Signed-in staff skip the login page, except during sign-up or a reset.
    if (signedIn && !request.nextUrl.searchParams.has("mode")) return nextjsMiddlewareRedirect(request, "/admin");
    return;
  }
  if (request.nextUrl.pathname.startsWith("/admin") && !signedIn) {
    const next = request.nextUrl.pathname + request.nextUrl.search;
    return nextjsMiddlewareRedirect(request, `/admin/login?next=${encodeURIComponent(next)}`);
  }
};

// Cookie lifetime is fixed per middleware instance: session cookies by default,
// 30 days when the person chose to stay signed in.
const sessionOnly = convexAuthNextjsMiddleware(protect, { cookieConfig: { maxAge: null } });
const remembered = convexAuthNextjsMiddleware(protect, { cookieConfig: { maxAge: THIRTY_DAYS } });

export function proxy(request: NextRequest, event: NextFetchEvent) {
  return request.cookies.get(KEEP_COOKIE)?.value === "1" ? remembered(request, event) : sessionOnly(request, event);
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/auth", "/api/auth/:path*"],
};
