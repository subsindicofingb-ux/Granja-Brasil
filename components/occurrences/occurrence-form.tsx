"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createOccurrenceAction } from "@/lib/actions/occurrences";
import { BRAND_NAME } from "@/lib/brand";
import { OCCURRENCE_CATEGORY_OPTIONS } from "@/lib/occurrences/labels";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OccurrenceFormProps {
  condoSlug: string;
  units: Array<{ id: string; label: string }>;
  defaultOccurredAt: string;
  showGranjaDestination: boolean;
  buildingLabel: string;
}

export function OccurrenceForm({
  condoSlug,
  units,
  defaultOccurredAt,
  showGranjaDestination,
  buildingLabel,
}: OccurrenceFormProps) {
  const [state, formAction, pending] = useActionState(createOccurrenceAction, {});
  const [destination, setDestination] = useState<"building" | "granja">("building");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <FormAlert error={state.error} success={state.success} />

      {showGranjaDestination && (
        <div className="space-y-2">
          <Label htmlFor="destination">Local / destino</Label>
          <select
            id="destination"
            name="destination"
            required
            value={destination}
            onChange={(event) =>
              setDestination(event.target.value === "granja" ? "granja" : "building")
            }
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="building">{buildingLabel}</option>
            <option value="granja">{BRAND_NAME}</option>
          </select>
          <p className="text-xs text-muted-foreground">
            {destination === "granja"
              ? `A notificação irá para a administração da ${BRAND_NAME}, não para o síndico do prédio.`
              : "A notificação irá para o síndico/administração deste condomínio."}
          </p>
        </div>
      )}

      {!showGranjaDestination && <input type="hidden" name="destination" value="building" />}

      <div className="space-y-2">
        <Label htmlFor="category">Tipo</Label>
        <select
          id="category"
          name="category"
          required
          defaultValue="report"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {OCCURRENCE_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required maxLength={160} placeholder="Resumo da ocorrência" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          maxLength={5000}
          placeholder="Descreva o relato, reclamação ou ocorrência com detalhes relevantes."
          className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location_text">Detalhe do local (opcional)</Label>
        <Input
          id="location_text"
          name="location_text"
          maxLength={200}
          placeholder="Ex.: Elevador Torre A, Hall, Garagem"
        />
      </div>

      {units.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="unit_id">Unidade relacionada (opcional)</Label>
          <select
            id="unit_id"
            name="unit_id"
            defaultValue=""
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Não vinculada</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="occurred_at">Data e hora</Label>
        <Input
          id="occurred_at"
          name="occurred_at"
          type="datetime-local"
          required
          defaultValue={defaultOccurredAt}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Registrando..." : "Registrar ocorrência"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/occurrences`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
