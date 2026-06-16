"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
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
    <html lang="pt-BR">
      <body className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Erro ao carregar a aplicação</h1>
          <p className="text-sm text-muted-foreground">
            Verifique se as variáveis de ambiente do Supabase estão configuradas na Vercel e se
            o banco foi migrado com <code>supabase db push</code>.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">Digest: {error.digest}</p>
          )}
          {error.message && (
            <p className="rounded-md border bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
              {error.message}
            </p>
          )}
          <div className="flex justify-center gap-3">
            <Button onClick={() => reset()}>Tentar novamente</Button>
            <Button variant="outline" asChild>
              <Link href="/">Ir para início</Link>
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
