"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function NotificationViewTracker() {
  const router = useRouter();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }

    trackedRef.current = true;
    router.refresh();
  }, [router]);

  return null;
}
