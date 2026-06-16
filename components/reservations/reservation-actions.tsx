"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  approveReservationAction,
  cancelReservationAction,
  rejectReservationAction,
} from "@/lib/actions/reservations";
import type { ReservationWithDetails } from "@/lib/reservations/types";
import {
  canApproveReservation,
  canCancelReservation,
  canRejectReservation,
} from "@/lib/reservations/validate-booking";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

interface ReservationActionsProps {
  condoSlug: string;
  reservation: ReservationWithDetails;
  canApprove: boolean;
  canCancel: boolean;
}

export function ReservationActions({
  condoSlug,
  reservation,
  canApprove,
  canCancel,
}: ReservationActionsProps) {
  const [approveState, approveAction, approving] = useActionState(approveReservationAction, {});
  const [rejectState, rejectAction, rejecting] = useActionState(rejectReservationAction, {});
  const [cancelState, cancelAction, cancelling] = useActionState(cancelReservationAction, {});

  const showApprove = canApprove && canApproveReservation(reservation.status);
  const showReject = canApprove && canRejectReservation(reservation.status);
  const showCancel = canCancel && canCancelReservation(reservation.status);

  if (!showApprove && !showReject && !showCancel) {
    return null;
  }

  return (
    <div className="space-y-4">
      <FormAlert
        error={approveState.error ?? rejectState.error ?? cancelState.error}
        success={approveState.success ?? rejectState.success ?? cancelState.success}
      />

      <div className="flex flex-wrap gap-2">
        {showApprove && (
          <form action={approveAction}>
            <input type="hidden" name="condo_slug" value={condoSlug} />
            <input type="hidden" name="reservation_id" value={reservation.id} />
            <Button type="submit" disabled={approving || rejecting || cancelling}>
              {approving ? "Aprovando..." : "Aprovar"}
            </Button>
          </form>
        )}

        {showReject && (
          <form action={rejectAction}>
            <input type="hidden" name="condo_slug" value={condoSlug} />
            <input type="hidden" name="reservation_id" value={reservation.id} />
            <Button
              type="submit"
              variant="outline"
              disabled={approving || rejecting || cancelling}
            >
              {rejecting ? "Rejeitando..." : "Rejeitar"}
            </Button>
          </form>
        )}

        {showCancel && (
          <form action={cancelAction}>
            <input type="hidden" name="condo_slug" value={condoSlug} />
            <input type="hidden" name="reservation_id" value={reservation.id} />
            <Button
              type="submit"
              variant="destructive"
              disabled={approving || rejecting || cancelling}
            >
              {cancelling ? "Cancelando..." : "Cancelar reserva"}
            </Button>
          </form>
        )}

        <Button variant="ghost" asChild>
          <Link href={`/app/${condoSlug}/reservations`}>Voltar</Link>
        </Button>
      </div>
    </div>
  );
}
