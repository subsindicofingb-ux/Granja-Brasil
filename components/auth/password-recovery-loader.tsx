"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { confirmPasswordRecoverySessionAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

function PasswordRecoveryLoaderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      const supabase = createClient();
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;

      if (hash) {
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!sessionError && !cancelled) {
            window.history.replaceState({}, "", window.location.pathname);
            const confirmed = await confirmPasswordRecoverySessionAction();
            if (confirmed.ok) {
              router.refresh();
              return;
            }
          }
        }
      }

      const tokenHash =
        searchParams.get("token_hash") ?? searchParams.get("token");
      const type = searchParams.get("type");

      if (tokenHash && type) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as EmailOtpType,
        });

        if (!otpError && !cancelled) {
          window.history.replaceState({}, "", "/reset-password");
          const confirmed = await confirmPasswordRecoverySessionAction();
          if (confirmed.ok) {
            window.location.assign("/reset-password");
            return;
          }
        }
      }

      const code = searchParams.get("code");
      if (code && !cancelled) {
        const params = new URLSearchParams({
          code,
          next: "/reset-password",
          type: "recovery",
        });
        window.location.assign(`/auth/callback?${params.toString()}`);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && !cancelled) {
        const confirmed = await confirmPasswordRecoverySessionAction();
        if (confirmed.ok) {
          router.refresh();
          return;
        }
      }

      if (!cancelled) {
        setError("Link expirado ou inválido. Solicite um novo e-mail de redefinição.");
      }
    }

    void establishSession();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
        <Button asChild>
          <Link href="/forgot-password">Solicitar novo link</Link>
        </Button>
      </div>
    );
  }

  return (
    <p className="text-center text-sm text-muted-foreground">
      Validando link de recuperação...
    </p>
  );
}

export function PasswordRecoveryLoader() {
  return (
    <Suspense
      fallback={
        <p className="text-center text-sm text-muted-foreground">
          Validando link de recuperação...
        </p>
      }
    >
      <PasswordRecoveryLoaderContent />
    </Suspense>
  );
}
