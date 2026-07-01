"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { markAppSessionTab } from "@/lib/auth/session-tab";

function TabSessionRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    markAppSessionTab();

    const next = searchParams.get("next");
    const destination =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

    router.replace(destination);
  }, [router, searchParams]);

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
