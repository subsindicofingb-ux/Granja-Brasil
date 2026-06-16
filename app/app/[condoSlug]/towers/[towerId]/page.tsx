import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { getTowerById } from "@/lib/services/towers";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { TowerForm } from "@/components/towers/tower-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TowerDetailPageProps {
  params: Promise<{ condoSlug: string; towerId: string }>;
}

export default async function TowerDetailPage({ params }: TowerDetailPageProps) {
  const { condoSlug, towerId } = await params;
  const access = await requireCondoAccess(condoSlug);
  const result = await getTowerById(towerId, access.condominium.id);

  if (result.error) {
    if (result.error.includes("não encontrada")) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={result.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/towers`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const tower = result.data;
  const canEdit = access.permissions.canManageStructure;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title={tower.name}
        description={canEdit ? "Edite os dados da torre." : "Detalhes da torre."}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {canEdit ? "Editar torre" : "Informações"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <TowerForm
              condoSlug={condoSlug}
              mode="edit"
              defaultValues={{
                towerId: tower.id,
                name: tower.name,
                floors: tower.floors,
              }}
            />
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium">{tower.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Andares</span>
                <span className="font-medium">{tower.floors}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <Link href={`/app/${condoSlug}/towers`}>Voltar</Link>
      </Button>
    </div>
  );
}
