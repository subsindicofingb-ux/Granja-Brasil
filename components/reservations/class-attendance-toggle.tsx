"use client";

import { useActionState } from "react";
import { setClassAttendanceAction } from "@/lib/actions/reservations";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/shared/feedback";

interface ClassAttendanceToggleProps {
  condoSlug: string;
  reservationId: string;
  attended: boolean;
}

export function ClassAttendanceToggle({
  condoSlug,
  reservationId,
  attended,
}: ClassAttendanceToggleProps) {
  const [state, formAction, pending] = useActionState(setClassAttendanceAction, {});

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="reservation_id" value={reservationId} />
      <input type="hidden" name="attended" value={attended ? "false" : "true"} />
      <Button
        type="submit"
        size="sm"
        variant={attended ? "secondary" : "outline"}
        disabled={pending}
        className={
          attended
            ? "border-green-200 bg-green-50 text-green-800 hover:bg-green-100"
            : undefined
        }
      >
        {pending ? "Salvando..." : attended ? "Presente" : "Marcar presença"}
      </Button>
      <FormAlert error={state.error} success={state.success} />
    </form>
  );
}
