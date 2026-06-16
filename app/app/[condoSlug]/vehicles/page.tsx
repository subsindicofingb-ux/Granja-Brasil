import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { requireCondoAccess } from "@/lib/auth/access";
import { listVehiclesByCondominium } from "@/lib/services/vehicles";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { formatLicensePlate } from "@/lib/vehicles/labels";
import { ErrorAlert } from "@/components/shared/feedback";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";

interface VehiclesPageProps {
  params: Promise<{ condoSlug: string }>;
}

async function VehiclesHeader({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);

  return (
    <PageHeader
      title="Veículos"
      description="Cadastro de veículos com placa, TAG de acesso e foto."
      action={
        access.permissions.canManageVehicles ? (
          <Button asChild>
            <Link href={`/app/${condoSlug}/vehicles/new`}>
              <Plus className="h-4 w-4" />
              Novo veículo
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}

async function VehiclesContent({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);
  const vehiclesResult = await listVehiclesByCondominium(access.condominium.id);

  if (!vehiclesResult.ok) {
    return <ErrorAlert message={vehiclesResult.error} title="Erro ao carregar veículos" />;
  }

  const vehicles = vehiclesResult.data;

  if (vehicles.length === 0) {
    return (
      <EmptyState
        title="Nenhum veículo cadastrado"
        description="Registre veículos com placa, número da TAG e foto para controle de acesso."
        action={
          access.permissions.canManageVehicles ? (
            <Button asChild>
              <Link href={`/app/${condoSlug}/vehicles/new`}>Cadastrar veículo</Link>
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
            <th className="px-4 py-3 text-left font-medium">Foto</th>
            <th className="px-4 py-3 text-left font-medium">Veículo</th>
            <th className="px-4 py-3 text-left font-medium">Placa</th>
            <th className="px-4 py-3 text-left font-medium">TAG</th>
            <th className="px-4 py-3 text-left font-medium">Unidade</th>
            <th className="px-4 py-3 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle) => (
            <tr key={vehicle.id} className="border-b last:border-0">
              <td className="px-4 py-3">
                {vehicle.photo_url ? (
                  <div className="relative h-10 w-10 overflow-hidden rounded-md border bg-muted">
                    <Image
                      src={vehicle.photo_url}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3 font-medium">
                {vehicle.brand} {vehicle.model}
                {vehicle.color ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {vehicle.color}
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3">{formatLicensePlate(vehicle.license_plate)}</td>
              <td className="px-4 py-3 text-muted-foreground">{vehicle.tag_number ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatUnitWithTower(vehicle.unit)}
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/app/${condoSlug}/vehicles/${vehicle.id}`}>
                    {access.permissions.canManageVehicles ? "Editar" : "Detalhes"}
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

export default async function VehiclesPage({ params }: VehiclesPageProps) {
  const { condoSlug } = await params;

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
        <VehiclesHeader condoSlug={condoSlug} />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={5} cols={6} />}>
        <VehiclesContent condoSlug={condoSlug} />
      </Suspense>
    </div>
  );
}
