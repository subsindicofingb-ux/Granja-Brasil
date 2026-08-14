import Link from "next/link";
import type { UnitWithTower } from "@/lib/services/units";
import type { UnitListSection } from "@/lib/units/list-sections";
import {
  MobileRecordCard,
  MobileRecordRow,
  ResponsiveRecords,
} from "@/components/shared/responsive-records";
import { Button } from "@/components/ui/button";

export type UnitsSummaryMode = "none" | "total" | "granja";

interface UnitsRecordsListProps {
  units: UnitWithTower[];
  condoSlug: string;
  canManageStructure: boolean;
  getUnitCondoSlug: (unit: UnitWithTower) => string;
  getBlockLabel: (unit: UnitWithTower) => string;
  summaryMode: UnitsSummaryMode;
  sections?: UnitListSection[];
}

function unitActionLabel(canManageStructure: boolean) {
  return canManageStructure ? "Editar" : "Detalhes";
}

function UnitMobileCard({
  unit,
  condoSlug,
  canManageStructure,
  getUnitCondoSlug,
  getBlockLabel,
}: Pick<
  UnitsRecordsListProps,
  "condoSlug" | "canManageStructure" | "getUnitCondoSlug" | "getBlockLabel"
> & { unit: UnitWithTower }) {
  return (
    <MobileRecordCard key={unit.id}>
      <p className="min-w-0 text-base font-semibold leading-snug">{unit.number}</p>
      <MobileRecordRow label="Torre">{unit.tower.name}</MobileRecordRow>
      <MobileRecordRow label="Bloco">{getBlockLabel(unit)}</MobileRecordRow>
      <Button className="mt-1 min-h-11 w-full" variant="outline" asChild>
        <Link href={`/app/${getUnitCondoSlug(unit) || condoSlug}/units/${unit.id}`}>
          {unitActionLabel(canManageStructure)}
        </Link>
      </Button>
    </MobileRecordCard>
  );
}

function UnitDesktopRow({
  unit,
  condoSlug,
  canManageStructure,
  getUnitCondoSlug,
  getBlockLabel,
}: Pick<
  UnitsRecordsListProps,
  "condoSlug" | "canManageStructure" | "getUnitCondoSlug" | "getBlockLabel"
> & { unit: UnitWithTower }) {
  return (
    <tr key={unit.id} className="border-b">
      <td className="px-4 py-3 font-medium">{unit.number}</td>
      <td className="px-4 py-3 text-muted-foreground">{unit.tower.name}</td>
      <td className="px-4 py-3 text-muted-foreground">{getBlockLabel(unit)}</td>
      <td className="px-4 py-3 text-right">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/${getUnitCondoSlug(unit) || condoSlug}/units/${unit.id}`}>
            {unitActionLabel(canManageStructure)}
          </Link>
        </Button>
      </td>
    </tr>
  );
}

function SubtotalDesktopRow({ label, count }: { label: string; count: number }) {
  return (
    <tr className="border-b bg-muted/30">
      <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">
        Total parcial — {label}: {count} {count === 1 ? "unidade" : "unidades"}
      </td>
    </tr>
  );
}

function TotalDesktopRow({ label, count, emphasized = false }: { label: string; count: number; emphasized?: boolean }) {
  return (
    <tr className={emphasized ? "bg-muted/50" : "bg-muted/30"}>
      <td
        colSpan={4}
        className={`px-4 py-3 text-right ${emphasized ? "text-base font-semibold" : "text-sm font-medium text-muted-foreground"}`}
      >
        {label}: {count} {count === 1 ? "unidade" : "unidades"}
      </td>
    </tr>
  );
}

function MobileSubtotal({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground">
      Total parcial — {label}: {count} {count === 1 ? "unidade" : "unidades"}
    </div>
  );
}

function MobileTotal({ label, count, emphasized = false }: { label: string; count: number; emphasized?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${emphasized ? "bg-muted/50 text-base font-semibold" : "bg-muted/30 text-sm font-medium text-muted-foreground"}`}
    >
      {label}: {count} {count === 1 ? "unidade" : "unidades"}
    </div>
  );
}

export function UnitsRecordsList({
  units,
  condoSlug,
  canManageStructure,
  getUnitCondoSlug,
  getBlockLabel,
  summaryMode,
  sections = [],
}: UnitsRecordsListProps) {
  const sharedRowProps = {
    condoSlug,
    canManageStructure,
    getUnitCondoSlug,
    getBlockLabel,
  };

  const mobileContent =
    summaryMode === "granja" && sections.length > 0
      ? sections.flatMap((section) => [
          ...section.units.map((unit) => (
            <UnitMobileCard key={unit.id} unit={unit} {...sharedRowProps} />
          )),
          <MobileSubtotal key={`subtotal-${section.key}`} label={section.label} count={section.units.length} />,
        ])
      : units.map((unit) => <UnitMobileCard key={unit.id} unit={unit} {...sharedRowProps} />);

  if (summaryMode === "total" || summaryMode === "granja") {
    mobileContent.push(
      <MobileTotal
        key="total-geral"
        label={summaryMode === "granja" ? "Total geral" : "Total de unidades"}
        count={units.length}
        emphasized={summaryMode === "granja"}
      />,
    );
  }

  const desktopBody =
    summaryMode === "granja" && sections.length > 0
      ? sections.flatMap((section) => [
          ...section.units.map((unit) => (
            <UnitDesktopRow key={unit.id} unit={unit} {...sharedRowProps} />
          )),
          <SubtotalDesktopRow key={`subtotal-${section.key}`} label={section.label} count={section.units.length} />,
        ])
      : units.map((unit) => <UnitDesktopRow key={unit.id} unit={unit} {...sharedRowProps} />);

  return (
    <ResponsiveRecords
      mobile={mobileContent}
      desktop={
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Número</th>
                <th className="px-4 py-3 text-left font-medium">Torre</th>
                <th className="px-4 py-3 text-left font-medium">Bloco</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {desktopBody}
              {(summaryMode === "total" || summaryMode === "granja") && (
                <TotalDesktopRow
                  label={summaryMode === "granja" ? "Total geral" : "Total de unidades"}
                  count={units.length}
                  emphasized={summaryMode === "granja"}
                />
              )}
            </tbody>
          </table>
        </div>
      }
    />
  );
}
