import { loadDoormanBlockPanelData } from "@/lib/condominiums/doorman-block-data";

export async function getRegistrationScopeCondominiumIds(input: {
  condoSlug: string;
  condominiumId: string;
}): Promise<string[]> {
  const blockResult = await loadDoormanBlockPanelData(input.condoSlug);

  if (blockResult.ok && blockResult.data) {
    return blockResult.data.condominiums.map((condominium) => condominium.id);
  }

  return [input.condominiumId];
}
