import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { requireCondoAccess } from "@/lib/auth/access";
import { listAnnouncementsByCondominium } from "@/lib/services/announcements";
import { listTowersByCondominium } from "@/lib/services/towers";
import { isValidUuid } from "@/lib/utils";
import { ErrorAlert } from "@/components/shared/feedback";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { AnnouncementTowerFilter } from "@/components/announcements/announcement-tower-filter";
import { Button } from "@/components/ui/button";

interface AnnouncementsPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ tower?: string }>;
}

async function AnnouncementsHeader({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);

  return (
    <PageHeader
      title="Avisos"
      description="Comunicados do condomínio para moradores e portaria."
      action={
        access.permissions.canManageAnnouncements ? (
          <Button asChild>
            <Link href={`/app/${condoSlug}/announcements/new`}>
              <Plus className="h-4 w-4" />
              Novo aviso
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}

async function AnnouncementsContent({
  condoSlug,
  towerId,
}: {
  condoSlug: string;
  towerId?: string;
}) {
  const access = await requireCondoAccess(condoSlug);

  const [towersResult, announcementsResult] = await Promise.all([
    listTowersByCondominium(access.condominium.id),
    listAnnouncementsByCondominium(access.condominium.id, {
      towerId,
      includeCondominiumWide: towerId ? true : undefined,
    }),
  ]);

  if (!towersResult.ok) {
    return <ErrorAlert message={towersResult.error} title="Erro ao carregar torres" />;
  }

  if (!announcementsResult.ok) {
    return <ErrorAlert message={announcementsResult.error} title="Erro ao carregar avisos" />;
  }

  const towers = towersResult.data ?? [];
  const announcements = announcementsResult.data ?? [];

  return (
    <div className="space-y-4">
      {towers.length > 0 && (
        <AnnouncementTowerFilter
          condoSlug={condoSlug}
          towers={towers.map((tower) => ({ id: tower.id, name: tower.name }))}
          selectedTower={towerId}
        />
      )}

      {announcements.length === 0 ? (
        <EmptyState
          title="Nenhum aviso encontrado"
          description={
            towerId
              ? "Não há avisos para o filtro selecionado."
              : "Publique o primeiro comunicado do condomínio."
          }
          action={
            access.permissions.canManageAnnouncements ? (
              <Button asChild>
                <Link href={`/app/${condoSlug}/announcements/new`}>Novo aviso</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4">
          {announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              condoSlug={condoSlug}
              announcement={announcement}
              canManage={access.permissions.canManageAnnouncements}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementsListSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-40 animate-pulse rounded-xl border bg-muted/40" />
      ))}
    </div>
  );
}

export default async function AnnouncementsPage({ params, searchParams }: AnnouncementsPageProps) {
  const { condoSlug } = await params;
  const { tower } = await searchParams;
  const towerId = isValidUuid(tower) ? tower : undefined;

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
        <AnnouncementsHeader condoSlug={condoSlug} />
      </Suspense>

      <Suspense fallback={<AnnouncementsListSkeleton />}>
        <AnnouncementsContent condoSlug={condoSlug} towerId={towerId} />
      </Suspense>
    </div>
  );
}
