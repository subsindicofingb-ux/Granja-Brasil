"use client";

import { useActionState } from "react";
import {
  checkInVisitorAuthorizationAction,
  checkOutVisitorAuthorizationAction,
} from "@/lib/actions/visitor-authorizations";
import { VISITOR_AUTHORIZATION_STATUS } from "@/lib/constants";
import type { VisitorAuthorizationWithDetails } from "@/lib/visitor-authorizations/types";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

interface VisitorAccessControlProps {
  condoSlug: string;
  authorization: VisitorAuthorizationWithDetails;
  canManage: boolean;
}

export function VisitorAccessControl({
  condoSlug,
  authorization,
  canManage,
}: VisitorAccessControlProps) {
  const [checkInState, checkInAction, checkingIn] = useActionState(
    checkInVisitorAuthorizationAction,
    {},
  );
  const [checkOutState, checkOutAction, checkingOut] = useActionState(
    checkOutVisitorAuthorizationAction,
    {},
  );

  const isApproved = authorization.status === VISITOR_AUTHORIZATION_STATUS.APPROVED;
  const canCheckIn = canManage && isApproved && !authorization.checked_in_at && !authorization.checked_out_at;
  const canCheckOut =
    canManage && isApproved && authorization.checked_in_at && !authorization.checked_out_at;

  if (!isApproved && !authorization.checked_in_at && !authorization.checked_out_at) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Controle de acesso</h3>

      <FormAlert error={checkInState.error ?? checkOutState.error} success={checkInState.success ?? checkOutState.success} />

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            readOnly
            checked={Boolean(authorization.checked_in_at)}
            className="h-4 w-4"
          />
          <span>
            Check-in
            {authorization.checked_in_at
              ? ` · ${formatDateTime(authorization.checked_in_at)}`
              : " · pendente"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            readOnly
            checked={Boolean(authorization.checked_out_at)}
            className="h-4 w-4"
          />
          <span>
            Check-out
            {authorization.checked_out_at
              ? ` · ${formatDateTime(authorization.checked_out_at)}`
              : " · pendente"}
          </span>
        </div>
      </div>

      {authorization.sync_controlid && (
        <p className="text-xs text-muted-foreground">
          ControlID: ao fazer check-in o visitante é sincronizado nos equipamentos. No check-out ou ao
          atingir a data fim, o cadastro facial é removido automaticamente.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {canCheckIn && (
          <form action={checkInAction}>
            <input type="hidden" name="condo_slug" value={condoSlug} />
            <input type="hidden" name="authorization_id" value={authorization.id} />
            <Button type="submit" size="sm" disabled={checkingIn || checkingOut}>
              {checkingIn ? "Registrando..." : "Registrar check-in"}
            </Button>
          </form>
        )}
        {canCheckOut && (
          <form action={checkOutAction}>
            <input type="hidden" name="condo_slug" value={condoSlug} />
            <input type="hidden" name="authorization_id" value={authorization.id} />
            <Button type="submit" size="sm" variant="outline" disabled={checkingIn || checkingOut}>
              {checkingOut ? "Registrando..." : "Registrar check-out"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
