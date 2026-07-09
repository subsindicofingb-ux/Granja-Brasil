"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { updatePasswordAction } from "@/lib/auth/actions";
import { PasswordRequirementsHint } from "@/components/auth/password-requirements-hint";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PASSWORD_RESET_SUCCESS_PATH = "/login?reset=success";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, {});

  const isRedirecting = Boolean(state.redirectTo);
  const visibleError =
    state.error && !state.error.includes("NEXT_REDIRECT") ? state.error : null;

  useEffect(() => {
    if (state.redirectTo) {
      window.location.assign(state.redirectTo);
      return;
    }

    if (state.error?.includes("NEXT_REDIRECT")) {
      window.location.assign(PASSWORD_RESET_SUCCESS_PATH);
    }
  }, [state.redirectTo, state.error]);

  return (
    <form action={formAction} className="space-y-4">
      {isRedirecting && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Senha salva com sucesso. Redirecionando para o login...
        </div>
      )}

      {visibleError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {visibleError}
        </div>
      )}

      <PasswordRequirementsHint />

      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirmar nova senha</Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
        />
      </div>

      <Button className="w-full" type="submit" disabled={pending || isRedirecting}>
        {pending ? "Salvando..." : isRedirecting ? "Redirecionando..." : "Salvar nova senha"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/forgot-password" className="text-primary hover:underline">
          Solicitar novo link
        </Link>
      </p>
    </form>
  );
}
