"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { markAppSessionTab } from "@/lib/auth/session-tab";

function TabSessionRedirect() {
  const searchParams = useSearchParams();

  useEffect(() => {
    markAppSessionTab();

    const next = searchParams.get("next");
    const destination =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

    window.location.assign(destination);
  }, [searchParams]);

  return (
    <p className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Preparando acesso...
    </p>
  );
}

export default function TabSessionPage() {
  return (
    <Suspense
      fallback={
        <p className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Preparando acesso...
        </p>
      }
    >
      <TabSessionRedirect />
    </Suspense>
  );
}
