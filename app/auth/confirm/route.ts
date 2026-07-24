import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { applyPendingPasswordResetCookie } from "@/lib/auth/password-reset";
import { getSupabasePublicEnv, isSupabaseConfigured } from "@/lib/supabase/env";
import { asBrowserSessionCookieOptions } from "@/lib/supabase/session-cookies";
import type { Database } from "@/types/database.types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }

  const requestUrl = new URL(request.url);
  const tokenHash =
    requestUrl.searchParams.get("token_hash") ?? requestUrl.searchParams.get("token");
  const type = (requestUrl.searchParams.get("type") ?? "recovery") as EmailOtpType;

  if (!tokenHash) {
    const fallback =
      type === "signup" || type === "email"
        ? "/login?error=confirm"
        : "/forgot-password?error=recovery";
    return NextResponse.redirect(new URL(fallback, requestUrl.origin));
  }

  const env = getSupabasePublicEnv();
  if (!env) {
    return NextResponse.redirect(new URL("/login?error=config", requestUrl.origin));
  }

  const isSignupConfirm = type === "signup" || type === "email";
  const successPath = isSignupConfirm ? "/login?confirmed=1" : "/reset-password";
  const errorPath = isSignupConfirm ? "/login?error=confirm" : "/forgot-password?error=recovery";

  let response = NextResponse.redirect(new URL(successPath, requestUrl.origin));
  if (!isSignupConfirm) {
    response = applyPendingPasswordResetCookie(response);
  }

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, asBrowserSessionCookieOptions(options));
        });
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(new URL(errorPath, requestUrl.origin));
  }

  return response;
}
