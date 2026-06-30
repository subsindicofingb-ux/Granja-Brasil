"use client";

import { useActionState } from "react";
import { createWaterMeterReadingAction } from "@/lib/actions/water-meters";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WaterMeterReadingFormProps {
  condoSlug: string;
  defaultDate: string;
  isBlockSource?: boolean;
  condominiums?: Array<{ id: string; name: string; slug: string }>;
}

export function WaterMeterReadingForm({
  condoSlug,
  defaultDate,
  isBlockSource = false,
  condominiums = [],
}: WaterMeterReadingFormProps) {
  const [state, formAction, pending] = useActionState(createWaterMeterReadingAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />

      <FormAlert error={state.error} success={state.success} />

      {isBlockSource && (
        <div className="space-y-2">
          <Label htmlFor="target_condominium_id">Condomínio</Label>
          <select
            id="target_condominium_id"
            name="target_condominium_id"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            defaultValue={condominiums[0]?.id ?? ""}
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
            type="text"
            inputMode="decimal"
            placeholder="1234,567"
            autoComplete="off"
            required
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Informe a leitura com vírgula para os decimais (ex.: 1234,567). O consumo diário é calculado
        pela diferença em relação à leitura anterior. Se registrar novamente na mesma data, a
        medição será atualizada.
      </p>

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Registrar leitura"}
      </Button>
    </form>
  );
}
