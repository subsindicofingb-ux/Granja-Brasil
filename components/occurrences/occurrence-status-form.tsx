"use client";

import { useActionState } from "react";
import { updateOccurrenceStatusAction } from "@/lib/actions/occurrences";
import { OCCURRENCE_STATUS } from "@/lib/constants";
import { OCCURRENCE_STATUS_LABELS } from "@/lib/occurrences/labels";
import type { OccurrenceStatus } from "@/lib/occurrences/types";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface OccurrenceStatusFormProps {
  condoSlug: string;
  occurrenceId: string;
  currentStatus: OccurrenceStatus;
  currentResponse: string | null;
  currentNotes: string | null;
}

export function OccurrenceStatusForm({
  condoSlug,
  occurrenceId,
  currentStatus,
  currentResponse,
  currentNotes,
}: OccurrenceStatusFormProps) {
  const [state, formAction, pending] = useActionState(updateOccurrenceStatusAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="occurrence_id" value={occurrenceId} />
      <FormAlert error={state.error} success={state.success} />

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          required
          defaultValue={currentStatus}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {Object.values(OCCURRENCE_STATUS).map((status) => (
            <option key={status} value={status}>
              {OCCURRENCE_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="response_text">Resposta ao reclamante</Label>
        <textarea
          id="response_text"
          name="response_text"
          rows={4}
          maxLength={2000}
          defaultValue={currentResponse ?? ""}
          placeholder="Texto enviado ao morador por e-mail junto com a mudança de status"
          className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="internal_notes">Observações internas (opcional)</Label>
        <textarea
          id="internal_notes"
          name="internal_notes"
          rows={3}
          maxLength={2000}
          defaultValue={currentNotes ?? ""}
          placeholder="Somente para síndico/portaria/administração"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Atualizar e notificar reclamante"}
      </Button>
    </form>
  );
}
