"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createResidentAction, updateResidentAction } from "@/lib/actions/residents";
import {
  RESIDENT_TYPE_OPTIONS,
  formatUnitOptionLabel,
  formatUnitWithTower,
} from "@/lib/residents/labels";
import type { ResidentType } from "@/types";
import type { UnitWithTower } from "@/lib/services/units";
import { FormAlert } from "@/components/shared/feedback";
import { PhotoField } from "@/components/shared/photo-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ResidentFormProps {
  condoSlug: string;
  units: UnitWithTower[];
  mode: "create" | "edit";
  condominiumNamesById?: Record<string, string>;
  defaultValues?: {
    residentId?: string;
    unitId?: string;
    fullName?: string;
    email?: string | null;
    phone?: string | null;
    photoUrl?: string | null;
    type?: ResidentType;
  };
}

export function ResidentForm({
  condoSlug,
  units,
  mode,
  condominiumNamesById,
  defaultValues,
}: ResidentFormProps) {
  const action = mode === "create" ? createResidentAction : updateResidentAction;
  const [state, formAction, pending] = useActionState(action, {});

  if (units.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Cadastre unidades antes de registrar moradores.{" "}
        <Link href={`/app/${condoSlug}/units/new`} className="font-medium underline">
          Nova unidade
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      {mode === "edit" && defaultValues?.residentId && (
        <>
          <input type="hidden" name="resident_id" value={defaultValues.residentId} />
          <input type="hidden" name="existing_photo_url" value={defaultValues.photoUrl ?? ""} />
        </>
      )}

      <FormAlert error={state.error} success={state.success} />

      <PhotoField label="Foto do morador" currentPhotoUrl={defaultValues?.photoUrl} />

      <div className="space-y-2">
        <Label htmlFor="full_name">Nome completo</Label>
        <Input
          id="full_name"
          name="full_name"
          placeholder="Ex: Carlos Pereira"
          defaultValue={defaultValues?.fullName}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="unit_id">Unidade</Label>
        <select
          id="unit_id"
          name="unit_id"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          defaultValue={defaultValues?.unitId ?? ""}
          required
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
        <Label htmlFor="type">Tipo de morador</Label>
        <select
          id="type"
          name="type"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          defaultValue={defaultValues?.type ?? "owner"}
          required
        >
          {RESIDENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail (opcional)</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="morador@email.com"
          defaultValue={defaultValues?.email ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefone (opcional)</Label>
        <Input
          id="phone"
          name="phone"
          placeholder="(11) 99999-0000"
          defaultValue={defaultValues?.phone ?? ""}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : mode === "create" ? "Criar morador" : "Salvar alterações"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/residents`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
