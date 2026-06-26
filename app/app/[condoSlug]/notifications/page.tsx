import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { requireCondoPermission } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { listUnitNotificationsForContext } from "@/lib/services/notifications";
import { NotificationCard } from "@/components/notifications/notification-card";
import { ErrorAlert } from "@/components/shared/feedback";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";

interface NotificationsPageProps {
  params: Promise<{ condoSlug: string }>;
}

async function NotificationsContent({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canSendUnitNotifications || ctx.permissions.canViewUnitNotifications,
  );

  const canSend = access.permissions.canSendUnitNotifications;
  const canView = access.permissions.canViewUnitNotifications;
  const isGranja = isGeneralCondominium(condoSlug);

  const [sentResult, receivedResult] = await Promise.all([
    canSend
      ? listUnitNotificationsForContext({
          profileId: access.profile.id,
          sourceCondominiumId: access.condominium.id,
        })
      : Promise.resolve({ ok: true as const, data: [] }),
    canView
      ? listUnitNotificationsForContext({
          profileId: access.profile.id,
          recipientOnly: true,
        })
      : Promise.resolve({ ok: true as const, data: [] }),
  ]);

  if (!sentResult.ok) {
    return <ErrorAlert message={sentResult.error} title="Erro ao carregar notificações" />;
  }

  if (!receivedResult.ok) {
    return <ErrorAlert message={receivedResult.error} title="Erro ao carregar notificações" />;
  }

  const sent = sentResult.data;
  const received = receivedResult.data;

  if (!canSend && received.length === 0) {
    return (
      <EmptyState
        title="Nenhuma notificação"
        description="Você receberá aqui as notificações formais enviadas à sua unidade."
      />
    );
  }

  if (canSend && sent.length === 0 && received.length === 0) {
    return (
      <EmptyState
        title="Nenhuma notificação enviada"
        description="Envie notificações formais para unidades, com anexo de comprovação quando necessário."
        action={
          <Button asChild>
            <Link href={`/app/${condoSlug}/notifications/new`}>Nova notificação</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      {canView && received.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Recebidas</h2>
          <div className="space-y-3">
            {received.map((notification) => (
              <NotificationCard
                key={notification.id}
                condoSlug={condoSlug}
                notification={notification}
                showSource
                showUnreadBadge
              />
            ))}
          </div>
        </section>
      )}

      {canSend && sent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{canView ? "Enviadas" : "Notificações"}</h2>
          <div className="space-y-3">
            {sent.map((notification) => (
              <NotificationCard
                key={notification.id}
                condoSlug={condoSlug}
                notification={notification}
                showSource={isGranja}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default async function NotificationsPage({ params }: NotificationsPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canSendUnitNotifications || ctx.permissions.canViewUnitNotifications,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificações"
        description={
          access.permissions.canSendUnitNotifications
            ? "Notificações formais para unidades, entregues ao morador responsável."
            : "Notificações formais recebidas pela sua unidade."
        }
        action={
          access.permissions.canSendUnitNotifications ? (
            <Button asChild>
              <Link href={`/app/${condoSlug}/notifications/new`}>
                <Plus className="h-4 w-4" />
                Nova notificação
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}>
        <NotificationsContent condoSlug={condoSlug} />
      </Suspense>
    </div>
  );
}
