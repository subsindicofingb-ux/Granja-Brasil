import { createAdminClient } from "@/lib/supabase/admin";
import { mapSupabaseError, serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

export function normalizeResidentEmail(email: string | null | undefined): string | null {
  if (email == null) {
    return null;
  }

  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeResidentPhone(phone: string | null | undefined): string | null {
  if (phone == null) {
    return null;
  }

  const digits = phone.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export async function assertUniqueResidentContactInUnit(input: {
  unitId: string;
  email: string | null | undefined;
  phone: string | null | undefined;
  excludeResidentId?: string;
}): Promise<ServiceResult<void>> {
  const normalizedEmail = normalizeResidentEmail(input.email);
  const normalizedPhone = normalizeResidentPhone(input.phone);

  if (!normalizedEmail && !normalizedPhone) {
    return serviceOk(undefined);
  }

  try {
    const admin = createAdminClient();

    let query = admin
      .from("residents")
      .select("id, email, phone")
      .eq("unit_id", input.unitId);

    if (input.excludeResidentId) {
      query = query.neq("id", input.excludeResidentId);
    }

    const { data, error } = await query;

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    for (const resident of data ?? []) {
      if (
        normalizedEmail &&
        normalizeResidentEmail(resident.email) === normalizedEmail
      ) {
        return serviceError("Já existe um morador nesta unidade com este e-mail.");
      }

      if (
        normalizedPhone &&
        normalizeResidentPhone(resident.phone) === normalizedPhone
      ) {
        return serviceError("Já existe um morador nesta unidade com este telefone.");
      }
    }

    return serviceOk(undefined);
  } catch {
    return serviceError("Não foi possível validar e-mail e telefone na unidade.");
  }
}

export function mapResidentContactUniqueError(message: string): string | null {
  if (message.includes("residents_unique_email_per_unit_idx")) {
    return "Já existe um morador nesta unidade com este e-mail.";
  }

  if (message.includes("residents_unique_phone_per_unit_idx")) {
    return "Já existe um morador nesta unidade com este telefone.";
  }

  return null;
}
