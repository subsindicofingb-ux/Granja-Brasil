import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth/session";
import { resolveSafeAppRedirect } from "@/lib/auth/condo-access-guard";
import { buildTabSessionRedirect } from "@/lib/auth/session-tab";
import { cleanupOrphanResidentMemberships } from "@/lib/auth/membership-cleanup";
import { applyPendingPasswordResetCookie } from "@/lib/auth/password-reset";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");
  const next = resolveNextPath(requestUrl.searchParams.get("next"), type);
  const supabase = await createClient();

  if (!code) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      try {
        await ensureProfile(user);
        await cleanupOrphanResidentMemberships(user.id);
      } catch {
        // Sessão já existe; profile pode ser garantido depois.
      }

      const destination = await resolveSafeAppRedirect(supabase, next);
      const redirectTarget =
        destination === "/reset-password" ? destination : buildTabSessionRedirect(destination);
      return redirectWithOptionalPasswordReset(requestUrl, redirectTarget);
    }

    const oauthError = requestUrl.searchParams.get("error");
    if (oauthError) {
      return NextResponse.redirect(new URL("/login?error=callback", requestUrl.origin));
    }

    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback", requestUrl.origin));
  }

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
