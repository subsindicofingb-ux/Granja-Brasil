"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  createVisitorAuthorizationAction,
  updateVisitorAuthorizationAction,
} from "@/lib/actions/visitor-authorizations";
import { GUEST_TYPE } from "@/lib/constants";
import { formatUnitOptionLabel } from "@/lib/residents/labels";
import { GUEST_TYPE_OPTIONS } from "@/lib/visitor-authorizations/labels";
import type { VisitorAuthorizationFormInput } from "@/lib/visitor-authorizations/types";
import type { UnitWithTower } from "@/lib/services/units";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VisitorAuthorizationFormProps {
  condoSlug: string;
  mode: "create" | "edit";
  units: UnitWithTower[];
  condominiumNamesById?: Record<string, string>;
  defaultValues: VisitorAuthorizationFormInput & { authorizationId?: string };
}

export function VisitorAuthorizationForm({
  condoSlug,
  mode,
  units,
  condominiumNamesById,
  defaultValues,
}: VisitorAuthorizationFormProps) {
  const action =
    mode === "create" ? createVisitorAuthorizationAction : updateVisitorAuthorizationAction;
  const [state, formAction, pending] = useActionState(action, {});
  const [guestType, setGuestType] = useState(defaultValues.guest_type);

  if (units.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Nenhuma unidade disponível para autorização neste condomínio.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      {mode === "edit" && defaultValues.authorizationId && (
        <input type="hidden" name="authorization_id" value={defaultValues.authorizationId} />
      )}

      <FormAlert error={state.error} success={state.success} />

      <div className="space-y-2">
        <Label htmlFor="unit_id">Unidade</Label>
        <select
          id="unit_id"
          name="unit_id"
          required
          defaultValue={defaultValues.unit_id || ""}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="" disabled>
            Selecione a unidade
          </option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {formatUnitOptionLabel(unit, condominiumNamesById)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="guest_type">Tipo</Label>
        <select
          id="guest_type"
          name="guest_type"
          required
          value={guestType}
          onChange={(event) => setGuestType(event.target.value as typeof guestType)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          {GUEST_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="full_name">Nome completo</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={defaultValues.full_name}
          placeholder="Nome do visitante ou prestador"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="document_type">Tipo de documento</Label>
          <Input
            id="document_type"
            name="document_type"
            defaultValue={defaultValues.document_type ?? ""}
            placeholder="Ex: RG, CPF"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="document_number">Número do documento</Label>
          <Input
            id="document_number"
            name="document_number"
            defaultValue={defaultValues.document_number ?? ""}
            placeholder="Opcional"
          />
        </div>
      </div>

      {guestType === GUEST_TYPE.SERVICE_PROVIDER && (
        <div className="space-y-2">
          <Label htmlFor="company_name">Empresa</Label>
          <Input
            id="company_name"
            name="company_name"
            defaultValue={defaultValues.company_name ?? ""}
            placeholder="Nome da empresa prestadora"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="vehicle_plate">Placa do veículo</Label>
        <Input
          id="vehicle_plate"
          name="vehicle_plate"
          defaultValue={defaultValues.vehicle_plate ?? ""}
          placeholder="Opcional — ex: ABC1D23"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="access_starts_at">Início do acesso</Label>
          <Input
            id="access_starts_at"
            name="access_starts_at"
            type="datetime-local"
            defaultValue={defaultValues.access_starts_at}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="access_ends_at">Fim do acesso</Label>
          <Input
            id="access_ends_at"
            name="access_ends_at"
            type="datetime-local"
            defaultValue={defaultValues.access_ends_at}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaultValues.notes ?? ""}
          placeholder="Informações adicionais para a portaria (opcional)"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : mode === "create" ? "Registrar autorização" : "Salvar alterações"}
        </Button>
        <Button variant="ghost" asChild>
          <Link href={`/app/${condoSlug}/visitors`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
