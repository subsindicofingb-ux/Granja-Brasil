import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { getResidentById } from "@/lib/services/residents";
import { listUnitsByCondominium } from "@/lib/services/units";
import { getResidentTypeLabel, formatUnitWithTower } from "@/lib/residents/labels";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { ResidentForm } from "@/components/residents/resident-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ResidentDetailPageProps {
  params: Promise<{ condoSlug: string; residentId: string }>;
}

export default async function ResidentDetailPage({ params }: ResidentDetailPageProps) {
  const { condoSlug, residentId } = await params;
  const access = await requireCondoAccess(condoSlug);

  const [residentResult, unitsResult] = await Promise.all([
    getResidentById(residentId, access.condominium.id),
    listUnitsByCondominium(access.condominium.id),
  ]);

  if (residentResult.error) {
    if (residentResult.error.includes("não encontrado")) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={residentResult.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/residents`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  if (unitsResult.error) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={unitsResult.error} title="Erro ao carregar unidades" />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/residents`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const resident = residentResult.data;
  const canEdit = access.permissions.canManageResidents;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title={resident.full_name}
        description={canEdit ? "Edite os dados do morador." : "Detalhes do morador."}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {canEdit ? "Editar morador" : "Informações"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <ResidentForm
              condoSlug={condoSlug}
              units={unitsResult.data}
              mode="edit"
              defaultValues={{
                residentId: resident.id,
                unitId: resident.unit_id,
                fullName: resident.full_name,
                email: resident.email,
                phone: resident.phone,
                type: resident.type,
              }}
            />
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Unidade</span>
                <span className="text-right font-medium">
                  {formatUnitWithTower(resident.unit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <Badge className="border bg-background">
                  {getResidentTypeLabel(resident.type)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">E-mail</span>
                <span className="font-medium">{resident.email ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Telefone</span>
                <span className="font-medium">{resident.phone ?? "—"}</span>
              </div>
              {resident.profile_id && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Conta vinculada</span>
                  <span className="font-medium text-green-700">Sim</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <Link href={`/app/${condoSlug}/residents`}>Voltar</Link>
      </Button>
    </div>
  );
}
