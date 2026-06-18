"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { createReservationAction } from "@/lib/actions/reservations";
import { formatUnitOptionLabel } from "@/lib/residents/labels";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ReservationAreaOption = {
  id: string;
  name: string;
  requiresApproval: boolean;
  requiresGuestCount: boolean;
  requiresPaymentReceipt: boolean;
  capacity: number;
};

interface ReservationFormProps {
  condoSlug: string;
  mode: "resident" | "staff";
  areas: ReservationAreaOption[];
  units: Array<{
    id: string;
    number: string;
    block: string | null;
    tower: { id: string; name: string; condominium_id: string };
  }>;
  condominiumNamesById?: Record<string, string>;
}

function todayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ReservationForm({
  condoSlug,
  mode,
  areas,
  units,
  condominiumNamesById,
}: ReservationFormProps) {
  const [state, formAction, pending] = useActionState(createReservationAction, {});
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const selectedArea = useMemo(
    () => areas.find((area) => area.id === selectedAreaId),
    [areas, selectedAreaId],
  );
  const singleUnit = units.length === 1 ? units[0] : null;
  const isResident = mode === "resident";

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
      <input type="hidden" name="form_mode" value={mode} />
      {singleUnit && isResident && (
        <input type="hidden" name="unit_id" value={singleUnit.id} />
      )}
      <FormAlert error={state.error} success={state.success} />

      <div className="space-y-2">
        <Label htmlFor="common_area_id">Espaço comum</Label>
        <select
          id="common_area_id"
          name="common_area_id"
          required
          value={selectedAreaId}
          onChange={(event) => setSelectedAreaId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="" disabled>
            Selecione o espaço
          </option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
              {area.requiresPaymentReceipt ? " (recibo obrigatório)" : ""}
              {area.requiresApproval && !area.requiresPaymentReceipt
                ? " (exige aprovação)"
                : ""}
            </option>
          ))}
        </select>
      </div>

      {(!isResident || !singleUnit) && (
        <div className="space-y-2">
          <Label htmlFor="unit_id">Unidade</Label>
          <select
            id="unit_id"
            name="unit_id"
            required={!singleUnit || !isResident}
            defaultValue={singleUnit?.id ?? ""}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            {!singleUnit && (
              <option value="" disabled>
                Selecione a unidade
              </option>
            )}
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {formatUnitOptionLabel(unit, condominiumNamesById)}
              </option>
            ))}
          </select>
        </div>
      )}

      {isResident ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="reservation_date">Data</Label>
            <Input
              id="reservation_date"
              name="reservation_date"
              type="date"
              required
              min={todayDateValue()}
              defaultValue={todayDateValue()}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_time">Horário de início</Label>
              <Input id="start_time" name="start_time" type="time" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">Horário de fim</Label>
              <Input id="end_time" name="end_time" type="time" required />
            </div>
          </div>
        </>
      ) : (
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
      )}

      {selectedArea?.requiresGuestCount && (
        <div className="space-y-2">
          <Label htmlFor="guest_count">Número de convidados</Label>
          <Input
            id="guest_count"
            name="guest_count"
            type="number"
            min={1}
            max={selectedArea.capacity}
            required
            placeholder={`Máximo ${selectedArea.capacity}`}
          />
        </div>
      )}

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

      {selectedArea?.requiresPaymentReceipt && (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          Após o pré-cadastro, envie o recibo de pagamento nesta reserva. A autorização final
          depende do recibo e da aprovação do administrador da Granja.
        </p>
      )}

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
