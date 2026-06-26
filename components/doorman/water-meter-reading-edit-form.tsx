"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { updateWaterMeterReadingAction } from "@/lib/actions/water-meters";
import { formatWaterMeterReadingValue } from "@/lib/water-meters/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WaterMeterReadingEditFormProps {
  condoSlug: string;
  readingId: string;
  readingValue: number;
}

export function WaterMeterReadingEditForm({
  condoSlug,
  readingId,
  readingValue,
}: WaterMeterReadingEditFormProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateWaterMeterReadingAction, {});

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state.success, router]);

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Editar
      </Button>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="reading_id" value={readingId} />

      <div className="space-y-2">
        <Label htmlFor={`reading_value-${readingId}`}>Corrigir leitura acumulada (m³)</Label>
        <Input
          id={`reading_value-${readingId}`}
          name="reading_value"
          type="text"
          inputMode="decimal"
          defaultValue={formatWaterMeterReadingValue(readingValue)}
          autoComplete="off"
          required
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando..." : "Salvar correção"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancelar
        </Button>
      </div>

      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.success && <p className="text-xs text-emerald-700">{state.success}</p>}
    </form>
  );
}
