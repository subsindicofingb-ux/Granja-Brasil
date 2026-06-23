"use client";

import { useActionState } from "react";
import { deleteResidentAction } from "@/lib/actions/residents";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

interface ResidentDeleteButtonProps {
  condoSlug: string;
  residentId: string;
  residentName: string;
}

export function ResidentDeleteButton({
  condoSlug,
  residentId,
  residentName,
}: ResidentDeleteButtonProps) {
  const [state, formAction, pending] = useActionState(deleteResidentAction, {});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `Excluir o morador "${residentName}"? Esta ação não pode ser desfeita.`,
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="resident_id" value={residentId} />

      <FormAlert error={state.error} />

      <div>
        <p className="text-sm font-medium text-destructive">Zona de perigo</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Remove o cadastro do morador. O vínculo de acesso ao app, se existir, permanece em
          Configurações.
        </p>
      </div>

      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Excluindo..." : "Excluir morador"}
      </Button>
    </form>
  );
}
