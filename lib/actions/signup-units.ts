"use server";

import { listPublicUnitsByCondominium } from "@/lib/services/registration-requests";

export async function listSignupUnitsAction(condominiumId: string) {
  return listPublicUnitsByCondominium(condominiumId);
}
