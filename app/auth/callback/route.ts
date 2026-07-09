import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth/session";
import { resolveSafeAppRedirect } from "@/lib/auth/condo-access-guard";
import { buildTabSessionRedirect } from "@/lib/auth/session-tab";
import { cleanupOrphanResidentMemberships } from "@/lib/auth/membership-cleanup";
import { applyPendingPasswordResetCookie } from "@/lib/auth/password-reset";
import { getSupabasePublicEnv, isSupabaseConfigured } from "@/lib/supabase/env";
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

async function finalizeAuthRedirect(
  requestUrl: URL,
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
  return redirectWithOptionalPasswordReset(requestUrl, redirectTarget);
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value, cookie);
  });
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

  if (tokenHash && type) {
    const redirectTarget = type === "recovery" ? "/reset-password" : next;
    const response = redirectWithOptionalPasswordReset(requestUrl, redirectTarget);
    const supabase = createRouteHandlerClient(request, response);
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    if (error) {
      return NextResponse.redirect(
        new URL("/forgot-password?error=recovery", requestUrl.origin),
      );
    }

    return response;
  }

  if (!code) {
    if (type === "recovery" || next === "/reset-password") {
      return NextResponse.redirect(new URL("/reset-password", requestUrl.origin));
    }

    const response = NextResponse.redirect(new URL("/login", requestUrl.origin));
    const supabase = createRouteHandlerClient(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      return finalizeAuthRedirect(requestUrl, supabase, next);
    }

    const oauthError = requestUrl.searchParams.get("error");
    if (oauthError) {
      return NextResponse.redirect(new URL("/login?error=callback", requestUrl.origin));
    }

    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const isRecovery = type === "recovery" || next === "/reset-password";
  const response = redirectWithOptionalPasswordReset(
    requestUrl,
    isRecovery ? "/reset-password" : next,
  );
  const supabase = createRouteHandlerClient(request, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/forgot-password?error=recovery", requestUrl.origin),
    );
  }

  if (isRecovery) {
    return response;
  }

  const destination = await resolveSafeAppRedirect(supabase, next);
  const redirectTarget = buildTabSessionRedirect(destination);
  const finalResponse = NextResponse.redirect(new URL(redirectTarget, requestUrl.origin));
  copyResponseCookies(response, finalResponse);

  return finalResponse;
}
