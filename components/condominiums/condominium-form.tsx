"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createCondominiumAction } from "@/lib/actions/condominiums";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CondominiumFormProps {
  condoSlug: string;
  returnTo?: "units" | "admin";
}

export function CondominiumForm({ condoSlug, returnTo = "admin" }: CondominiumFormProps) {
  const [state, formAction, pending] = useActionState(createCondominiumAction, {});
  const cancelHref =
    returnTo === "units"
      ? `/app/${condoSlug}/units`
      : `/app/${condoSlug}/admin/condominiums`;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="return_to" value={returnTo} />
      <FormAlert error={state.error} success={state.success} />

      <div className="space-y-2">
        <Label htmlFor="name">Nome do condomínio</Label>
        <Input id="name" name="name" placeholder="Ex: Residencial Granja Brasil" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Identificador (slug)</Label>
        <Input id="slug" name="slug" placeholder="ex: residencial-granja-brasil" required />
        <p className="text-xs text-muted-foreground">
          Usado na URL do painel. Apenas letras minúsculas, números e hífens.
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Cadastrar condomínio"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
