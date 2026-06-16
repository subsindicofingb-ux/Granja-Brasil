"use client";

import { useActionState } from "react";
import { addMembershipAction } from "@/lib/auth/actions";
import { ROLES } from "@/lib/constants";
import { getRolePermissions } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddMembershipFormProps {
  condoSlug: string;
}

export function AddMembershipForm({ condoSlug }: AddMembershipFormProps) {
  const [state, formAction, pending] = useActionState(addMembershipAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />

      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.success}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">E-mail do usuário</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="usuario@email.com"
          required
        />
        <p className="text-xs text-muted-foreground">
          O usuário deve ter criado conta em /signup antes do vínculo.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Papel no condomínio</Label>
        <select
          id="role"
          name="role"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          defaultValue={ROLES.RESIDENT}
          required
        >
          {Object.values(ROLES)
            .filter((role) => role !== ROLES.SUPER_ADMIN)
            .map((role) => (
              <option key={role} value={role}>
                {getRolePermissions(role).label}
              </option>
            ))}
        </select>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Vinculando..." : "Vincular membro"}
      </Button>
    </form>
  );
}
