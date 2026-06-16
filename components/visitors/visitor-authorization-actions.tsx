"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  approveVisitorAuthorizationAction,
  cancelVisitorAuthorizationAction,
  rejectVisitorAuthorizationAction,
} from "@/lib/actions/visitor-authorizations";
import { VISITOR_AUTHORIZATION_STATUS } from "@/lib/constants";
import type { VisitorAuthorizationWithDetails } from "@/lib/visitor-authorizations/types";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

interface VisitorAuthorizationActionsProps {
  condoSlug: string;
  authorization: VisitorAuthorizationWithDetails;
  canApprove: boolean;
  canCancel: boolean;
}

export function VisitorAuthorizationActions({
  condoSlug,
  authorization,
  canApprove,
  canCancel,
}: VisitorAuthorizationActionsProps) {
  const [approveState, approveAction, approving] = useActionState(
    approveVisitorAuthorizationAction,
    {},
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectVisitorAuthorizationAction,
    {},
  );
  const [cancelState, cancelAction, cancelling] = useActionState(
    cancelVisitorAuthorizationAction,
    {},
  );

  const isPending = authorization.status === VISITOR_AUTHORIZATION_STATUS.PENDING;
  const canCancelStatus =
    authorization.status === VISITOR_AUTHORIZATION_STATUS.PENDING ||
    authorization.status === VISITOR_AUTHORIZATION_STATUS.APPROVED;

  const showApprove = canApprove && isPending;
  const showReject = canApprove && isPending;
  const showCancel = canCancel && canCancelStatus;

  if (!showApprove && !showReject && !showCancel) {
    return (
      <Button variant="ghost" asChild>
        <Link href={`/app/${condoSlug}/visitors`}>Voltar</Link>
      </Button>
    );
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
            <input type="hidden" name="authorization_id" value={authorization.id} />
            <Button type="submit" disabled={approving || rejecting || cancelling}>
              {approving ? "Aprovando..." : "Aprovar"}
            </Button>
          </form>
        )}

        {showReject && (
          <form action={rejectAction}>
            <input type="hidden" name="condo_slug" value={condoSlug} />
            <input type="hidden" name="authorization_id" value={authorization.id} />
            <Button type="submit" variant="outline" disabled={approving || rejecting || cancelling}>
              {rejecting ? "Rejeitando..." : "Rejeitar"}
            </Button>
          </form>
        )}

        {showCancel && (
          <form action={cancelAction}>
            <input type="hidden" name="condo_slug" value={condoSlug} />
            <input type="hidden" name="authorization_id" value={authorization.id} />
            <Button
              type="submit"
              variant="destructive"
              disabled={approving || rejecting || cancelling}
            >
              {cancelling ? "Cancelando..." : "Cancelar autorização"}
            </Button>
          </form>
        )}

        <Button variant="ghost" asChild>
          <Link href={`/app/${condoSlug}/visitors`}>Voltar</Link>
        </Button>
      </div>
    </div>
  );
}
