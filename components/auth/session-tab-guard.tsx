"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  hasAppSessionTab,
  markAppSessionTab,
} from "@/lib/auth/session-tab";
import { createClient } from "@/lib/supabase/client";

type SessionTabGuardProps = {
  children: ReactNode;
  /** When set, stale sessions redirect here after sign-out. */
  staleRedirect?: string;
};

function SessionLoading() {
  return (
    <p className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Verificando sessão...
    </p>
  );
}

export function SessionTabGuard({ children, staleRedirect = "/login" }: SessionTabGuardProps) {
  const router = useRouter();
  const checked = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (checked.current) {
      return;
    }

    checked.current = true;

    if (hasAppSessionTab()) {
      setReady(true);
      return;
    }

    const supabase = createClient();

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setReady(true);
        return;
      }

      // Sessão válida sem marca de aba (ex.: acabou de redefinir senha):
      // marca e segue — nunca faz signOut aqui (isso causava o 2º login).
      markAppSessionTab();
      setReady(true);
    });
  }, [router, staleRedirect]);

  if (!ready) {
    return <SessionLoading />;
  }

  return <>{children}</>;
}

export function LoginSessionGuard({ children }: { children: ReactNode }) {
  const checked = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (checked.current) {
      return;
    }

    checked.current = true;

    const supabase = createClient();

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setReady(true);
        return;
      }

      // Já autenticado: entra no app. Não faz signOut (corrida com o formulário).
      markAppSessionTab();
      window.location.assign("/app");
    });
  }, []);

  if (!ready) {
    return <SessionLoading />;
  }

  return <>{children}</>;
}
