import Link from "next/link";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import { formatUnitWithTower } from "@/lib/residents/labels";
import type { UnitNotificationWithDetails } from "@/lib/notifications/types";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

interface NotificationCardProps {
  condoSlug: string;
  notification: UnitNotificationWithDetails;
  showSource?: boolean;
  showUnreadBadge?: boolean;
}

export function NotificationCard({
  condoSlug,
  notification,
  showSource = false,
  showUnreadBadge = false,
}: NotificationCardProps) {
  const isUnread = showUnreadBadge && !notification.read_at;

  return (
    <Link
      href={`/app/${condoSlug}/notifications/${notification.id}`}
      className="block rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{notification.title}</h3>
            {isUnread && <Badge>Nova</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(notification.created_at)}
            {notification.author && ` · ${notification.author.full_name}`}
          </p>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{notification.body}</p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {showSource && (
          <span>
            De:{" "}
            {formatCondominiumDisplayName(
              notification.source_condominium.name,
              notification.source_condominium.slug,
            )}
          </span>
        )}
        <span>
          Para:{" "}
          {formatCondominiumDisplayName(
            notification.target_condominium.name,
            notification.target_condominium.slug,
          )}
        </span>
        <span>Unidade: {formatUnitWithTower(notification.target_unit)}</span>
        {notification.attachment_url && <span>Com anexo</span>}
      </div>
    </Link>
  );
}
