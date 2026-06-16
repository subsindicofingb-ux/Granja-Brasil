import { Building2 } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect: redirectTo, error } = await searchParams;

  const errorMessage =
    error === "config"
      ? "Supabase não configurado. Na Vercel, adicione NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em Settings → Environment Variables e faça redeploy."
      : error === "callback"
        ? "Não foi possível concluir a autenticação. Tente novamente."
        : null;

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2 font-semibold">
          <Building2 className="h-5 w-5" />
          Condomínio SaaS
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            Administre seu condomínio com clareza e controle.
          </h2>
          <p className="mt-4 max-w-md text-sidebar-foreground/70">
            Acesso seguro com Supabase Auth. Seu vínculo ao condomínio é controlado por
            memberships e RLS.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          © {new Date().getFullYear()} Condomínio SaaS
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              Use e-mail e senha para acessar o painel administrativo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {errorMessage}
              </div>
            )}
            <LoginForm redirectTo={redirectTo ?? "/app"} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
