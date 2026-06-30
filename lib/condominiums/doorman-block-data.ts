import { formatCondominiumDisplayName, isGeneralCondominium } from "@/lib/condominiums/display";
import {
  getCondominiumsInDoormanBlock,
  getDoormanBlockForCondominium,
  type DoormanBlockDefinition,
} from "@/lib/condominiums/doorman-blocks";
import {
  listCondominiums,
  type CondominiumRecord,
} from "@/lib/services/condominiums-admin";
import { listUnitsByCondominium, type UnitWithTower } from "@/lib/services/units";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

export type DoormanBlockPanelData = {
  block: DoormanBlockDefinition;
  condominiums: CondominiumRecord[];
  units: UnitWithTower[];
  condominiumNamesById: Record<string, string>;
};

export async function loadDoormanBlockPanelData(
  condoSlug: string,
): Promise<ServiceResult<DoormanBlockPanelData | null>> {
  if (isGeneralCondominium(condoSlug)) {
    return serviceOk(null);
  }

  const condominiumsResult = await listCondominiums();
  if (!condominiumsResult.ok) {
    return serviceError(condominiumsResult.error);
  }

  const currentCondominium = condominiumsResult.data.find((condominium) => condominium.slug === condoSlug);
  if (!currentCondominium) {
    return serviceError("Condomínio não encontrado.");
  }

  const block = getDoormanBlockForCondominium(currentCondominium);
  if (!block) {
    return serviceOk(null);
  }

  const condominiums = getCondominiumsInDoormanBlock(block, condominiumsResult.data);
  const unitsResults = await Promise.all(
    condominiums.map((condominium) => listUnitsByCondominium(condominium.id)),
  );

  const failedUnits = unitsResults.find((result) => !result.ok);
  if (failedUnits && !failedUnits.ok) {
    return serviceError(failedUnits.error);
  }

  const units = unitsResults.flatMap((result) => (result.ok ? result.data : []));
  const condominiumNamesById = Object.fromEntries(
    condominiums.map((condominium) => [
      condominium.id,
      formatCondominiumDisplayName(condominium.name, condominium.slug),
    ]),
  );

  return serviceOk({
    block,
    condominiums,
    units,
    condominiumNamesById,
  });
}

export async function getDoormanBlockCondominiumIds(condoSlug: string): Promise<string[]> {
  const panelResult = await loadDoormanBlockPanelData(condoSlug);
  if (!panelResult.ok || !panelResult.data) {
    return [];
  }

  return panelResult.data.condominiums.map((condominium) => condominium.id);
}
