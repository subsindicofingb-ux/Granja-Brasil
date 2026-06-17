import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import {
  listCondominiums,
  type CondominiumRecord,
} from "@/lib/services/condominiums-admin";
import { listUnitsByCondominium, type UnitWithTower } from "@/lib/services/units";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

export type GeneralCondoPanelData = {
  condominiums: CondominiumRecord[];
  units: UnitWithTower[];
  condominiumNamesById: Record<string, string>;
};

export async function loadGeneralCondoPanelData(options?: {
  condominiumSlug?: string;
}): Promise<ServiceResult<GeneralCondoPanelData>> {
  const condominiumsResult = await listCondominiums();

  if (!condominiumsResult.ok) {
    return serviceError(condominiumsResult.error);
  }

  const condominiums = condominiumsResult.data;
  const filteredCondominium = options?.condominiumSlug
    ? condominiums.find((condominium) => condominium.slug === options.condominiumSlug)
    : undefined;

  if (options?.condominiumSlug && !filteredCondominium) {
    return serviceError("Condomínio inválido para filtro.");
  }

  const unitsResult = await listUnitsByCondominium(filteredCondominium?.id);

  if (!unitsResult.ok) {
    return serviceError(unitsResult.error);
  }

  const condominiumNamesById = Object.fromEntries(
    condominiums.map((condominium) => [
      condominium.id,
      formatCondominiumDisplayName(condominium.name, condominium.slug),
    ]),
  );

  return serviceOk({
    condominiums,
    units: unitsResult.data,
    condominiumNamesById,
  });
}
