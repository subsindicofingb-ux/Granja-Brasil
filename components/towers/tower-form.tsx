"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createTowerAction, updateTowerAction } from "@/lib/actions/towers";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TowerFormProps {
  condoSlug: string;
  mode: "create" | "edit";
  defaultValues?: {
    towerId?: string;
    name?: string;
    floors?: number;
  };
}

export function TowerForm({ condoSlug, mode, defaultValues }: TowerFormProps) {
  const action = mode === "create" ? createTowerAction : updateTowerAction;
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      {mode === "edit" && defaultValues?.towerId && (
        <input type="hidden" name="tower_id" value={defaultValues.towerId} />
      )}

      <FormAlert error={state.error} success={state.success} />

      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          name="name"
          placeholder="Ex: Torre C"
          defaultValue={defaultValues?.name}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="floors">Número de andares</Label>
        <Input
          id="floors"
          name="floors"
          type="number"
          placeholder="12"
          min={1}
          max={200}
          defaultValue={defaultValues?.floors ?? 1}
          required
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : mode === "create" ? "Criar torre" : "Salvar alterações"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/towers`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
