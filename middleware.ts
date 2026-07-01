import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  canAccessCondoSlug,
  extractCondoSlugFromAppPath,
  userHasAnyMembership,
} from "@/lib/auth/condo-access-guard";
import {
  copyCookies,
  isAuthRoute,
  isPublicAuthPath,
  updateSession,
} from "@/lib/supabase/middleware";
import { PENDING_PASSWORD_RESET_COOKIE } from "@/lib/auth/constants";
import { PENDING_APPROVAL_PATH, userHasAppAccess } from "@/lib/auth/pending-approval";
import type { Database } from "@/types/database.types";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isServerAction = request.method === "POST" && request.headers.has("next-action");
  const { response, user, configured } = await updateSession(request);

  if (isServerAction) {
    return response;
  }

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
  const pendingPasswordReset =
    request.cookies.get(PENDING_PASSWORD_RESET_COOKIE)?.value === "1";

  if (pendingPasswordReset && user && pathname.startsWith("/app")) {
    const url = request.nextUrl.clone();
    url.pathname = "/reset-password";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (isProtectedApp && user) {
    const env = getSupabasePublicEnv();

    if (env) {
      const supabase = createServerClient<Database>(env.url, env.anonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      });

      const hasAppAccess = await userHasAppAccess(supabase);
      const isPendingApprovalPage =
        pathname === PENDING_APPROVAL_PATH || pathname.startsWith(`${PENDING_APPROVAL_PATH}/`);

      if (!hasAppAccess && !isPendingApprovalPage) {
        const url = request.nextUrl.clone();
        url.pathname = PENDING_APPROVAL_PATH;
        url.search = "";
        const redirectResponse = NextResponse.redirect(url);
        copyCookies(response, redirectResponse);
        return redirectResponse;
      }

      if (hasAppAccess && isPendingApprovalPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/app";
        url.search = "";
        const redirectResponse = NextResponse.redirect(url);
        copyCookies(response, redirectResponse);
        return redirectResponse;
      }

      if (isPendingApprovalPage) {
        return response;
      }
    }
  }

  if (isProtectedApp && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    const redirectResponse = NextResponse.redirect(url);
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (isLoginOrSignup && user && pathname !== "/reset-password") {
    if (pathname === "/login") {
      return response;
    }

    if (pathname === "/signup/concluido") {
      return response;
    }

    if (pathname === "/signup") {
      const env = getSupabasePublicEnv();
      if (env) {
        const supabase = createServerClient<Database>(env.url, env.anonKey, {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {},
          },
        });

        const hasMembership = await userHasAnyMembership(supabase);
        if (!hasMembership) {
          return response;
        }
      }
    }

    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";

    const env = getSupabasePublicEnv();
    if (env) {
      const supabase = createServerClient<Database>(env.url, env.anonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      });

      const hasAppAccess = await userHasAppAccess(supabase);
      if (!hasAppAccess) {
        url.pathname = PENDING_APPROVAL_PATH;
      }
    }

    const redirectResponse = NextResponse.redirect(url);
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  const condoSlug = extractCondoSlugFromAppPath(pathname);
  if (user && condoSlug) {
    const env = getSupabasePublicEnv();
    if (env) {
      const supabase = createServerClient<Database>(env.url, env.anonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Middleware only reads membership for routing.
          },
        },
      });

      const allowed = await canAccessCondoSlug(supabase, condoSlug);
      if (!allowed) {
        const url = request.nextUrl.clone();
        const hasAppAccess = await userHasAppAccess(supabase);
        url.pathname = hasAppAccess ? "/app" : PENDING_APPROVAL_PATH;
        url.search = "";
        const redirectResponse = NextResponse.redirect(url);
        copyCookies(response, redirectResponse);
        return redirectResponse;
      }
    }
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
  runtime: "nodejs",
};
