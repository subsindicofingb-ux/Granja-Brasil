"use client";

import { useActionState } from "react";
import { deleteVehicleAction } from "@/lib/actions/vehicles";
import { formatLicensePlate } from "@/lib/vehicles/labels";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

interface VehicleDeleteButtonProps {
  condoSlug: string;
  vehicleId: string;
  vehicleLabel: string;
  licensePlate: string;
}

export function VehicleDeleteButton({
  condoSlug,
  vehicleId,
  vehicleLabel,
  licensePlate,
}: VehicleDeleteButtonProps) {
  const [state, formAction, pending] = useActionState(deleteVehicleAction, {});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `Excluir o veículo "${vehicleLabel}" (${formatLicensePlate(licensePlate)})? Esta ação não pode ser desfeita.`,
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="vehicle_id" value={vehicleId} />

      <FormAlert error={state.error} />

      <div>
        <p className="text-sm font-medium text-destructive">Zona de perigo</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Remove o cadastro do veículo do condomínio.
        </p>
      </div>

      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Excluindo..." : "Excluir veículo"}
      </Button>
    </form>
  );
}
