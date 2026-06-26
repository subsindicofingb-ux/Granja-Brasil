"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { notifyCorrespondenceCreated } from "@/lib/email/correspondence-notifications";
import {
  createCorrespondenceNotice,
  getUnitResponsibleProfileId,
} from "@/lib/services/correspondence";
import { resolveUnitContext } from "@/lib/services/unit-access";
import { parseCorrespondenceFormData } from "@/lib/validations/doorman.schema";

function revalidateCorrespondencePaths(condoSlug: string) {
  revalidatePath(`/app/${condoSlug}/correspondence`);
  revalidatePath(`/app/${condoSlug}`);
}

export async function createCorrespondenceNoticeAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageCorrespondence,
    { redirectTo: `/app/${condoSlug}/correspondence` },
  );

  if (isGeneralCondominium(condoSlug)) {
    return { error: "Correspondências são registradas nos condomínios filhos." };
  }

  const parsed = parseCorrespondenceFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const unitContext = await resolveUnitContext(parsed.data.unit_id, access.condominium.id);
  if (!unitContext.ok) {
    return { error: unitContext.error ?? "Unidade inválida." };
  }

  const responsibleResult = await getUnitResponsibleProfileId(parsed.data.unit_id);
  if (!responsibleResult.ok) {
    return { error: responsibleResult.error };
  }

  const result = await createCorrespondenceNotice({
    condominiumId: access.condominium.id,
    unitId: parsed.data.unit_id,
    targetProfileId: responsibleResult.data,
    description: parsed.data.description,
    carrier: parsed.data.carrier,
    notes: parsed.data.notes,
    createdBy: access.profile.id,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  after(async () => {
    try {
      await notifyCorrespondenceCreated({
        notice: result.data,
        condominiumName: access.condominium.name,
      });
    } catch (error) {
      console.error("[email:correspondence-created]", error);
    }
  });

  revalidateCorrespondencePaths(condoSlug);
  redirect(`/app/${condoSlug}/correspondence?enviado=1`);
}
