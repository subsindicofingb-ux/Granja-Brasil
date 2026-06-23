import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireCondoAccess } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { listAnnouncementsByCondominium, getAnnouncementUnreadState } from "@/lib/services/announcements";
import { listCondominiums } from "@/lib/services/condominiums-admin";
import { listTowersByCondominium } from "@/lib/services/towers";
import { isValidUuid } from "@/lib/utils";
import { ErrorAlert } from "@/components/shared/feedback";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { AnnouncementCondominiumFilter } from "@/components/announcements/announcement-condominium-filter";
import { Button } from "@/components/ui/button";

interface AnnouncementsPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ tower?: string; condo?: string }>;
}

async function AnnouncementsHeader({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);
  const canCreate = access.permissions.canManageAnnouncements;

  return (
    <PageHeader
      title="Avisos"
      description="Comunicados do condomínio para moradores e portaria."
      action={
        canCreate ? (
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
  targetCondominiumId,
}: {
  condoSlug: string;
  towerId?: string;
  targetCondominiumId?: string;
}) {
  const access = await requireCondoAccess(condoSlug);
  const isGranja = isGeneralCondominium(condoSlug);

  const [towersResult, condominiumsResult, announcementsResult] = await Promise.all([
    listTowersByCondominium(access.condominium.id),
    isGranja ? listCondominiums() : Promise.resolve(null),
    listAnnouncementsByCondominium(
      {
        condominiumId: access.condominium.id,
        profileId: access.profile.id,
        isStaff: access.permissions.canManageAnnouncements,
      },
      {
        towerId,
        targetCondominiumId,
        includeCondominiumWide: towerId ? true : undefined,
      },
    ),
  ]);

  if (!towersResult.ok) {
    return <ErrorAlert message={towersResult.error} title="Erro ao carregar torres" />;
  }

  if (isGranja && condominiumsResult && !condominiumsResult.ok) {
    return <ErrorAlert message={condominiumsResult.error} title="Erro ao carregar condomínios" />;
  }

  if (!announcementsResult.ok) {
    return <ErrorAlert message={announcementsResult.error} title="Erro ao carregar avisos" />;
  }

  const towers = towersResult.data ?? [];
  const condominiums = (condominiumsResult?.ok ? condominiumsResult.data : []).filter(
    (condominium) => condominium.id !== access.condominium.id,
  );
  const announcements = announcementsResult.data ?? [];
  const unreadState = announcementsResult.ok
    ? await getAnnouncementUnreadState(
        access.profile.id,
        announcements.map((announcement) => ({
          id: announcement.id,
          created_by: announcement.created_by,
        })),
      )
    : { unreadIncomingIds: [], unreadReplyThreadIds: [] };
  const unreadIncomingSet = new Set(unreadState.unreadIncomingIds);
  const unreadReplySet = new Set(unreadState.unreadReplyThreadIds);
  const showFilter = isGranja ? condominiums.length > 0 : towers.length > 0;

  return (
    <div className="space-y-4">
      {(unreadState.unreadIncomingIds.length > 0 ||
        unreadState.unreadReplyThreadIds.length > 0) && (
        <div className="space-y-2">
          {unreadState.unreadIncomingIds.length > 0 && (
            <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-sm text-sky-950">
              <span className="font-medium">
                {unreadState.unreadIncomingIds.length} nova(s) mensagem(ns)
              </span>{" "}
              aguardando leitura.
            </div>
          )}
          {unreadState.unreadReplyThreadIds.length > 0 && (
            <div className="rounded-lg border border-purple-200 bg-purple-50/80 px-3 py-2 text-sm text-purple-950">
              <span className="font-medium">
                {unreadState.unreadReplyThreadIds.length} conversa(s) com nova resposta
              </span>{" "}
              aguardando seu retorno.
            </div>
          )}
        </div>
      )}

      {showFilter && (
        <AnnouncementCondominiumFilter
          condoSlug={condoSlug}
          mode={isGranja ? "granja" : "towers"}
          towers={towers.map((tower) => ({ id: tower.id, name: tower.name }))}
          condominiums={condominiums.map((condominium) => ({
            id: condominium.id,
            name: condominium.name,
          }))}
          selectedTower={towerId}
          selectedCondominium={targetCondominiumId}
        />
      )}

      {announcements.length === 0 ? (
        <EmptyState
          title="Nenhum aviso encontrado"
          description={
            towerId || targetCondominiumId
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
              isUnreadIncoming={unreadIncomingSet.has(announcement.id)}
              hasUnreadReply={unreadReplySet.has(announcement.id)}
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
  const { tower, condo } = await searchParams;
  const towerId = isValidUuid(tower) ? tower : undefined;
  const targetCondominiumId = isValidUuid(condo) ? condo : undefined;

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
        <AnnouncementsHeader condoSlug={condoSlug} />
      </Suspense>

      <Suspense fallback={<AnnouncementsListSkeleton />}>
        <AnnouncementsContent
          condoSlug={condoSlug}
          towerId={towerId}
          targetCondominiumId={targetCondominiumId}
        />
      </Suspense>
    </div>
  );
}
