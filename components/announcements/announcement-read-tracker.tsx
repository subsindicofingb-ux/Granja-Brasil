"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { markAnnouncementViewedAction } from "@/lib/actions/announcements";

type AnnouncementReadTrackerProps = {
  condoSlug: string;
  announcementId: string;
};

export function AnnouncementReadTracker({
  condoSlug,
  announcementId,
}: AnnouncementReadTrackerProps) {
  const router = useRouter();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }

    trackedRef.current = true;

    void markAnnouncementViewedAction(condoSlug, announcementId).then((result) => {
      if (result.ok) {
        router.refresh();
      }
    });
  }, [condoSlug, announcementId, router]);

  return null;
}
