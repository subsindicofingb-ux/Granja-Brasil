import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { listTowersByCondominium } from "@/lib/services/towers";
import { getUnitById } from "@/lib/services/units";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { UnitForm } from "@/components/units/unit-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UnitDetailPageProps {
  params: Promise<{ condoSlug: string; unitId: string }>;
}

export default async function UnitDetailPage({ params }: UnitDetailPageProps) {
  const { condoSlug, unitId } = await params;
  const access = await requireCondoAccess(condoSlug);

  const [unitResult, towersResult] = await Promise.all([
    getUnitById(unitId, access.condominium.id),
    listTowersByCondominium(access.condominium.id),
  ]);

  if (!unitResult.ok) {
    if (unitResult.error.includes("não encontrada")) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={unitResult.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/units`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  if (!towersResult.ok) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={towersResult.error} title="Erro ao carregar torres" />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/units`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const unit = unitResult.data;
  const towers = towersResult.data.map((tower) => ({ id: tower.id, name: tower.name }));
  const canEdit = access.permissions.canManageStructure;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title={`Unidade ${unit.number}`}
        description={`${unit.tower.name}${unit.block ? ` · Bloco ${unit.block}` : ""}`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {canEdit ? "Editar unidade" : "Informações"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <UnitForm
              condoSlug={condoSlug}
              condoName={access.condominium.name}
              towers={towers}
              mode="edit"
              defaultValues={{
                unitId: unit.id,
                towerId: unit.tower_id,
                number: unit.number,
                block: unit.block,
              }}
            />
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Número</span>
                <span className="font-medium">{unit.number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Torre</span>
                <span className="font-medium">{unit.tower.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bloco</span>
                <span className="font-medium">{unit.block ?? "—"}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <Link href={`/app/${condoSlug}/units`}>Voltar</Link>
      </Button>
    </div>
  );
}
