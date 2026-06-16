import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCondoAccess } from "@/lib/auth/access";
import { listTowersByCondominium } from "@/lib/services/towers";
import { ErrorAlert } from "@/components/shared/feedback";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/shared/loading-skeleton";

interface TowersPageProps {
  params: Promise<{ condoSlug: string }>;
}

async function TowersContent({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);
  const result = await listTowersByCondominium(access.condominium.id);

  if (!result.ok) {
    return <ErrorAlert message={result.error} />;
  }

  const towers = result.data;

  if (towers.length === 0) {
    return (
      <EmptyState
        title="Nenhuma torre cadastrada"
        description="Comece cadastrando a primeira torre ou bloco deste condomínio."
        action={
          access.permissions.canManageStructure ? (
            <Button asChild>
              <Link href={`/app/${condoSlug}/towers/new`}>
                <Plus className="h-4 w-4" />
                Nova torre
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Nome</th>
            <th className="px-4 py-3 text-left font-medium">Andares</th>
            <th className="px-4 py-3 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {towers.map((tower) => (
            <tr key={tower.id} className="border-b last:border-0">
              <td className="px-4 py-3 font-medium">{tower.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{tower.floors}</td>
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/app/${condoSlug}/towers/${tower.id}`}>
                    {access.permissions.canManageStructure ? "Editar" : "Detalhes"}
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function TowersHeader({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);

  return (
    <PageHeader
      title="Torres"
      description="Gerencie as torres ou blocos do condomínio."
      action={
        access.permissions.canManageStructure ? (
          <Button asChild>
            <Link href={`/app/${condoSlug}/towers/new`}>
              <Plus className="h-4 w-4" />
              Nova torre
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}

export default async function TowersPage({ params }: TowersPageProps) {
  const { condoSlug } = await params;

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
        <TowersHeader condoSlug={condoSlug} />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={4} cols={3} />}>
        <TowersContent condoSlug={condoSlug} />
      </Suspense>
    </div>
  );
}
