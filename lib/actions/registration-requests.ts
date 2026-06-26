"use server";

import { revalidatePath } from "next/cache";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { notifyRegistrationRequestEvent } from "@/lib/registrations/notifications";
import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
} from "@/lib/services/registration-requests";
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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { request_id, action, review_notes, unit_id, resident_type, mark_as_unit_responsible } =
    parsed.data;

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

  revalidateRegistrationPaths(requestCondoSlug);

  return {
    success:
      action === "approve"
        ? "Cadastro aprovado. O morador já pode acessar o condomínio."
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
  });
}
