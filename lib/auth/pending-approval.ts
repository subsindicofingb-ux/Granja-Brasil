import type { SupabaseClient } from "@supabase/supabase-js";
import { ROLES } from "@/lib/constants";
import type { Database } from "@/types/database.types";

export const PENDING_APPROVAL_PATH = "/app/aguardando-aprovacao";

export const PENDING_APPROVAL_TITLE = "Autorização pendente";

export const PENDING_APPROVAL_MESSAGE =
  "Sua solicitação de cadastro foi recebida. O responsável do condomínio precisa aprovar seu acesso antes de liberar o painel.";

export const PENDING_APPROVAL_FOOTNOTE =
  "Assim que o síndico aprovar, faça login novamente para acessar reservas, avisos e demais funcionalidades do condomínio.";

const OPERATIONAL_ROLES = [
  ROLES.ADMIN,
  ROLES.SYNDIC,
  ROLES.SUB_SYNDIC,
  ROLES.DOORMAN,
  ROLES.STAFF,
] as const;

async function getAuthenticatedProfileId(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

async function userHasAnyMembership(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  const { data: isSuperAdmin, error: rpcError } = await supabase.rpc("is_super_admin");

  if (!rpcError && isSuperAdmin) {
    return true;
  }

  const profileId = await getAuthenticatedProfileId(supabase);
  if (!profileId) {
    return false;
  }

  const { data, error } = await supabase
    .from("memberships")
    .select("id")
    .eq("profile_id", profileId)
    .limit(1);

  return !error && (data?.length ?? 0) > 0;
}

async function userHasPendingRegistration(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("registration_requests")
    .select("id")
    .eq("profile_id", profileId)
    .eq("status", "pending")
    .limit(1);

  return !error && (data?.length ?? 0) > 0;
}

async function userHasOperationalMembership(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("memberships")
    .select("id")
    .eq("profile_id", profileId)
    .in("role", [...OPERATIONAL_ROLES])
    .limit(1);

  return !error && (data?.length ?? 0) > 0;
}

async function userHasLinkedResidentForAllResidentMemberships(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<boolean> {
  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select("condominium_id")
    .eq("profile_id", profileId)
    .eq("role", ROLES.RESIDENT);

  if (membershipError || !memberships?.length) {
    return true;
  }

  for (const membership of memberships) {
    const { data: approvedRequests, error: approvedError } = await supabase
      .from("registration_requests")
      .select("id")
      .eq("profile_id", profileId)
      .eq("condominium_id", membership.condominium_id)
      .eq("status", "approved")
      .limit(1);

    if (!approvedError && (approvedRequests?.length ?? 0) > 0) {
      continue;
    }

    const { data: residents, error: residentError } = await supabase
      .from("residents")
      .select("id, units!inner(towers!inner(condominium_id))")
      .eq("profile_id", profileId)
      .eq("units.towers.condominium_id", membership.condominium_id)
      .limit(1);

    if (residentError || !residents?.length) {
      return false;
    }
  }

  return true;
}

export async function userHasAppAccess(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  const { data: isSuperAdmin, error: rpcError } = await supabase.rpc("is_super_admin");

  if (!rpcError && isSuperAdmin) {
    return true;
  }

  const profileId = await getAuthenticatedProfileId(supabase);
  if (!profileId) {
    return false;
  }

  if (await userHasOperationalMembership(supabase, profileId)) {
    return true;
  }

  if (await userHasPendingRegistration(supabase, profileId)) {
    return false;
  }

  if (!(await userHasAnyMembership(supabase))) {
    return false;
  }

  return userHasLinkedResidentForAllResidentMemberships(supabase, profileId);
}
