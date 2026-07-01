import { ROLES } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey } from "@/lib/supabase/env";

async function profileHasResidentInCondominium(
  profileId: string,
  condominiumId: string,
): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("residents")
    .select("id, units!inner(towers!inner(condominium_id))")
    .eq("profile_id", profileId)
    .eq("units.towers.condominium_id", condominiumId)
    .limit(1);

  return !error && (data?.length ?? 0) > 0;
}

export async function cleanupOrphanResidentMemberships(profileId: string): Promise<number> {
  if (!getSupabaseServiceRoleKey()) {
    return 0;
  }

  const admin = createAdminClient();

  const { data: memberships, error } = await admin
    .from("memberships")
    .select("id, condominium_id, role")
    .eq("profile_id", profileId)
    .eq("role", ROLES.RESIDENT);

  if (error || !memberships?.length) {
    return 0;
  }

  let removed = 0;

  for (const membership of memberships) {
    const hasResident = await profileHasResidentInCondominium(profileId, membership.condominium_id);
    if (hasResident) {
      continue;
    }

    const { error: deleteError } = await admin.from("memberships").delete().eq("id", membership.id);
    if (!deleteError) {
      removed += 1;
    }
  }

  return removed;
}

export async function revokeResidentMembershipIfOrphaned(input: {
  profileId: string;
  condominiumId: string;
}): Promise<void> {
  if (!getSupabaseServiceRoleKey()) {
    return;
  }

  const hasResident = await profileHasResidentInCondominium(input.profileId, input.condominiumId);
  if (hasResident) {
    return;
  }

  const admin = createAdminClient();
  await admin
    .from("memberships")
    .delete()
    .eq("profile_id", input.profileId)
    .eq("condominium_id", input.condominiumId)
    .eq("role", ROLES.RESIDENT);
}
