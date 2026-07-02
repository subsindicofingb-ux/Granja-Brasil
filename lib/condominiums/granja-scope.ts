import { isGeneralCondominium } from "@/lib/condominiums/display";
import { listCondominiums } from "@/lib/services/condominiums-admin";
import { serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

export async function getGranjaChildCondominiumIds(): Promise<ServiceResult<string[]>> {
  const condominiumsResult = await listCondominiums();

  if (!condominiumsResult.ok) {
    return serviceError(condominiumsResult.error);
  }

  return serviceOk(
    condominiumsResult.data
      .filter((condominium) => !isGeneralCondominium(condominium.slug))
      .map((condominium) => condominium.id),
  );
}
