import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protected route paths requiring authentication
const PROTECTED_PREFIXES = ["/dashboard", "/editor", "/settings", "/workspaces", "/billing"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected) {
    const token =
      request.cookies.get("token")?.value ||
      request.cookies.get("accessToken")?.value ||
      request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, site.webmanifest
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|site.webmanifest|brand).*)",
  ],
};
