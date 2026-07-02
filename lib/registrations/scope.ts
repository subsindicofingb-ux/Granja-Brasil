import { isGeneralCondominium } from "@/lib/condominiums/display";
import { getGranjaChildCondominiumIds } from "@/lib/condominiums/granja-scope";
import { loadDoormanBlockPanelData } from "@/lib/condominiums/doorman-block-data";

export async function getRegistrationScopeCondominiumIds(input: {
  condoSlug: string;
  condominiumId: string;
}): Promise<string[]> {
  const blockResult = await loadDoormanBlockPanelData(input.condoSlug);

  if (blockResult.ok && blockResult.data) {
    return blockResult.data.condominiums.map((condominium) => condominium.id);
  }

  if (isGeneralCondominium(input.condoSlug)) {
    const childIdsResult = await getGranjaChildCondominiumIds();
    if (childIdsResult.ok && childIdsResult.data.length > 0) {
      return childIdsResult.data;
    }
  }

  return [input.condominiumId];
}
