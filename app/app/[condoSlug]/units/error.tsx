"use client";

import { useEffect } from "react";
import { ErrorAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

export default function UnitsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4">
      <ErrorAlert
        message={error.message || "Ocorreu um erro inesperado ao carregar as unidades."}
      />
      <Button variant="outline" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
