import { NextResponse, type NextRequest } from "next/server";
import {
  copyCookies,
  isAuthRoute,
  isPublicAuthPath,
  updateSession,
} from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user, configured } = await updateSession(request);

  if (!configured) {
    if (pathname.startsWith("/app")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "config");
      return NextResponse.redirect(url);
    }
    return response;
  }

  const isProtectedApp = pathname.startsWith("/app");
  const isLoginOrSignup = isAuthRoute(pathname);
  const isCallback = isPublicAuthPath(pathname);

  if (isProtectedApp && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    const redirectResponse = NextResponse.redirect(url);
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (isLoginOrSignup && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (isCallback) {
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
