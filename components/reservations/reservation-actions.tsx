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
  canReject: boolean;
  canCancel: boolean;
}

export function ReservationActions({
  condoSlug,
  reservation,
  canApprove,
  canReject,
  canCancel,
}: ReservationActionsProps) {
  const [approveState, approveAction, approving] = useActionState(approveReservationAction, {});
  const [rejectState, rejectAction, rejecting] = useActionState(rejectReservationAction, {});
  const [cancelState, cancelAction, cancelling] = useActionState(cancelReservationAction, {});

  const showApprove = canApprove && canApproveReservation(reservation.status);
  const showReject = canReject && canRejectReservation(reservation.status);
  const showCancel = canCancel && canCancelReservation(reservation.status);

  if (!showApprove && !showReject && !showCancel) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="lg" asChild>
          <Link href={`/app/${condoSlug}/reservations`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormAlert
        error={approveState.error ?? rejectState.error ?? cancelState.error}
        success={approveState.success ?? rejectState.success ?? cancelState.success}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {showApprove && (
          <form action={approveAction} className="w-full sm:w-auto">
            <input type="hidden" name="condo_slug" value={condoSlug} />
            <input type="hidden" name="reservation_id" value={reservation.id} />
            <Button
              type="submit"
              size="lg"
              className="min-h-12 w-full text-base sm:w-auto"
              disabled={approving || rejecting || cancelling}
            >
              {approving ? "Autorizando..." : "Autorizar"}
            </Button>
          </form>
        )}

        {showReject && (
          <form action={rejectAction} className="w-full sm:w-auto">
            <input type="hidden" name="condo_slug" value={condoSlug} />
            <input type="hidden" name="reservation_id" value={reservation.id} />
            <Button
              type="submit"
              size="lg"
              variant="outline"
              className="min-h-12 w-full text-base sm:w-auto"
              disabled={approving || rejecting || cancelling}
            >
              {rejecting ? "Rejeitando..." : "Rejeitar"}
            </Button>
          </form>
        )}

        {showCancel && (
          <form action={cancelAction} className="w-full sm:w-auto">
            <input type="hidden" name="condo_slug" value={condoSlug} />
            <input type="hidden" name="reservation_id" value={reservation.id} />
            <Button
              type="submit"
              size="lg"
              variant="destructive"
              className="min-h-12 w-full text-base sm:w-auto"
              disabled={approving || rejecting || cancelling}
            >
              {cancelling ? "Cancelando..." : "Cancelar reserva"}
            </Button>
          </form>
        )}

        <Button variant="outline" size="lg" className="min-h-12 text-base" asChild>
          <Link href={`/app/${condoSlug}/reservations`}>Voltar</Link>
        </Button>
      </div>
    </div>
  );
}
