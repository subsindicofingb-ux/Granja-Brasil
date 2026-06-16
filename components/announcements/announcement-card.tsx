import Link from "next/link";
import type { AnnouncementWithDetails } from "@/lib/announcements/types";
import { getAnnouncementDisplayStatus } from "@/lib/announcements/status";
import {
  getAnnouncementPriorityBadgeClass,
  getAnnouncementPriorityLabel,
} from "@/lib/announcements/labels";
import { AnnouncementDisplayStatusBadge } from "@/components/announcements/announcement-display-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface AnnouncementCardProps {
  condoSlug: string;
  announcement: AnnouncementWithDetails;
  canManage: boolean;
}

export function AnnouncementCard({ condoSlug, announcement, canManage }: AnnouncementCardProps) {
  const displayStatus = getAnnouncementDisplayStatus(announcement);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">
            <Link
              href={`/app/${condoSlug}/announcements/${announcement.id}`}
              className="hover:underline"
            >
              {announcement.title}
            </Link>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Publicado em {formatDateTime(announcement.published_at)}
            {announcement.author && ` · ${announcement.author.full_name}`}
            {announcement.tower && ` · ${announcement.tower.name}`}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge className={getAnnouncementPriorityBadgeClass(announcement.priority)}>
            {getAnnouncementPriorityLabel(announcement.priority)}
          </Badge>
          <AnnouncementDisplayStatusBadge status={displayStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="line-clamp-3 text-sm text-muted-foreground">{announcement.body}</p>
        {canManage && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/${condoSlug}/announcements/${announcement.id}`}>Editar</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
