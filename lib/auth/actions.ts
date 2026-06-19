"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/constants";
import { clearActiveCondoSlug } from "@/lib/auth/active-condo";
import { clearPendingPasswordReset } from "@/lib/auth/password-reset";
import { getUserMemberships, requireCondoAccess } from "@/lib/auth/access";
import { resolveSafeAppRedirect } from "@/lib/auth/condo-access-guard";
import { ensureProfile, getAuthUser } from "@/lib/auth/session";
import type { AuthActionState } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured, getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import { notifyNewRegistrationRequest } from "@/lib/actions/registration-requests";
import {
  createRegistrationRequestAsAdmin,
  listPublicCondominiums,
} from "@/lib/services/registration-requests";
import { isEmailConfigured, sendEmail } from "@/lib/email/send-email";
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

  if (lower.includes("email not found") || lower.includes("e-mail não foi encontrado")) {
    return "Não foi possível criar a conta com este e-mail. Tente outro endereço ou faça login se já tiver cadastro.";
  }

  return text;
}

const PASSWORD_RESET_SUCCESS_MESSAGE =
  "Se existir uma conta com este e-mail, enviamos um link para redefinir a senha. Verifique a caixa de entrada e o spam.";

function formatPasswordResetError(message: unknown): string {
  const text = message instanceof Error ? message.message : String(message);
  return formatAuthError(text);
}

function getPasswordResetRedirectUrl(): string {
  return `${getSiteUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw error;
  }

  return (
    data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null
  );
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

export async function requestPasswordResetAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { error: "Informe o e-mail." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel.",
    };
  }

  const redirectTo = getPasswordResetRedirectUrl();

  try {
    if (!getSupabaseServiceRoleKey()) {
      const supabase = await createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        const lower = error.message.toLowerCase();
        if (
          lower.includes("not found") ||
          lower.includes("não encontrado")
        ) {
          return { success: PASSWORD_RESET_SUCCESS_MESSAGE };
        }

        return { error: formatPasswordResetError(error.message) };
      }

      return { success: PASSWORD_RESET_SUCCESS_MESSAGE };
    }

    const admin = createAdminClient();
    const existingUser = await findAuthUserByEmail(admin, email);

    if (!existingUser?.email) {
      return { success: PASSWORD_RESET_SUCCESS_MESSAGE };
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: existingUser.email,
      options: { redirectTo },
    });

    if (linkError) {
      return { error: formatPasswordResetError(linkError.message) };
    }

    const recoveryLink = linkData.properties?.action_link;

    if (recoveryLink && isEmailConfigured()) {
      const sent = await sendEmail({
        to: [existingUser.email],
        subject: "Redefinir senha — Granja Brasil",
        text: `Recebemos uma solicitação para redefinir sua senha.\n\nAcesse o link abaixo (válido por tempo limitado):\n${recoveryLink}\n\nSe você não solicitou, ignore este e-mail.`,
        html: `
          <p>Recebemos uma solicitação para redefinir sua senha.</p>
          <p><a href="${recoveryLink}">Redefinir senha</a></p>
          <p>Se você não solicitou, ignore este e-mail.</p>
        `,
      });

      if (sent.ok) {
        return { success: PASSWORD_RESET_SUCCESS_MESSAGE };
      }
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(existingUser.email, {
      redirectTo,
    });

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes("not found") || lower.includes("não encontrado")) {
        return { success: PASSWORD_RESET_SUCCESS_MESSAGE };
      }

      if (recoveryLink) {
        return {
          error:
            "Conta encontrada, mas não foi possível enviar o e-mail. Configure RESEND_API_KEY ou o SMTP do Supabase.",
        };
      }

      return { error: formatPasswordResetError(error.message) };
    }

    return { success: PASSWORD_RESET_SUCCESS_MESSAGE };
  } catch (err) {
    return { error: formatPasswordResetError(err) };
  }
}

export async function updatePasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!password) {
    return { error: "Informe a nova senha." };
  }

  if (password.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  if (password !== confirmPassword) {
    return { error: "As senhas não coincidem." };
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Link expirado ou inválido. Solicite uma nova redefinição em Esqueci a senha.",
    };
  }

  try {
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return { error: formatAuthError(error.message) };
    }

    await clearPendingPasswordReset();

    revalidatePath("/", "layout");

    const safeRedirect = await resolveSafeAppRedirect(supabase, "/app");

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

  if (!getSupabaseServiceRoleKey()) {
    return {
      error:
        "Cadastro indisponível: configure SUPABASE_SERVICE_ROLE_KEY na Vercel (Settings → Environment Variables) e faça redeploy.",
    };
  }

  try {
    const admin = createAdminClient();
    const existingUser = await findAuthUserByEmail(admin, email);
    let userId: string;

    if (existingUser) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        user_metadata: { full_name: fullName },
      });

      if (updateError) {
        return {
          error:
            "Este e-mail já possui cadastro. Faça login em /login ou use a opção de recuperar senha.",
        };
      }

      userId = existingUser.id;
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createError) {
        return { error: formatAuthError(createError.message) };
      }

      if (!created.user) {
        return { error: "Não foi possível criar a conta. Tente novamente." };
      }

      userId = created.user.id;
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        full_name: fullName,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      return { error: formatAuthError(profileError.message) };
    }

    const condos = await listPublicCondominiums();
    const selectedCondo = condos.ok
      ? condos.data?.find((condo) => condo.id === preQualification.data.condominium_id)
      : undefined;

    const requestResult = await createRegistrationRequestAsAdmin({
      profileId: userId,
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

    const pendingAlreadyExists =
      !requestResult.ok &&
      Boolean(requestResult.error?.includes("solicitação pendente"));

    if (!requestResult.ok && !pendingAlreadyExists) {
      return {
        error:
          requestResult.error ??
          "Conta criada, mas não foi possível enviar a solicitação ao condomínio. Entre em contato com o síndico.",
      };
    }

    if (selectedCondo && requestResult.ok && requestResult.data) {
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

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    revalidatePath("/", "layout");

    if (signInError) {
      return {
        success:
          "Solicitação registrada! Faça login em /login com seu e-mail e senha. Aguarde a aprovação do responsável.",
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
