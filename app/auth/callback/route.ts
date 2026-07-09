import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth/session";
import { resolveSafeAppRedirect } from "@/lib/auth/condo-access-guard";
import { buildTabSessionRedirect } from "@/lib/auth/session-tab";
import { cleanupOrphanResidentMemberships } from "@/lib/auth/membership-cleanup";
import { applyPendingPasswordResetCookie } from "@/lib/auth/password-reset";
import { getSupabasePublicEnv, isSupabaseConfigured } from "@/lib/supabase/env";
import { copyCookies } from "@/lib/supabase/middleware";
import { asBrowserSessionCookieOptions } from "@/lib/supabase/session-cookies";
import type { Database } from "@/types/database.types";

export const dynamic = "force-dynamic";

function resolveNextPath(value: string | null, type: string | null) {
  if (type === "recovery") {
    return "/reset-password";
  }

  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/app";
  }

  return value;
}

function isRecoveryFlow(next: string, type: string | null) {
  return type === "recovery" || next === "/reset-password";
}

function createRouteHandlerClient(request: NextRequest, response: NextResponse) {
  const env = getSupabasePublicEnv();

  if (!env) {
    throw new Error("Supabase não configurado.");
  }

  return createServerClient<Database>(env.url, env.anonKey, {
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
}

function redirectWithOptionalPasswordReset(
  requestUrl: URL,
  destination: string,
): NextResponse {
  const response = NextResponse.redirect(new URL(destination, requestUrl.origin));

  if (destination === "/reset-password") {
    return applyPendingPasswordResetCookie(response);
  }

  return response;
}

function redirectToForgotPassword(requestUrl: URL) {
  return NextResponse.redirect(new URL("/forgot-password?error=recovery", requestUrl.origin));
}

async function finalizeAuthRedirect(
  requestUrl: URL,
  sessionResponse: NextResponse,
  supabase: ReturnType<typeof createRouteHandlerClient>,
  next: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await ensureProfile(user);
      await cleanupOrphanResidentMemberships(user.id);
    } catch {
      // Sessão já foi criada; profile pode ser garantido depois.
    }
  }

  const destination = await resolveSafeAppRedirect(supabase, next);
  const redirectTarget =
    destination === "/reset-password" ? destination : buildTabSessionRedirect(destination);
  const finalResponse = redirectWithOptionalPasswordReset(requestUrl, redirectTarget);
  copyCookies(sessionResponse, finalResponse);
  return finalResponse;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash =
    requestUrl.searchParams.get("token_hash") ?? requestUrl.searchParams.get("token");
  const type = requestUrl.searchParams.get("type");
  const next = resolveNextPath(requestUrl.searchParams.get("next"), type);
  const recovery = isRecoveryFlow(next, type);

  if (tokenHash && type) {
    const response = redirectWithOptionalPasswordReset(
      requestUrl,
      recovery ? "/reset-password" : next,
    );
    const supabase = createRouteHandlerClient(request, response);
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    if (error) {
      return redirectToForgotPassword(requestUrl);
    }

    if (recovery) {
      return response;
    }

    return finalizeAuthRedirect(requestUrl, response, supabase, next);
  }

  if (!code) {
    const response = NextResponse.redirect(new URL("/login", requestUrl.origin));
    const supabase = createRouteHandlerClient(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      return finalizeAuthRedirect(requestUrl, response, supabase, next);
    }

    const oauthError = requestUrl.searchParams.get("error");
    if (oauthError) {
      return NextResponse.redirect(new URL("/login?error=callback", requestUrl.origin));
    }

    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const response = redirectWithOptionalPasswordReset(
    requestUrl,
    recovery ? "/reset-password" : next,
  );
  const supabase = createRouteHandlerClient(request, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectToForgotPassword(requestUrl);
  }

  if (recovery) {
    return response;
  }

  return finalizeAuthRedirect(requestUrl, response, supabase, next);
}
