"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

function PasswordRecoveryLoaderContent() {
  const searchParams = useSearchParams();

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
            window.history.replaceState({}, "", "/reset-password");
            window.location.assign("/reset-password");
            return;
          }
        }
      }

      const tokenHash =
        searchParams.get("token_hash") ?? searchParams.get("token");
      const type = searchParams.get("type") ?? "recovery";

      if (tokenHash) {
        const params = new URLSearchParams({ token_hash: tokenHash, type });
        window.location.assign(`/auth/confirm?${params.toString()}`);
        return;
      }

      const code = searchParams.get("code");
      if (code) {
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
        window.location.assign("/reset-password");
        return;
      }

      // Sem token e sem sessão: não mostrar "link expirado" falso.
      if (!cancelled) {
        window.location.replace("/login");
      }
    }

    void establishSession();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

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
