"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

export default function AppError({
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
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6">
      <ErrorAlert
        title="Erro ao carregar o painel"
        message={
          error.message ||
          "Verifique se o Supabase está configurado na Vercel e se as migrations foram aplicadas com supabase db push."
        }
      />
      {error.digest && (
        <p className="text-xs text-muted-foreground">Digest: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Tentar novamente
        </Button>
        <Button asChild>
          <Link href="/login">Ir para login</Link>
        </Button>
      </div>
    </div>
  );
}
