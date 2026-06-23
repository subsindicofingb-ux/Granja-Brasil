"use client";

import { useActionState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { reviewRegistrationRequestAction } from "@/lib/actions/registration-requests";
import {
  getRegistrationProfileTypeLabel,
  getRegistrationRequestStatusBadgeClass,
  REGISTRATION_REQUEST_STATUS_LABELS,
} from "@/lib/registrations/labels";
import { requiresRegistrationUnit } from "@/lib/registrations/profile-type";
import type { RegistrationRequestRecord } from "@/lib/registrations/types";
import { RESIDENT_TYPE_OPTIONS } from "@/lib/residents/labels";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import { formatRegistrationUnitLabel } from "@/lib/registrations/profile-type";
import { FormAlert } from "@/components/shared/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/utils";

interface RegistrationRequestListProps {
  condoSlug: string;
  requests: RegistrationRequestRecord[];
  showCondominium?: boolean;
}

function formatRequestedUnit(request: RegistrationRequestRecord): string {
  return formatRegistrationUnitLabel({
    profileType: request.profile_type,
    unitNumber: request.unit_number,
    unitKind: request.unit_kind,
    condominiumSlug: request.condominium?.slug,
  });
}

function ReviewForm({ condoSlug, request }: { condoSlug: string; request: RegistrationRequestRecord }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(reviewRegistrationRequestAction, {});
  const requestCondoSlug = request.condominium?.slug ?? condoSlug;
  const showQualification = requiresRegistrationUnit(request.profile_type);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="space-y-3 border-t pt-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="request_condominium_slug" value={requestCondoSlug} />
      <input type="hidden" name="request_id" value={request.id} />

      <FormAlert error={state.error} success={state.success} />

      {showQualification && (
        <div className="space-y-2">
          <Label htmlFor={`resident_type_${request.id}`}>Qualificação do morador</Label>
          <select
            id={`resident_type_${request.id}`}
            name="resident_type"
            defaultValue={request.resident_type}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            required
          >
            {RESIDENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {request.profile_type === "other"
              ? "Defina a qualificação após analisar o pré-cadastro."
              : "Ajuste a qualificação, se necessário, antes de aprovar."}
          </p>
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

export function RegistrationRequestList({
  condoSlug,
  requests,
  showCondominium = false,
}: RegistrationRequestListProps) {
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
            <div className="flex items-start gap-3">
              {request.photo_url ? (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
                  <Image
                    src={request.photo_url}
                    alt={request.full_name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : null}
              <div>
                <p className="font-medium">{request.full_name}</p>
                <p className="text-sm text-muted-foreground">{request.email}</p>
                {request.phone && (
                  <p className="text-sm text-muted-foreground">Celular: {request.phone}</p>
                )}
              </div>
            </div>
            <Badge className={getRegistrationRequestStatusBadgeClass(request.status)}>
              {REGISTRATION_REQUEST_STATUS_LABELS[request.status]}
            </Badge>
          </div>

          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {showCondominium && request.condominium?.name && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Condomínio</dt>
                <dd>
                  {formatCondominiumDisplayName(
                    request.condominium.name,
                    request.condominium.slug,
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Você é</dt>
              <dd>{getRegistrationProfileTypeLabel(request.profile_type)}</dd>
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
