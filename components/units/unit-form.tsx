"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createUnitAction, deleteUnitAction, updateUnitAction } from "@/lib/actions/units";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Tower } from "@/types";

interface UnitFormProps {
  condoSlug: string;
  condoName?: string;
  towers: Pick<Tower, "id" | "name">[];
  mode: "create" | "edit";
  defaultValues?: {
    unitId?: string;
    towerId?: string;
    number?: string;
    block?: string | null;
  };
}

export function UnitForm({ condoSlug, condoName, towers, mode, defaultValues }: UnitFormProps) {
  const action = mode === "create" ? createUnitAction : updateUnitAction;
  const [state, formAction, pending] = useActionState(action, {});
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteUnitAction, {});

  if (towers.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Cadastre pelo menos uma torre antes de criar unidades.{" "}
        <Link href={`/app/${condoSlug}/towers/new`} className="font-medium underline">
          Nova torre
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="condo_slug" value={condoSlug} />
        {mode === "edit" && defaultValues?.unitId && (
          <input type="hidden" name="unit_id" value={defaultValues.unitId} />
        )}

        <FormAlert error={state.error} success={state.success} />

        {mode === "create" && condoName && (
          <p className="text-sm text-muted-foreground">
            A unidade será cadastrada no condomínio <span className="font-medium">{condoName}</span>.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="tower_id">Torre</Label>
          <select
            id="tower_id"
            name="tower_id"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            defaultValue={defaultValues?.towerId ?? ""}
            required
          >
            <option value="" disabled>
              Selecione a torre
            </option>
            {towers.map((tower) => (
              <option key={tower.id} value={tower.id}>
                {tower.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="number">Número</Label>
          <Input
            id="number"
            name="number"
            placeholder="Ex: 304"
            defaultValue={defaultValues?.number}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="block">Bloco (opcional)</Label>
          <Input
            id="block"
            name="block"
            placeholder="Ex: A"
            defaultValue={defaultValues?.block ?? ""}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : mode === "create" ? "Criar unidade" : "Salvar alterações"}
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/units`}>Cancelar</Link>
          </Button>
        </div>
      </form>

      {mode === "edit" && defaultValues?.unitId && (
        <div className="border-t pt-4">
          <FormAlert error={deleteState.error} />
          <form action={deleteFormAction}>
            <input type="hidden" name="condo_slug" value={condoSlug} />
            <input type="hidden" name="unit_id" value={defaultValues.unitId} />
            <Button
              type="submit"
              variant="destructive"
              disabled={deletePending}
              onClick={(event) => {
                if (
                  !window.confirm(
                    "Excluir esta unidade? Esta ação não pode ser desfeita.",
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              {deletePending ? "Excluindo..." : "Excluir unidade"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
