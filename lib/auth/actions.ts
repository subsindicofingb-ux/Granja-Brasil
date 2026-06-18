"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/constants";
import { clearActiveCondoSlug } from "@/lib/auth/active-condo";
import { getUserMemberships, requireCondoAccess } from "@/lib/auth/access";
import { resolveSafeAppRedirect } from "@/lib/auth/condo-access-guard";
import { ensureProfile, getAuthUser } from "@/lib/auth/session";
import type { AuthActionState } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { notifyNewRegistrationRequest } from "@/lib/actions/registration-requests";
import {
  createRegistrationRequestAsAdmin,
  listPublicCondominiums,
} from "@/lib/services/registration-requests";
import { registrationPreQualificationSchema } from "@/lib/validations/registration.schema";
import type { RegistrationProfileType } from "@/lib/constants";
import { formatRegistrationUnitLabel, requiresRegistrationUnit } from "@/lib/registrations/profile-type";

function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (explicit) {
    return explicit;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim().replace(/\/+$/, "");
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}

function formatAuthError(message: unknown): string {
  const text = message instanceof Error ? message.message : String(message);
  const lower = text.toLowerCase();

  if (text.includes("Unexpected token '<'") || text.includes("is not valid JSON")) {
    return "URL ou chave do Supabase inválida na Vercel. NEXT_PUBLIC_SUPABASE_URL deve ser https://SEU-REF.supabase.co e NEXT_PUBLIC_SUPABASE_ANON_KEY deve ser a chave anon/public do projeto.";
  }

  if (lower.includes("fetch failed") || lower.includes("failed to fetch") || lower.includes("network")) {
    return "Não foi possível conectar ao Supabase. Verifique: (1) o projeto Supabase não está pausado, (2) NEXT_PUBLIC_SUPABASE_URL está correto (https://xxx.supabase.co), (3) fez redeploy na Vercel após salvar as variáveis, (4) prefira a URL de produção do site (não preview protegida).";
  }

  if (
    lower.includes("email not provided") ||
    lower.includes("e-mail não informado") ||
    lower.includes("email address is invalid")
  ) {
    return "Informe um e-mail válido.";
  }

  if (
    lower.includes("user already registered") ||
    lower.includes("already been registered") ||
    lower.includes("já está cadastrado")
  ) {
    return "Este e-mail já possui cadastro. Faça login ou use outro e-mail.";
  }

  return text;
}

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/app");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel.",
    };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Não foi possível conectar ao Supabase. Verifique as variáveis de ambiente." };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: "Credenciais inválidas. Verifique e-mail e senha." };
    }

    if (data.user) {
      await ensureProfile(data.user);
    }

    revalidatePath("/", "layout");

    const safeRedirect = await resolveSafeAppRedirect(
      supabase,
      redirectTo.startsWith("/") ? redirectTo : "/app",
    );

    return { redirectTo: safeRedirect };
  } catch (err) {
    return { error: formatAuthError(err) };
  }
}

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const condominiumId = String(formData.get("condominium_id") ?? "").trim();
  const condominiumSlug = String(formData.get("condominium_slug") ?? "").trim();
  const profileType = String(formData.get("profile_type") ?? "").trim();
  const unitId = String(formData.get("unit_id") ?? "").trim();
  const unitNumber = String(formData.get("unit_number") ?? "").trim();

  if (!fullName) {
    return { error: "Informe o nome completo." };
  }

  if (!email) {
    return { error: "Informe o e-mail." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  if (!password) {
    return { error: "Informe a senha." };
  }

  if (password.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  const preQualification = registrationPreQualificationSchema.safeParse({
    condominium_id: condominiumId,
    condominium_slug: condominiumSlug,
    profile_type: profileType,
    unit_id: unitId,
    unit_number: unitNumber,
  });

  if (!preQualification.success) {
    return { error: preQualification.error.issues[0]?.message ?? "Dados de pré-qualificação inválidos." };
  }

  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel.",
    };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Não foi possível conectar ao Supabase. Verifique as variáveis de ambiente." };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/app`,
      },
    });

    if (error) {
      return { error: formatAuthError(error.message) };
    }

    if (!data.user) {
      return {
        success:
          "Se este e-mail ainda não estiver cadastrado, você receberá instruções para confirmar a conta. Caso já tenha cadastro, faça login.",
      };
    }

    if (data.user) {
      await ensureProfile(data.user);

      const condos = await listPublicCondominiums();
      const selectedCondo = condos.ok
        ? condos.data?.find((condo) => condo.id === preQualification.data.condominium_id)
        : undefined;

      const requestResult = await createRegistrationRequestAsAdmin({
        profileId: data.user.id,
        condominiumId: preQualification.data.condominium_id,
        profileType: preQualification.data.profile_type as RegistrationProfileType,
        fullName,
        email,
        unitId: requiresRegistrationUnit(
          preQualification.data.profile_type as RegistrationProfileType,
        )
          ? preQualification.data.unit_id || undefined
          : undefined,
        unitNumber: requiresRegistrationUnit(
          preQualification.data.profile_type as RegistrationProfileType,
        )
          ? preQualification.data.unit_number || undefined
          : undefined,
      });

      if (!requestResult.ok) {
        return {
          error:
            requestResult.error ??
            "Conta criada, mas não foi possível enviar a solicitação ao condomínio. Entre em contato com o síndico.",
        };
      }

      if (selectedCondo && requestResult.data) {
        const unitLabel = formatRegistrationUnitLabel({
          profileType: requestResult.data.profile_type,
          unitNumber: requestResult.data.unit_number,
          unitKind: requestResult.data.unit_kind,
          condominiumSlug: selectedCondo.slug,
        });

        await notifyNewRegistrationRequest({
          requestId: requestResult.data.id,
          condominiumId: selectedCondo.id,
          condominiumName: selectedCondo.name,
          fullName,
          email,
          unitLabel,
          profileType: preQualification.data.profile_type as RegistrationProfileType,
          residentType: requestResult.data.resident_type,
        });
      }
    }

    revalidatePath("/", "layout");

    if (!data.session) {
      return {
        success:
          "Conta criada! Confirme o e-mail enviado. O síndico do condomínio foi notificado e analisará seu cadastro.",
      };
    }

    const memberships = await getUserMemberships();
    if (memberships.length === 0) {
      await supabase.auth.signOut();
      return {
        success:
          "Conta criada! Confirme o e-mail enviado. O síndico do condomínio foi notificado e analisará seu cadastro.",
      };
    }

    return { redirectTo: "/app" };
  } catch (err) {
    return { error: formatAuthError(err) };
  }
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignora falha de rede/config ao encerrar sessão local.
    }
  }
  await clearActiveCondoSlug();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function selectCondominiumAction(slug: string) {
  await requireCondoAccess(slug);
  redirect(`/app/${slug}`);
}

export async function selectCondominiumFormAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) {
    redirect("/app");
  }
  await selectCondominiumAction(slug);
}

export async function addMembershipAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;

  if (!condoSlug || !email || !role) {
    return { error: "Preencha e-mail e papel." };
  }

  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canManageMembers) {
    return { error: "Sem permissão para gerenciar membros." };
  }

  const admin = createAdminClient();
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    return { error: "Não foi possível buscar usuários." };
  }

  const targetUser = listed.users.find(
    (user) => user.email?.toLowerCase() === email,
  );

  if (!targetUser) {
    return {
      error:
        "Usuário não encontrado. Peça para a pessoa criar conta em /signup antes de vincular.",
    };
  }

  await admin.from("profiles").upsert(
    {
      id: targetUser.id,
      full_name:
        (targetUser.user_metadata?.full_name as string | undefined) ??
        targetUser.email?.split("@")[0] ??
        "Usuário",
    },
    { onConflict: "id" },
  );

  const supabase = await createClient();
  const { error: insertError } = await supabase.from("memberships").insert({
    profile_id: targetUser.id,
    condominium_id: access.condominium.id,
    role,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "Este usuário já possui vínculo neste condomínio." };
    }
    return { error: insertError.message };
  }

  revalidatePath(`/app/${condoSlug}/settings/members`);
  return { success: "Membro vinculado com sucesso." };
}

export async function removeMembershipAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const membershipId = String(formData.get("membership_id") ?? "");

  if (!condoSlug || !membershipId) {
    return { error: "Dados inválidos." };
  }

  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canManageMembers) {
    return { error: "Sem permissão para remover membros." };
  }

  const currentUser = await getAuthUser();
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("memberships")
    .select("id, profile_id, role")
    .eq("id", membershipId)
    .eq("condominium_id", access.condominium.id)
    .maybeSingle();

  if (!membership) {
    return { error: "Vínculo não encontrado." };
  }

  if (membership.profile_id === currentUser?.id) {
    return { error: "Você não pode remover o próprio vínculo." };
  }

  const { error } = await supabase.from("memberships").delete().eq("id", membershipId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/${condoSlug}/settings/members`);
  return { success: "Vínculo removido." };
}

export async function linkResidentProfileAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const residentId = String(formData.get("resident_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!condoSlug || !residentId || !email) {
    return { error: "Dados incompletos." };
  }

  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canManageResidents) {
    return { error: "Sem permissão para vincular moradores." };
  }

  const admin = createAdminClient();
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const targetUser = listed?.users.find((user) => user.email?.toLowerCase() === email);

  if (!targetUser) {
    return { error: "Usuário não encontrado. A pessoa precisa ter conta em /signup." };
  }

  await admin.from("profiles").upsert(
    {
      id: targetUser.id,
      full_name:
        (targetUser.user_metadata?.full_name as string | undefined) ??
        targetUser.email?.split("@")[0] ??
        "Usuário",
    },
    { onConflict: "id" },
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("residents")
    .update({ profile_id: targetUser.id })
    .eq("id", residentId);

  if (error) {
    return { error: error.message };
  }

  // Garante membership resident se ainda não existir
  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("id")
    .eq("profile_id", targetUser.id)
    .eq("condominium_id", access.condominium.id)
    .maybeSingle();

  if (!existingMembership) {
    await supabase.from("memberships").insert({
      profile_id: targetUser.id,
      condominium_id: access.condominium.id,
      role: "resident",
    });
  }

  revalidatePath(`/app/${condoSlug}/residents`);
  return { success: "Morador vinculado ao usuário." };
}
