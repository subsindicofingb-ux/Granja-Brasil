"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { AuthDivider } from "@/components/auth/auth-divider";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { signInAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginFormProps {
  redirectTo?: string;
}

export function LoginForm({ redirectTo = "/app" }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(signInAction, {});

  useEffect(() => {
    if (state.redirectTo) {
      window.location.assign(state.redirectTo);
    }
  }, [state.redirectTo]);

  return (
    <div className="space-y-4">
      <GoogleAuthButton redirectTo={redirectTo} label="Entrar com Google" />

      <AuthDivider />

      <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirect" value={redirectTo} />

      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="admin@condominio.com"
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password">Senha</Label>
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">
            Esqueci a senha
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>

      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Entrando..." : "Entrar"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Não tem conta?{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
    </div>
  );
}
