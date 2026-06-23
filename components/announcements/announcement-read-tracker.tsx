"use client";

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
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }

    trackedRef.current = true;
    void markAnnouncementViewedAction(condoSlug, announcementId);
  }, [condoSlug, announcementId]);

  return null;
}
