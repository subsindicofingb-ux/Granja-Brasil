import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { AUTH_ROUTES, PUBLIC_AUTH_PATHS } from "@/lib/auth/constants";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const env = getSupabasePublicEnv();

  if (!env) {
    return { response: supabaseResponse, user: null, configured: false as const };
  }

  try {
    const supabase = createServerClient<Database>(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { response: supabaseResponse, user, configured: true as const };
  } catch {
    return { response: supabaseResponse, user: null, configured: false as const };
  }
}

export function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isPublicAuthPath(pathname: string) {
  return PUBLIC_AUTH_PATHS.some((route) => pathname.startsWith(route));
}

export function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value, cookie);
  });
}
