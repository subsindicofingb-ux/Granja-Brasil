"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { updatePasswordAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, {});

  useEffect(() => {
    if (state.redirectTo) {
      window.location.assign(state.redirectTo);
    }
  }, [state.redirectTo]);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          minLength={6}
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
          placeholder="••••••••"
          minLength={6}
          required
        />
      </div>

      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar nova senha"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/forgot-password" className="text-primary hover:underline">
          Solicitar novo link
        </Link>
      </p>
    </form>
  );
}
