"use client";

import { useActionState } from "react";
import { deleteCommonAreaAction } from "@/lib/actions/common-areas";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

interface CommonAreaDeleteButtonProps {
  condoSlug: string;
  areaId: string;
  areaName: string;
}

export function CommonAreaDeleteButton({
  condoSlug,
  areaId,
  areaName,
}: CommonAreaDeleteButtonProps) {
  const [state, formAction, pending] = useActionState(deleteCommonAreaAction, {});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `Excluir o espaço "${areaName}"? As reservas deste espaço também serão removidas. Esta ação não pode ser desfeita.`,
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-3 border-t pt-6">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="area_id" value={areaId} />

      <FormAlert error={state.error} />

      <div>
        <p className="text-sm font-medium text-destructive">Zona de perigo</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Remove o espaço comum e o histórico de reservas vinculado a ele.
        </p>
      </div>

      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Excluindo..." : "Excluir espaço"}
      </Button>
    </form>
  );
}
