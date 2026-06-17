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
  condominiums?: Pick<Tower, "id" | "name">[];
  mode: "create" | "edit";
  requiresTower?: boolean;
  linkedCounts?: {
    residents: number;
    reservations: number;
  };
  defaultValues?: {
    unitId?: string;
    towerId?: string;
    number?: string;
    block?: string | null;
  };
}

export function UnitForm({
  condoSlug,
  condoName,
  towers,
  condominiums,
  mode,
  requiresTower = true,
  linkedCounts,
  defaultValues,
}: UnitFormProps) {
  const useCondominiumPicker = Boolean(condominiums?.length);
  const pickerOptions = useCondominiumPicker ? condominiums! : towers;
  const action = mode === "create" ? createUnitAction : updateUnitAction;
  const [state, formAction, pending] = useActionState(action, {});
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteUnitAction, {});
  const hasLinkedRecords =
    (linkedCounts?.residents ?? 0) > 0 || (linkedCounts?.reservations ?? 0) > 0;

  function buildDeleteConfirmMessage() {
    if (!hasLinkedRecords) {
      return "Excluir esta unidade? Esta ação não pode ser desfeita.";
    }

    const parts: string[] = [];
    if ((linkedCounts?.residents ?? 0) > 0) {
      parts.push(
        `${linkedCounts?.residents} morador${(linkedCounts?.residents ?? 0) > 1 ? "es" : ""}`,
      );
    }
    if ((linkedCounts?.reservations ?? 0) > 0) {
      parts.push(
        `${linkedCounts?.reservations} reserva${(linkedCounts?.reservations ?? 0) > 1 ? "s" : ""}`,
      );
    }

    return `Esta unidade possui ${parts.join(" e ")} vinculados. Deseja realmente excluir? Os vínculos também serão removidos.`;
  }

  function handleDeleteClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(buildDeleteConfirmMessage())) {
      event.preventDefault();
      return;
    }

    const form = event.currentTarget.form;
    if (!form) {
      return;
    }

    const forceInput = form.querySelector<HTMLInputElement>('input[name="force_delete"]');
    if (forceInput) {
      forceInput.value = hasLinkedRecords ? "1" : "0";
    }
  }

  if (requiresTower && !useCondominiumPicker && towers.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Cadastre pelo menos uma torre antes de criar unidades.{" "}
        <Link href={`/app/${condoSlug}/towers/new`} className="font-medium underline">
          Nova torre
        </Link>
      </div>
    );
  }

  if (requiresTower && useCondominiumPicker && pickerOptions.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Cadastre pelo menos um condomínio antes de criar unidades.{" "}
        <Link href={`/app/${condoSlug}/units/condominiums/new`} className="font-medium underline">
          Novo condomínio
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

        {requiresTower && (
          <div className="space-y-2">
            <Label htmlFor={useCondominiumPicker ? "condominium_id" : "tower_id"}>
              {useCondominiumPicker ? "Condomínio" : "Torre"}
            </Label>
            <select
              id={useCondominiumPicker ? "condominium_id" : "tower_id"}
              name={useCondominiumPicker ? "condominium_id" : "tower_id"}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              defaultValue={defaultValues?.towerId ?? ""}
              required
            >
              <option value="" disabled>
                {useCondominiumPicker ? "Selecione o condomínio" : "Selecione a torre"}
              </option>
              {pickerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        )}

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
          <FormAlert error={deleteState.error} success={deleteState.success} />
          {hasLinkedRecords && (
            <p className="mb-3 text-sm text-amber-800">
              Esta unidade possui{" "}
              {(linkedCounts?.residents ?? 0) > 0 &&
                `${linkedCounts?.residents} morador${(linkedCounts?.residents ?? 0) > 1 ? "es" : ""}`}
              {(linkedCounts?.residents ?? 0) > 0 && (linkedCounts?.reservations ?? 0) > 0 && " e "}
              {(linkedCounts?.reservations ?? 0) > 0 &&
                `${linkedCounts?.reservations} reserva${(linkedCounts?.reservations ?? 0) > 1 ? "s" : ""}`}{" "}
              vinculados.
            </p>
          )}
          <form action={deleteFormAction}>
            <input type="hidden" name="condo_slug" value={condoSlug} />
            <input type="hidden" name="unit_id" value={defaultValues.unitId} />
            <input type="hidden" name="force_delete" defaultValue="0" />
            <Button
              type="submit"
              variant="destructive"
              disabled={deletePending}
              onClick={handleDeleteClick}
            >
              {deletePending ? "Excluindo..." : "Excluir unidade"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
