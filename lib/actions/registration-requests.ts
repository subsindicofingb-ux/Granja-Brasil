"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireCondoPermission } from "@/lib/auth/access";
import { canAssignMemberRole } from "@/lib/auth/member-roles";
import type { AuthActionState } from "@/lib/auth/types";
import type { Role } from "@/lib/constants";
import {
  notifyRegistrationApprovedEvent,
  notifyRegistrationRequestEvent,
} from "@/lib/registrations/notifications";
import { parseAccessDeviceIdsFromFormData } from "@/lib/access-devices/form";
import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
} from "@/lib/services/registration-requests";
import {
  listActiveAccessDevicesForCondominium,
} from "@/lib/services/resident-access-grants";
import { formatRegistrationUnitLabel } from "@/lib/registrations/profile-type";
import { reviewRegistrationRequestSchema } from "@/lib/validations/registration.schema";

function revalidateRegistrationPaths(condoSlug: string) {
  revalidatePath(`/app/${condoSlug}`);
  revalidatePath(`/app/${condoSlug}/settings`);
  revalidatePath(`/app/${condoSlug}/settings/registration-requests`);
  revalidatePath("/app");
}

export async function reviewRegistrationRequestAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const requestCondoSlug = String(
    formData.get("request_condominium_slug") ?? formData.get("condo_slug") ?? "",
  ).trim();

  const access = await requireCondoPermission(
    requestCondoSlug,
    (ctx) => ctx.permissions.canManageRegistrationRequests,
    { redirectTo: `/app/${requestCondoSlug}/settings/registration-requests` },
  );

  const parsed = reviewRegistrationRequestSchema.safeParse({
    request_id: formData.get("request_id"),
    action: formData.get("action"),
    review_notes: formData.get("review_notes") ?? "",
    unit_id: formData.get("unit_id") || undefined,
    resident_type: formData.get("resident_type") || undefined,
    mark_as_unit_responsible: formData.get("mark_as_unit_responsible") === "on",
    membership_role: formData.get("membership_role") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const {
    request_id,
    action,
    review_notes,
    unit_id,
    resident_type,
    mark_as_unit_responsible,
    membership_role,
  } = parsed.data;

  if (
    action === "approve" &&
    membership_role &&
    !canAssignMemberRole(access.role, membership_role as Role)
  ) {
    return { error: "Você não pode atribuir esta função ao usuário." };
  }

  const accessDeviceIds = parseAccessDeviceIdsFromFormData(formData);

  const result =
    action === "approve"
      ? await approveRegistrationRequest({
          requestId: request_id,
          condominiumId: access.condominium.id,
          reviewerProfileId: access.profile.id,
          unitId: unit_id,
          reviewNotes: review_notes,
          residentType: resident_type,
          markAsUnitResponsible: mark_as_unit_responsible,
          accessDeviceIds,
          membershipRole: membership_role as Role | undefined,
        })
      : await rejectRegistrationRequest({
          requestId: request_id,
          condominiumId: access.condominium.id,
          reviewerProfileId: access.profile.id,
          reviewNotes: review_notes,
        });

  if (!result.ok) {
    return { error: result.error ?? "Não foi possível analisar a solicitação." };
  }

  if (action === "approve") {
    const request = result.data;
    const unitLabel = formatRegistrationUnitLabel({
      profileType: request.profile_type,
      unitNumber: request.unit_number,
      unitKind: request.unit_kind,
      condominiumSlug: request.condominium?.slug ?? requestCondoSlug,
    });

    let accessDeviceNames: string[] = [];

    if (accessDeviceIds.length > 0) {
      const devicesResult = await listActiveAccessDevicesForCondominium(access.condominium.id);
      if (devicesResult.ok) {
        accessDeviceNames = devicesResult.data
          .filter((device) => accessDeviceIds.includes(device.id))
          .map((device) => device.display_name);
      }
    }

    after(async () => {
      try {
        await notifyRegistrationApprovedEvent({
          type: "registration_request_approved",
          condominiumId: access.condominium.id,
          condominiumName: request.condominium?.name ?? access.condominium.name,
          fullName: request.full_name,
          email: request.email,
          unitLabel,
          accessDeviceNames,
        });
      } catch (error) {
        console.error("[email:registration-approved]", error);
      }
    });
  }

  revalidateRegistrationPaths(requestCondoSlug);

  return {
    success:
      action === "approve"
        ? "Cadastro aprovado. O usuário já pode acessar o condomínio."
        : "Solicitação recusada.",
  };
}

export async function notifyNewRegistrationRequest(input: {
  requestId: string;
  condominiumId: string;
  condominiumName: string;
  fullName: string;
  email: string;
  unitLabel: string;
  profileType: import("@/lib/constants").RegistrationProfileType;
  residentType: "owner" | "tenant" | "dependent" | "responsible";
  source?: "doorman" | "signup";
  fulfilledImmediately?: boolean;
  accessDeviceNames?: string[];
}) {
  await notifyRegistrationRequestEvent({
    type: "registration_request_created",
    requestId: input.requestId,
    condominiumId: input.condominiumId,
    condominiumName: input.condominiumName,
    fullName: input.fullName,
    email: input.email,
    unitLabel: input.unitLabel,
    profileType: input.profileType,
    residentType: input.residentType,
    source: input.source,
    fulfilledImmediately: input.fulfilledImmediately,
    accessDeviceNames: input.accessDeviceNames,
  });
}
