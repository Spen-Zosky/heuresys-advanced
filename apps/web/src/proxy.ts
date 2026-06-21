import { NextResponse, type NextRequest } from "next/server";

const ACCESS_COOKIE = "hrx_access";
// D-26: the refresh cookie lives on Path=/ so the middleware can see a
// RESUMABLE session. With only the refresh cookie present (access TTL
// elapsed) we let the request through: the client's silent refresh
// (apiFetch 401 → POST /api/v1/auth/refresh) mints a fresh access token on
// the first data fetch. A revoked/expired refresh token ends in
// SessionExpiredError → the authenticated layout redirects to /login
// client-side. Redirecting here on a missing access cookie alone would
// hard-logout every user at the 15-minute mark.
const REFRESH_COOKIE = "hrx_refresh";
// `/showcase` is gated independently in apps/web/src/app/showcase/layout.tsx
// (env flag + non-production check). It must be public at the middleware level
// so Product Owner brand review does not require a login.
const PUBLIC_PATHS = ["/login", "/_next", "/api", "/showcase"];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true; // public marketing landing (front door)
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSessionCookie =
    req.cookies.has(ACCESS_COOKIE) || req.cookies.has(REFRESH_COOKIE);

  if (!hasSessionCookie && !isPublic(pathname)) {
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user hitting /login → forward to landing (handled by the
  // login page itself, since we don't know roles here).
  return NextResponse.next();
}

export const config = {
  // Match everything except Next.js internals + the public /api proxy itself.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
