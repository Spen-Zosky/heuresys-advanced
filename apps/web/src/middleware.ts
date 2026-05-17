import { NextResponse, type NextRequest } from "next/server";

const ACCESS_COOKIE = "hrx_access";
const PUBLIC_PATHS = ["/login", "/_next", "/api"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasAccessCookie = req.cookies.has(ACCESS_COOKIE);

  if (!hasAccessCookie && !isPublic(pathname)) {
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
