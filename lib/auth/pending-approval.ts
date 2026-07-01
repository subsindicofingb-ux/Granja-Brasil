import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { userHasAnyMembership } from "@/lib/auth/condo-access-guard";

export const PENDING_APPROVAL_PATH = "/app/aguardando-aprovacao";

export const PENDING_APPROVAL_TITLE = "Autorização pendente";

export const PENDING_APPROVAL_MESSAGE =
  "Sua solicitação de cadastro foi recebida. O responsável do condomínio precisa aprovar seu acesso antes de liberar o painel.";

export const PENDING_APPROVAL_FOOTNOTE =
  "Assim que o síndico aprovar, faça login novamente para acessar reservas, avisos e demais funcionalidades do condomínio.";

export async function userHasAppAccess(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  const { data: isSuperAdmin, error: rpcError } = await supabase.rpc("is_super_admin");

  if (!rpcError && isSuperAdmin) {
    return true;
  }

  return userHasAnyMembership(supabase);
}
