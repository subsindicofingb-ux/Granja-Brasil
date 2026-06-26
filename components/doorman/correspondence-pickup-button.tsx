"use client";

import { useActionState } from "react";
import { markCorrespondencePickedUpAction } from "@/lib/actions/correspondence";
import { Button } from "@/components/ui/button";

interface CorrespondencePickupButtonProps {
  condoSlug: string;
  noticeId: string;
}

export function CorrespondencePickupButton({ condoSlug, noticeId }: CorrespondencePickupButtonProps) {
  const [state, formAction, pending] = useActionState(markCorrespondencePickedUpAction, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="notice_id" value={noticeId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Salvando..." : "Marcar como retirada"}
      </Button>
      {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
