"use client";

import { useActionState } from "react";
import { createWaterMeterReadingAction } from "@/lib/actions/water-meters";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WaterMeterReadingFormProps {
  condoSlug: string;
  defaultDate: string;
}

export function WaterMeterReadingForm({
  condoSlug,
  defaultDate,
}: WaterMeterReadingFormProps) {
  const [state, formAction, pending] = useActionState(createWaterMeterReadingAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />

      <FormAlert error={state.error} success={state.success} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reading_date">Data da leitura</Label>
          <Input
            id="reading_date"
            name="reading_date"
            type="date"
            defaultValue={defaultDate}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reading_value">Leitura acumulada (m³)</Label>
          <Input
            id="reading_value"
            name="reading_value"
            type="number"
            step="0.001"
            min="0"
            required
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        O consumo diário é calculado pela diferença em relação à leitura anterior. Se ultrapassar
        10% da média recente, portaria e síndico serão alertados.
      </p>

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Registrar leitura"}
      </Button>
    </form>
  );
}
