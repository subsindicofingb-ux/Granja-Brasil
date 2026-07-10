import { LEGAL_DOCUMENT_VERSION } from "@/lib/legal/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LegalDocumentType } from "@/types/database.types";

interface RecordSignupLegalAcceptancesInput {
  profileId: string;
  registrationRequestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordSignupLegalAcceptances(
  input: RecordSignupLegalAcceptancesInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const acceptedAt = new Date().toISOString();
  const documents: LegalDocumentType[] = ["terms_of_use", "privacy_policy"];

  const rows = documents.map((documentType) => ({
    profile_id: input.profileId,
    document_type: documentType,
    document_version: LEGAL_DOCUMENT_VERSION,
    accepted_at: acceptedAt,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    registration_request_id: input.registrationRequestId ?? null,
  }));

  const { error } = await admin.from("legal_acceptances").insert(rows);

  if (error) {
    return {
      ok: false,
      error: "Não foi possível registrar o aceite dos termos. Tente novamente.",
    };
  }

  return { ok: true };
}
