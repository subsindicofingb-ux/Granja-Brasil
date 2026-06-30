import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadDoormanBlockPanelData, type DoormanBlockPanelData } from "@/lib/condominiums/doorman-block-data";
import { loadGeneralCondoPanelData, type GeneralCondoPanelData } from "@/lib/condominiums/general-condo-data";
import { serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

export type DoormanOperationalPanel =
  | { mode: "granja"; panel: GeneralCondoPanelData }
  | { mode: "block"; panel: DoormanBlockPanelData }
  | { mode: "single" };

export async function resolveDoormanOperationalPanel(
  condoSlug: string,
): Promise<ServiceResult<DoormanOperationalPanel>> {
  if (isGeneralCondominium(condoSlug)) {
    const panelResult = await loadGeneralCondoPanelData();
    if (!panelResult.ok) {
      return serviceError(panelResult.error);
    }

    return serviceOk({ mode: "granja", panel: panelResult.data });
  }

  const blockResult = await loadDoormanBlockPanelData(condoSlug);
  if (!blockResult.ok) {
    return serviceError(blockResult.error);
  }

  if (blockResult.data) {
    return serviceOk({ mode: "block", panel: blockResult.data });
  }

  return serviceOk({ mode: "single" });
}

export function getOperationalCondominiumIds(panel: DoormanOperationalPanel, fallbackId: string): string[] {
  if (panel.mode === "granja") {
    return panel.panel.condominiums
      .filter((condominium) => !isGeneralCondominium(condominium.slug))
      .map((condominium) => condominium.id);
  }

  if (panel.mode === "block") {
    return panel.panel.condominiums.map((condominium) => condominium.id);
  }

  return [fallbackId];
}
