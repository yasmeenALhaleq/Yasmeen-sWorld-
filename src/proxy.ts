import { NextResponse, type NextRequest } from "next/server";

// First line of defence for the admin area: anything under /admin or
// /api/admin without a session cookie never reaches a page. This only checks
// that a cookie exists. The real check (is the session valid, unexpired and
// not idle?) happens in the admin layout and in every Server Action / route
// handler via requireAdmin() / assertAdmin().
const SESSION_COOKIE = "bw_admin";

const PUBLIC_ADMIN_PAGES = [/^\/admin\/login\/?$/, /^\/admin\/forgot-password\/?$/, /^\/admin\/reset-password\/[^/]+\/?$/];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_ADMIN_PAGES.some((re) => re.test(pathname))) return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
