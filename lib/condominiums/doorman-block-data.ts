import { formatCondominiumDisplayName, isGeneralCondominium } from "@/lib/condominiums/display";
import {
  getCondominiumsInDoormanBlock,
  getDoormanBlockForCondominium,
  type DoormanBlockDefinition,
} from "@/lib/condominiums/doorman-blocks";
import type { CondominiumRecord } from "@/lib/services/condominiums-admin";
import type { UnitWithTower } from "@/lib/services/units";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

export type DoormanBlockPanelData = {
  block: DoormanBlockDefinition;
  condominiums: CondominiumRecord[];
  units: UnitWithTower[];
  condominiumNamesById: Record<string, string>;
};

type UnitRow = {
  id: string;
  tower_id: string;
  number: string;
  block: string | null;
  created_at: string;
  updated_at: string;
  towers: {
    id: string;
    name: string;
    condominium_id: string;
  };
};

function mapUnitRow(row: UnitRow): UnitWithTower {
  return {
    id: row.id,
    tower_id: row.tower_id,
    number: row.number,
    block: row.block,
    created_at: row.created_at,
    updated_at: row.updated_at,
    tower: row.towers,
  };
}

export async function loadDoormanBlockPanelData(
  condoSlug: string,
): Promise<ServiceResult<DoormanBlockPanelData | null>> {
  if (isGeneralCondominium(condoSlug)) {
    return serviceOk(null);
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("condominiums")
      .select("id, name, slug, is_commercial, created_at, updated_at")
      .order("name", { ascending: true });

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    const allCondominiums: CondominiumRecord[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      is_commercial: row.is_commercial ?? false,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    const currentCondominium = allCondominiums.find((condominium) => condominium.slug === condoSlug);
    if (!currentCondominium) {
      return serviceError("Condomínio não encontrado.");
    }

    const block = getDoormanBlockForCondominium(currentCondominium);
    if (!block) {
      return serviceOk(null);
    }

    const condominiums = getCondominiumsInDoormanBlock(block, allCondominiums);
    if (condominiums.length === 0) {
      return serviceOk(null);
    }

    const condominiumIds = condominiums.map((condominium) => condominium.id);
    const { data: unitRows, error: unitsError } = await admin
      .from("units")
      .select(
        `
        id,
        tower_id,
        number,
        block,
        created_at,
        updated_at,
        towers!inner (
          id,
          name,
          condominium_id
        )
      `,
      )
      .in("towers.condominium_id", condominiumIds)
      .order("number", { ascending: true });

    if (unitsError) {
      return serviceError(mapSupabaseError(unitsError));
    }

    const units = ((unitRows as UnitRow[] | null) ?? []).map(mapUnitRow);
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
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao carregar painel do bloco.",
    );
  }
}

export async function getDoormanBlockCondominiumIds(condoSlug: string): Promise<string[]> {
  const panelResult = await loadDoormanBlockPanelData(condoSlug);
  if (!panelResult.ok || !panelResult.data) {
    return [];
  }

  return panelResult.data.condominiums.map((condominium) => condominium.id);
}
