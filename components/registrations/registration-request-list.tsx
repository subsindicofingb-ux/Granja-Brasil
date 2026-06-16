"use client";

import { useActionState } from "react";
import { reviewRegistrationRequestAction } from "@/lib/actions/registration-requests";
import {
  getRegistrationRequestStatusBadgeClass,
  REGISTRATION_REQUEST_STATUS_LABELS,
  REGISTRATION_UNIT_KIND_LABELS,
} from "@/lib/registrations/labels";
import type { RegistrationRequestRecord } from "@/lib/registrations/types";
import { getResidentTypeLabel, formatUnitWithTower } from "@/lib/residents/labels";
import type { UnitWithTower } from "@/lib/services/units";
import { FormAlert } from "@/components/shared/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/utils";

interface RegistrationRequestListProps {
  condoSlug: string;
  requests: RegistrationRequestRecord[];
  units: UnitWithTower[];
}

function ReviewForm({
  condoSlug,
  request,
  units,
}: {
  condoSlug: string;
  request: RegistrationRequestRecord;
  units: UnitWithTower[];
}) {
  const [state, formAction, pending] = useActionState(reviewRegistrationRequestAction, {});

  return (
    <form action={formAction} className="space-y-3 border-t pt-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="request_id" value={request.id} />

      <FormAlert error={state.error} success={state.success} />

      {request.unit_kind === "apartment" && units.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor={`unit_id_${request.id}`}>Vincular à unidade existente (opcional)</Label>
          <select
            id={`unit_id_${request.id}`}
            name="unit_id"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            defaultValue=""
          >
            <option value="">Criar ou localizar automaticamente</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {formatUnitWithTower(unit)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`review_notes_${request.id}`}>Observações (opcional)</Label>
        <Input
          id={`review_notes_${request.id}`}
          name="review_notes"
          placeholder="Motivo da decisão ou instruções"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="action" value="approve" disabled={pending}>
          {pending ? "Processando..." : "Aprovar cadastro"}
        </Button>
        <Button type="submit" name="action" value="reject" variant="outline" disabled={pending}>
          Recusar
        </Button>
      </div>
    </form>
  );
}

export function RegistrationRequestList({ condoSlug, requests, units }: RegistrationRequestListProps) {
  if (requests.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        Nenhuma solicitação de cadastro no momento.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <div key={request.id} className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">{request.full_name}</p>
              <p className="text-sm text-muted-foreground">{request.email}</p>
            </div>
            <Badge className={getRegistrationRequestStatusBadgeClass(request.status)}>
              {REGISTRATION_REQUEST_STATUS_LABELS[request.status]}
            </Badge>
          </div>

          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Tipo</dt>
              <dd>{getResidentTypeLabel(request.resident_type)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Moradia</dt>
              <dd>
                {REGISTRATION_UNIT_KIND_LABELS[request.unit_kind]} · {request.unit_number}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Solicitado em</dt>
              <dd>{formatDateTime(request.created_at)}</dd>
            </div>
            {request.reviewed_at && (
              <div>
                <dt className="text-muted-foreground">Analisado em</dt>
                <dd>{formatDateTime(request.reviewed_at)}</dd>
              </div>
            )}
          </dl>

          {request.review_notes && (
            <p className="mt-3 text-sm text-muted-foreground">
              Observação: {request.review_notes}
            </p>
          )}

          {request.status === "pending" && (
            <ReviewForm condoSlug={condoSlug} request={request} units={units} />
          )}
        </div>
      ))}
    </div>
  );
}
