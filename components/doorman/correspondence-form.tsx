"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createCorrespondenceNoticeAction } from "@/lib/actions/correspondence";
import { formatUnitWithTower } from "@/lib/residents/labels";
import type { UnitWithTower } from "@/lib/services/units";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CorrespondenceFormProps {
  condoSlug: string;
  units: UnitWithTower[];
}

export function CorrespondenceForm({ condoSlug, units }: CorrespondenceFormProps) {
  const [state, formAction, pending] = useActionState(createCorrespondenceNoticeAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />

      <FormAlert error={state.error} success={state.success} />

      <div className="space-y-2">
        <Label htmlFor="unit_id">Unidade destino</Label>
        <select
          id="unit_id"
          name="unit_id"
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          required
        >
          <option value="">Selecione a unidade</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {formatUnitWithTower(unit)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição da correspondência</Label>
        <Input
          id="description"
          name="description"
          placeholder="Ex: Encomenda Amazon, carta registrada..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="carrier">Remetente / transportadora (opcional)</Label>
        <Input id="carrier" name="carrier" placeholder="Ex: Correios, Mercado Livre" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações (opcional)</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
        />
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
        O morador responsável da unidade receberá um e-mail informando a chegada da correspondência.
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Registrando..." : "Registrar correspondência"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/correspondence`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
