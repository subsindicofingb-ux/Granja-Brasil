"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createVehicleAction, updateVehicleAction } from "@/lib/actions/vehicles";
import { formatUnitWithTower } from "@/lib/residents/labels";
import type { UnitWithTower } from "@/lib/services/units";
import type { ResidentWithUnit } from "@/lib/services/residents";
import { FormAlert } from "@/components/shared/feedback";
import { PhotoField } from "@/components/shared/photo-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VehicleFormProps {
  condoSlug: string;
  units: UnitWithTower[];
  residents: ResidentWithUnit[];
  mode: "create" | "edit";
  defaultValues?: {
    vehicleId?: string;
    unitId?: string;
    residentId?: string | null;
    brand?: string;
    model?: string;
    color?: string | null;
    licensePlate?: string;
    tagNumber?: string | null;
    photoUrl?: string | null;
  };
}

export function VehicleForm({
  condoSlug,
  units,
  residents,
  mode,
  defaultValues,
}: VehicleFormProps) {
  const action = mode === "create" ? createVehicleAction : updateVehicleAction;
  const [state, formAction, pending] = useActionState(action, {});

  if (units.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Cadastre torres e unidades antes de registrar veículos.{" "}
        <Link href={`/app/${condoSlug}/units/new`} className="font-medium underline">
          Nova unidade
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      {mode === "edit" && defaultValues?.vehicleId && (
        <>
          <input type="hidden" name="vehicle_id" value={defaultValues.vehicleId} />
          <input type="hidden" name="existing_photo_url" value={defaultValues.photoUrl ?? ""} />
        </>
      )}

      <FormAlert error={state.error} success={state.success} />

      <PhotoField label="Foto do veículo" currentPhotoUrl={defaultValues?.photoUrl} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="brand">Marca</Label>
          <Input
            id="brand"
            name="brand"
            placeholder="Ex: Toyota"
            defaultValue={defaultValues?.brand}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">Modelo</Label>
          <Input
            id="model"
            name="model"
            placeholder="Ex: Corolla"
            defaultValue={defaultValues?.model}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="license_plate">Placa</Label>
          <Input
            id="license_plate"
            name="license_plate"
            placeholder="ABC1D23"
            defaultValue={defaultValues?.licensePlate}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tag_number">Número da TAG</Label>
          <Input
            id="tag_number"
            name="tag_number"
            placeholder="Ex: 1234567890"
            defaultValue={defaultValues?.tagNumber ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="color">Cor (opcional)</Label>
        <Input
          id="color"
          name="color"
          placeholder="Ex: Prata"
          defaultValue={defaultValues?.color ?? ""}
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
              {formatUnitWithTower(unit)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="resident_id">Morador vinculado (opcional)</Label>
        <select
          id="resident_id"
          name="resident_id"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          defaultValue={defaultValues?.residentId ?? ""}
        >
          <option value="">Nenhum / não informado</option>
          {residents.map((resident) => (
            <option key={resident.id} value={resident.id}>
              {resident.full_name} · {formatUnitWithTower(resident.unit)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Após escolher a unidade, selecione o morador responsável pelo veículo.
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : mode === "create" ? "Cadastrar veículo" : "Salvar alterações"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/vehicles`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
