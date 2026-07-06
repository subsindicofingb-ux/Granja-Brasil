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
import type { AccessDeviceOption } from "@/lib/access-devices/grant-types";
import { ResidentAccessDeviceFields } from "@/components/access-devices/resident-access-device-fields";
import { FormAlert } from "@/components/shared/feedback";
import { PhotoField } from "@/components/shared/photo-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VisitorAuthorizationFormProps {
  condoSlug: string;
  mode: "create" | "edit";
  units: UnitWithTower[];
  condominiumNamesById?: Record<string, string>;
  accessDevices?: AccessDeviceOption[];
  defaultAccessDeviceIds?: string[];
  defaultValues: VisitorAuthorizationFormInput & {
    authorizationId?: string;
    photoUrl?: string | null;
    syncControlId?: boolean;
  };
  /** Morador/proprietário: unidade fixa, sem escolher outra unidade. */
  lockUnitSelection?: boolean;
}

export function VisitorAuthorizationForm({
  condoSlug,
  mode,
  units,
  condominiumNamesById,
  accessDevices = [],
  defaultAccessDeviceIds = [],
  defaultValues,
  lockUnitSelection = false,
}: VisitorAuthorizationFormProps) {
  const action =
    mode === "create" ? createVisitorAuthorizationAction : updateVisitorAuthorizationAction;
  const [state, formAction, pending] = useActionState(action, {});
  const [guestType, setGuestType] = useState(defaultValues.guest_type);
  const [syncControlId, setSyncControlId] = useState(defaultValues.syncControlId ?? false);

  if (units.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Nenhuma unidade disponível para autorização neste condomínio.
      </div>
    );
  }

  const singleUnit = units.length === 1 ? units[0] : null;
  const resolvedUnitId = defaultValues.unit_id || singleUnit?.id || "";
  const unitLocked = lockUnitSelection && singleUnit !== null;

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      {mode === "edit" && defaultValues.authorizationId && (
        <>
          <input type="hidden" name="authorization_id" value={defaultValues.authorizationId} />
          <input type="hidden" name="existing_photo_url" value={defaultValues.photoUrl ?? ""} />
        </>
      )}

      <FormAlert error={state.error} success={state.success} />

      <PhotoField label="Foto do visitante" currentPhotoUrl={defaultValues.photoUrl} />

      <div className="space-y-2">
        <Label htmlFor="unit_id">Unidade</Label>
        {unitLocked ? (
          <>
            <input type="hidden" name="unit_id" value={singleUnit.id} />
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
              {formatUnitOptionLabel(singleUnit, condominiumNamesById)}
            </p>
            <p className="text-xs text-muted-foreground">
              Visitas só podem ser autorizadas para a sua unidade.
            </p>
          </>
        ) : (
          <select
            id="unit_id"
            name="unit_id"
            required
            defaultValue={resolvedUnitId}
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
        )}
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

      {accessDevices.length > 0 && (
        <div className="space-y-3 rounded-md border p-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="sync_controlid"
              value="1"
              checked={syncControlId}
              onChange={(event) => setSyncControlId(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Liberar nos ControlIDs</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Após aprovação do síndico, o visitante poderá fazer check-in e sincronizar nos equipamentos
                selecionados. No check-out ou ao fim do período, o cadastro facial será removido.
              </span>
            </span>
          </label>
          {syncControlId && (
            <ResidentAccessDeviceFields
              devices={accessDevices}
              defaultSelectedIds={defaultAccessDeviceIds}
            />
          )}
        </div>
      )}

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
