"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { createAnnouncement, updateAnnouncement } from "@/lib/services/announcements";
import {
  parseAnnouncementFormData,
  toAnnouncementPayload,
} from "@/lib/validations/announcement.schema";

function revalidateAnnouncementPaths(condoSlug: string, announcementId?: string) {
  revalidatePath(`/app/${condoSlug}/announcements`);
  revalidatePath(`/app/${condoSlug}`);
  if (announcementId) {
    revalidatePath(`/app/${condoSlug}/announcements/${announcementId}`);
  }
}

export async function createAnnouncementAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAnnouncements,
    { redirectTo: `/app/${condoSlug}/announcements` },
  );

  const parsed = parseAnnouncementFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await createAnnouncement({
    condominiumId: access.condominium.id,
    createdBy: access.profile.id,
    data: toAnnouncementPayload(parsed.data),
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidateAnnouncementPaths(condoSlug, result.data.id);
  redirect(`/app/${condoSlug}/announcements/${result.data.id}`);
}

export async function updateAnnouncementAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const announcementId = String(formData.get("announcement_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAnnouncements,
    { redirectTo: `/app/${condoSlug}/announcements/${announcementId}` },
  );

  const parsed = parseAnnouncementFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await updateAnnouncement({
    announcementId,
    condominiumId: access.condominium.id,
    data: toAnnouncementPayload(parsed.data),
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidateAnnouncementPaths(condoSlug, announcementId);
  return { success: "Aviso atualizado com sucesso." };
}
