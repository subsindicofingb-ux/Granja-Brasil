"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { createDoormanRegistrationRequestAction } from "@/lib/actions/doorman-registrations";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import { RESIDENT_TYPE_OPTIONS, formatUnitOptionLabel } from "@/lib/residents/labels";
import type { UnitWithTower } from "@/lib/services/units";
import { DoormanAccessDeviceSelector } from "@/components/doorman/doorman-access-device-selector";
import { ResidentAccessDeviceFields } from "@/components/access-devices/resident-access-device-fields";
import type { AccessDeviceOption } from "@/lib/access-devices/grant-types";
import { suggestDefaultAccessDeviceIdsFromOptions } from "@/lib/access-devices/suggested-grants";
import { FormAlert } from "@/components/shared/feedback";
import { PasswordRequirementsHint } from "@/components/auth/password-requirements-hint";
import { PhotoField } from "@/components/shared/photo-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DoormanRegistrationRequestFormProps {
  condoSlug: string;
  isBlockSource?: boolean;
  condominiums?: Array<{ id: string; name: string; slug: string }>;
  units: UnitWithTower[];
  condominiumNamesById?: Record<string, string>;
  accessDevicesByCondominiumId?: Record<string, AccessDeviceOption[]>;
  accessDevices?: AccessDeviceOption[];
}

export function DoormanRegistrationRequestForm({
  condoSlug,
  isBlockSource = false,
  condominiums = [],
  units,
  condominiumNamesById = {},
  accessDevicesByCondominiumId = {},
  accessDevices = [],
}: DoormanRegistrationRequestFormProps) {
  const [state, formAction, pending] = useActionState(createDoormanRegistrationRequestAction, {});
  const [selectedCondominiumId, setSelectedCondominiumId] = useState(
    isBlockSource ? (condominiums[0]?.id ?? "") : "",
  );

  const filteredUnits = useMemo(() => {
    if (!isBlockSource) {
      return units;
    }

    if (!selectedCondominiumId) {
      return [];
    }

    return units.filter((unit) => unit.tower.condominium_id === selectedCondominiumId);
  }, [isBlockSource, selectedCondominiumId, units]);

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />

      <FormAlert error={state.error} success={state.success} />

      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        O morador será cadastrado na hora. Nos locais de acesso marcados, o ControlID será sincronizado
        automaticamente. O síndico receberá um e-mail informativo.
      </p>

      {isBlockSource && (
        <div className="space-y-2">
          <Label htmlFor="target_condominium_id">Condomínio</Label>
          <select
            id="target_condominium_id"
            name="target_condominium_id"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={selectedCondominiumId}
            onChange={(event) => setSelectedCondominiumId(event.target.value)}
            required
          >
            {condominiums.map((condominium) => (
              <option key={condominium.id} value={condominium.id}>
                {formatCondominiumDisplayName(condominium.name, condominium.slug)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="unit_id">Unidade</Label>
        <select
          id="unit_id"
          name="unit_id"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          defaultValue=""
          required
        >
          <option value="" disabled>
            Selecione a unidade
          </option>
          {filteredUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {formatUnitOptionLabel(unit, condominiumNamesById)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="full_name">Nome completo</Label>
        <Input id="full_name" name="full_name" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone (opcional)</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
      </div>

      <div className="space-y-4 rounded-md border bg-muted/30 p-4">
        <div>
          <p className="text-sm font-medium">Senha de acesso ao app</p>
          <p className="text-xs text-muted-foreground">
            O morador define agora a senha que usará para entrar no aplicativo quando receber o e-mail
            de boas-vindas.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password_confirm">Confirmar senha</Label>
            <Input
              id="password_confirm"
              name="password_confirm"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
        </div>
        <PasswordRequirementsHint />
      </div>

      <div className="space-y-2">
        <Label htmlFor="resident_type">Tipo de morador</Label>
        <select
          id="resident_type"
          name="resident_type"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          defaultValue="owner"
          required
        >
          {RESIDENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <PhotoField
        label="Foto do morador"
        inputName="photo"
        enableCamera
      />

      {isBlockSource ? (
        <DoormanAccessDeviceSelector
          devicesByCondominiumId={accessDevicesByCondominiumId}
          selectedCondominiumId={selectedCondominiumId}
        />
      ) : (
        <ResidentAccessDeviceFields
          devices={accessDevices}
          defaultSelectedIds={suggestDefaultAccessDeviceIdsFromOptions(accessDevices)}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Cadastrando..." : "Cadastrar e liberar acesso"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
