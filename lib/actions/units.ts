"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { getOrCreateDefaultUnitTower, getOrCreateHouseTower } from "@/lib/services/towers";
import { createUnit, deleteUnit, updateUnit, type UnitWithTower } from "@/lib/services/units";
import { createClient } from "@/lib/supabase/server";
import { REGISTRATION_UNIT_KIND } from "@/lib/constants";
import {
  unitFormSchema,
  unitFormHouseSchema,
  unitFormWithCondominiumSchema,
  unitFormWithoutTowerSchema,
} from "@/lib/validations/structure.schema";

function revalidateUnitPaths(condoSlug: string) {
  revalidatePath(`/app/${condoSlug}/units`);
  revalidatePath(`/app/${condoSlug}/units/new`);
}

async function resolveUnitDetailPath(
  panelCondoSlug: string,
  panelCondominiumId: string,
  unit: UnitWithTower,
): Promise<string> {
  if (unit.tower.condominium_id === panelCondominiumId) {
    return `/app/${panelCondoSlug}/units/${unit.id}`;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("condominiums")
    .select("slug")
    .eq("id", unit.tower.condominium_id)
    .maybeSingle();

  if (error || !data?.slug) {
    return `/app/${panelCondoSlug}/units`;
  }

  return `/app/${data.slug}/units/${unit.id}`;
}

export async function createUnitAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageStructure,
    { redirectTo: `/app/${condoSlug}/units` },
  );

  const requiresTower = isGeneralCondominium(condoSlug);

  if (requiresTower) {
    const unitModality = String(formData.get("unit_modality") ?? REGISTRATION_UNIT_KIND.APARTMENT);

    if (unitModality === REGISTRATION_UNIT_KIND.HOUSE) {
      const parsed = unitFormHouseSchema.safeParse({
        number: formData.get("number"),
      });

      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
      }

      const houseTowerResult = await getOrCreateHouseTower(access.condominium.id);
      if (!houseTowerResult.ok) {
        return { error: houseTowerResult.error };
      }

      const result = await createUnit({
        towerId: houseTowerResult.data.id,
        condominiumId: access.condominium.id,
        number: parsed.data.number,
        block: null,
      });

      if (!result.ok) {
        return { error: result.error };
      }

      revalidateUnitPaths(condoSlug);
      redirect(await resolveUnitDetailPath(condoSlug, access.condominium.id, result.data));
    }

    const parsed = unitFormWithCondominiumSchema.safeParse({
      condominium_id: formData.get("condominium_id"),
      number: formData.get("number"),
      block: formData.get("block") ?? "",
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    const defaultTowerResult = await getOrCreateDefaultUnitTower(parsed.data.condominium_id);
    if (!defaultTowerResult.ok) {
      return { error: defaultTowerResult.error };
    }

    const result = await createUnit({
      towerId: defaultTowerResult.data.id,
      condominiumId: parsed.data.condominium_id,
      number: parsed.data.number,
      block: parsed.data.block,
    });

    if (!result.ok) {
      return { error: result.error };
    }

    revalidateUnitPaths(condoSlug);
    redirect(await resolveUnitDetailPath(condoSlug, access.condominium.id, result.data));
  }

  const parsed = unitFormWithoutTowerSchema.safeParse({
    number: formData.get("number"),
    block: formData.get("block") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const defaultTowerResult = await getOrCreateDefaultUnitTower(access.condominium.id);
  if (!defaultTowerResult.ok) {
    return { error: defaultTowerResult.error };
  }

  const result = await createUnit({
    towerId: defaultTowerResult.data.id,
    condominiumId: access.condominium.id,
    number: parsed.data.number,
    block: parsed.data.block,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateUnitPaths(condoSlug);
  redirect(`/app/${condoSlug}/units/${result.data.id}`);
}

export async function updateUnitAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const unitId = String(formData.get("unit_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageStructure,
    { redirectTo: `/app/${condoSlug}/units/${unitId}` },
  );

  const requiresTower = isGeneralCondominium(condoSlug);

  let towerId: string | undefined;
  let number: string;
  let block: string | null;

  if (requiresTower) {
    const parsed = unitFormSchema.safeParse({
      tower_id: formData.get("tower_id"),
      number: formData.get("number"),
      block: formData.get("block") ?? "",
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    towerId = parsed.data.tower_id;
    number = parsed.data.number;
    block = parsed.data.block;
  } else {
    const parsed = unitFormWithoutTowerSchema.safeParse({
      number: formData.get("number"),
      block: formData.get("block") ?? "",
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    number = parsed.data.number;
    block = parsed.data.block;
  }

  const result = await updateUnit({
    unitId,
    condominiumId: access.condominium.id,
    towerId,
    number,
    block,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateUnitPaths(condoSlug);
  revalidatePath(`/app/${condoSlug}/units/${unitId}`);
  return { success: "Unidade atualizada com sucesso." };
}

export async function deleteUnitAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const unitId = String(formData.get("unit_id") ?? "");

  if (!unitId) {
    return { error: "Unidade inválida." };
  }

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageStructure,
    { redirectTo: `/app/${condoSlug}/units` },
  );

  const forceDelete = String(formData.get("force_delete") ?? "") === "1";

  const result = await deleteUnit({
    unitId,
    condominiumId: access.condominium.id,
    force: forceDelete,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateUnitPaths(condoSlug);
  redirect(`/app/${condoSlug}/units`);
}
