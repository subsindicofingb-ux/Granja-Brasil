"use client";

import { useActionState } from "react";
import { reviewVehicleAction } from "@/lib/actions/vehicles";
import { VEHICLE_STATUS } from "@/lib/constants";
import type { VehicleWithUnit } from "@/lib/services/vehicles";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VehicleReviewActionsProps {
  condoSlug: string;
  vehicle: VehicleWithUnit;
}

export function VehicleReviewActions({ condoSlug, vehicle }: VehicleReviewActionsProps) {
  const [state, formAction, pending] = useActionState(reviewVehicleAction, {});

  if (vehicle.status !== VEHICLE_STATUS.PENDING) {
    return null;
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="vehicle_id" value={vehicle.id} />

      <FormAlert error={state.error} success={state.success} />

      <p className="text-sm font-medium text-amber-950">
        Cadastro aguardando validação do síndico.
      </p>

      <div className="space-y-2">
        <Label htmlFor={`vehicle_review_notes_${vehicle.id}`}>Observações (opcional)</Label>
        <Input
          id={`vehicle_review_notes_${vehicle.id}`}
          name="review_notes"
          placeholder="Motivo da decisão"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="action" value="approve" disabled={pending}>
          {pending ? "Processando..." : "Aprovar veículo"}
        </Button>
        <Button type="submit" name="action" value="reject" variant="outline" disabled={pending}>
          Recusar
        </Button>
      </div>
    </form>
  );
}
