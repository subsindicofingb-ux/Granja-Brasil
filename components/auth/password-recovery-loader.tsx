"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type PasswordRecoveryLoaderProps = {
  hasRecoveryCookie?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function PasswordRecoveryLoaderContent({ hasRecoveryCookie = false }: PasswordRecoveryLoaderProps) {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      const tokenHash =
        searchParams.get("token_hash") ?? searchParams.get("token");
      const type = searchParams.get("type");
      const code = searchParams.get("code");

      if (tokenHash || code) {
        const params = new URLSearchParams(searchParams.toString());
        if (!params.get("next")) {
          params.set("next", "/reset-password");
        }
        if (!params.get("type") && type) {
          params.set("type", type);
        } else if (!params.get("type")) {
          params.set("type", "recovery");
        }
        window.location.assign(`/auth/callback?${params.toString()}`);
        return;
      }

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
            window.location.assign("/reset-password");
            return;
          }
        }
      }

      const maxAttempts = hasRecoveryCookie ? 10 : 4;
      const delayMs = hasRecoveryCookie ? 600 : 400;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (cancelled) {
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          window.location.assign("/reset-password");
          return;
        }

        if (attempt < maxAttempts - 1) {
          await sleep(delayMs);
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
  }, [searchParams, hasRecoveryCookie]);

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

export function PasswordRecoveryLoader(props: PasswordRecoveryLoaderProps) {
  return (
    <Suspense
      fallback={
        <p className="text-center text-sm text-muted-foreground">
          Validando link de recuperação...
        </p>
      }
    >
      <PasswordRecoveryLoaderContent {...props} />
    </Suspense>
  );
}
