"use client";

import { useActionState } from "react";
import { updateDoormanNotesAction } from "@/lib/actions/visitor-authorizations";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface DoormanNotesFormProps {
  condoSlug: string;
  authorizationId: string;
  defaultNotes: string | null;
}

export function DoormanNotesForm({
  condoSlug,
  authorizationId,
  defaultNotes,
}: DoormanNotesFormProps) {
  const [state, formAction, pending] = useActionState(updateDoormanNotesAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="authorization_id" value={authorizationId} />

      <FormAlert error={state.error} success={state.success} />

      <div className="space-y-2">
        <Label htmlFor="doorman_notes">Notas da portaria</Label>
        <textarea
          id="doorman_notes"
          name="doorman_notes"
          rows={4}
          defaultValue={defaultNotes ?? ""}
          placeholder="Registre orientações ou ocorrências na portaria..."
          className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar notas"}
      </Button>
    </form>
  );
}
