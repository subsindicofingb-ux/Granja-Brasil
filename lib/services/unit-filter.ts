import type { UnitListFilter } from "@/lib/auth/unit-scope";

type FilterableQuery = {
  eq: (column: string, value: string) => FilterableQuery;
  in: (column: string, values: string[]) => FilterableQuery;
};

export function applyUnitListFilter<T extends FilterableQuery>(
  query: T,
  filter: UnitListFilter | "none",
  column = "unit_id",
): T | null {
  if (filter === "none") {
    return null;
  }

  if (filter.unitId) {
    return query.eq(column, filter.unitId) as T;
  }

  if (filter.unitIds) {
    return query.in(column, filter.unitIds) as T;
  }

  return query as T;
}
