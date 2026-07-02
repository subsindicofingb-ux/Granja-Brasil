"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { reviewRegistrationRequestAction } from "@/lib/actions/registration-requests";
import { getMemberRoleLabel } from "@/lib/auth/member-roles";
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
import { ResidentAccessDeviceFields } from "@/components/access-devices/resident-access-device-fields";
import type { AccessDeviceOption } from "@/lib/access-devices/grant-types";
import { REGISTRATION_PROFILE_TYPES, ROLES, type Role } from "@/lib/constants";
import type { PublicUnitOption } from "@/lib/services/registration-requests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/utils";

interface RegistrationRequestListProps {
  condoSlug: string;
  requests: RegistrationRequestRecord[];
  showCondominium?: boolean;
  accessDevicesByCondominiumId?: Record<string, AccessDeviceOption[]>;
  requestAccessDeviceIdsByRequestId?: Record<string, string[]>;
  assignableRoles: Role[];
  unitsByCondominiumId?: Record<string, PublicUnitOption[]>;
}

function formatRequestedUnit(request: RegistrationRequestRecord): string {
  return formatRegistrationUnitLabel({
    profileType: request.profile_type,
    unitNumber: request.unit_number,
    unitKind: request.unit_kind,
    condominiumSlug: request.condominium?.slug,
  });
}

function ReviewForm({
  condoSlug,
  request,
  accessDevices,
  defaultAccessDeviceIds,
  assignableRoles,
  units,
}: {
  condoSlug: string;
  request: RegistrationRequestRecord;
  accessDevices: AccessDeviceOption[];
  defaultAccessDeviceIds: string[];
  assignableRoles: Role[];
  units: PublicUnitOption[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(reviewRegistrationRequestAction, {});
  const requestCondoSlug = request.condominium?.slug ?? condoSlug;
  const isOtherProfile = request.profile_type === REGISTRATION_PROFILE_TYPES.OTHER;
  const [membershipRole, setMembershipRole] = useState<Role>(
    assignableRoles[0] ?? ROLES.STAFF,
  );
  const showResidentQualification =
    requiresRegistrationUnit(request.profile_type) ||
    (isOtherProfile && membershipRole === ROLES.RESIDENT);
  const showAccessDevices =
    showResidentQualification && accessDevices.length > 0;

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

      {isOtherProfile && (
        <div className="space-y-2">
          <Label htmlFor={`membership_role_${request.id}`}>Função no condomínio</Label>
          <select
            id={`membership_role_${request.id}`}
            name="membership_role"
            value={membershipRole}
            onChange={(event) => setMembershipRole(event.target.value as Role)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            required
          >
            {assignableRoles.map((role) => (
              <option key={role} value={role}>
                {getMemberRoleLabel(role)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Defina a função correta antes de liberar o acesso ao app.
          </p>
        </div>
      )}

      {showResidentQualification && (
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
            {isOtherProfile
              ? "Informe a qualificação e a unidade, se a função for morador."
              : "Ajuste a qualificação, se necessário, antes de aprovar."}
          </p>
          {isOtherProfile && membershipRole === ROLES.RESIDENT && units.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor={`unit_id_${request.id}`}>Unidade ou casa</Label>
              <select
                id={`unit_id_${request.id}`}
                name="unit_id"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                required
                defaultValue={request.requested_unit_id ?? ""}
              >
                <option value="" disabled>
                  Selecione
                </option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
            <input
              type="checkbox"
              name="mark_as_unit_responsible"
              className="mt-1"
            />
            <span>
              Definir como morador responsável da unidade
              <span className="mt-1 block text-xs text-muted-foreground">
                O responsável recebe notificações formais enviadas à unidade.
              </span>
            </span>
          </label>
        </div>
      )}

      {showAccessDevices && (
        <ResidentAccessDeviceFields
          devices={accessDevices}
          defaultSelectedIds={defaultAccessDeviceIds}
        />
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
  accessDevicesByCondominiumId = {},
  requestAccessDeviceIdsByRequestId = {},
  assignableRoles,
  unitsByCondominiumId = {},
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
            <ReviewForm
              condoSlug={condoSlug}
              request={request}
              accessDevices={accessDevicesByCondominiumId[request.condominium_id] ?? []}
              defaultAccessDeviceIds={requestAccessDeviceIdsByRequestId[request.id] ?? []}
              assignableRoles={assignableRoles}
              units={unitsByCondominiumId[request.condominium_id] ?? []}
            />
          )}
        </div>
      ))}
    </div>
  );
}
