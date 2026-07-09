import { BrandLogo } from "@/components/brand/brand-logo";
import { LoginSessionGuard } from "@/components/auth/session-tab-guard";
import { BRAND_TAGLINE } from "@/lib/brand";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string; error?: string; reset?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect: redirectTo, error, reset } = await searchParams;

  const errorMessage =
    error === "config"
      ? "Supabase não configurado. Na Vercel, adicione NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em Settings → Environment Variables e faça redeploy."
      : error === "callback"
        ? "Não foi possível concluir a autenticação. Tente novamente."
        : null;
  const successMessage = reset === "success" ? "Senha atualizada com sucesso. Entre com a nova senha." : null;

  return (
    <LoginSessionGuard>
      <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <BrandLogo href="/" size="lg" className="items-start text-left" />
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            Administre seu condomínio com clareza e controle.
          </h2>
          <p className="mt-4 max-w-md text-sidebar-foreground/70">{BRAND_TAGLINE}</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} Granja Brasil</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="mb-6 lg:hidden">
          <BrandLogo size="hero" showTagline priority />
        </div>
        <Card className="w-full max-w-md shadow-sm">
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              Entre com Google ou use e-mail e senha para acessar o painel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {successMessage && (
              <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {successMessage}
              </div>
            )}
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
    </LoginSessionGuard>
  );
}
