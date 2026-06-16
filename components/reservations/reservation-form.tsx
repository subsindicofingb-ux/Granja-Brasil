"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createReservationAction } from "@/lib/actions/reservations";
import { formatUnitWithTower } from "@/lib/residents/labels";
import type { CommonAreaRecord } from "@/lib/common-areas/types";
import type { UnitWithTower } from "@/lib/services/units";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReservationFormProps {
  condoSlug: string;
  areas: CommonAreaRecord[];
  units: UnitWithTower[];
}

export function ReservationForm({ condoSlug, areas, units }: ReservationFormProps) {
  const [state, formAction, pending] = useActionState(createReservationAction, {});

  if (areas.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Nenhum espaço ativo disponível para reserva.{" "}
        <Link href={`/app/${condoSlug}/areas`} className="font-medium underline">
          Ver espaços comuns
        </Link>
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Nenhuma unidade disponível para reserva neste condomínio.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <FormAlert error={state.error} success={state.success} />

      <div className="space-y-2">
        <Label htmlFor="common_area_id">Espaço comum</Label>
        <select
          id="common_area_id"
          name="common_area_id"
          required
          defaultValue=""
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="" disabled>
            Selecione o espaço
          </option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
              {area.requires_approval ? " (exige aprovação)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="unit_id">Unidade</Label>
        <select
          id="unit_id"
          name="unit_id"
          required
          defaultValue=""
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="" disabled>
            Selecione a unidade
          </option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {formatUnitWithTower(unit)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start_at">Início</Label>
          <Input id="start_at" name="start_at" type="datetime-local" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_at">Fim</Label>
          <Input id="end_at" name="end_at" type="datetime-local" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Opcional"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        A reserva será validada conforme as regras do espaço (horário, antecedência, buffer e
        limites). Espaços com aprovação obrigatória ficam pendentes até revisão.
      </p>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Solicitar reserva"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/reservations`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
