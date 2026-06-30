"use client";

import { useActionState } from "react";
import { syncResidentAccessAction } from "@/lib/actions/access-sync";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

interface ResidentAccessSyncButtonProps {
  condoSlug: string;
  residentId: string;
  hasAccessGrants: boolean;
}

export function ResidentAccessSyncButton({
  condoSlug,
  residentId,
  hasAccessGrants,
}: ResidentAccessSyncButtonProps) {
  const [state, formAction, pending] = useActionState(syncResidentAccessAction, {});

  if (!hasAccessGrants) {
    return null;
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="resident_id" value={residentId} />
      <FormAlert error={state.error} success={state.success} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Sincronizando..." : "Sincronizar ControlID agora"}
      </Button>
    </form>
  );
}
