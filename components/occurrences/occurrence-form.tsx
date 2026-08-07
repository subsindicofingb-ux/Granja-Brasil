"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createOccurrenceAction } from "@/lib/actions/occurrences";
import { OCCURRENCE_CATEGORY_OPTIONS } from "@/lib/occurrences/labels";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OccurrenceFormProps {
  condoSlug: string;
  units: Array<{ id: string; label: string }>;
  defaultOccurredAt: string;
}

export function OccurrenceForm({
  condoSlug,
  units,
  defaultOccurredAt,
}: OccurrenceFormProps) {
  const [state, formAction, pending] = useActionState(createOccurrenceAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <FormAlert error={state.error} success={state.success} />

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
        <Label htmlFor="location_text">Local (opcional)</Label>
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
