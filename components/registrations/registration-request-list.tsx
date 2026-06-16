"use client";

import { useActionState } from "react";
import { reviewRegistrationRequestAction } from "@/lib/actions/registration-requests";
import {
  getRegistrationRequestStatusBadgeClass,
  REGISTRATION_REQUEST_STATUS_LABELS,
} from "@/lib/registrations/labels";
import type { RegistrationRequestRecord } from "@/lib/registrations/types";
import { getResidentTypeLabel } from "@/lib/residents/labels";
import { FormAlert } from "@/components/shared/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/utils";

interface RegistrationRequestListProps {
  condoSlug: string;
  requests: RegistrationRequestRecord[];
}

function formatRequestedUnit(request: RegistrationRequestRecord): string {
  if (request.unit_number) {
    if (request.unit_kind === "house") {
      return `Casa ${request.unit_number}`;
    }

    return `Apto ${request.unit_number}`;
  }

  return "Unidade selecionada";
}

function ReviewForm({ condoSlug, request }: { condoSlug: string; request: RegistrationRequestRecord }) {
  const [state, formAction, pending] = useActionState(reviewRegistrationRequestAction, {});

  return (
    <form action={formAction} className="space-y-3 border-t pt-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="request_id" value={request.id} />

      <FormAlert error={state.error} success={state.success} />

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

export function RegistrationRequestList({ condoSlug, requests }: RegistrationRequestListProps) {
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
              <dt className="text-muted-foreground">Unidade</dt>
              <dd>{formatRequestedUnit(request)}</dd>
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
            <ReviewForm condoSlug={condoSlug} request={request} />
          )}
        </div>
      ))}
    </div>
  );
}
