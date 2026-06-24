import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SignUpForm } from "@/components/auth/signup-form";
import { getUserMemberships } from "@/lib/auth/access";
import { getAuthUser, isSuperAdmin } from "@/lib/auth/session";
import { BRAND_TAGLINE } from "@/lib/brand";
import { listPublicCondominiums } from "@/lib/services/registration-requests";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SignUpPage() {
  const condosResult = await listPublicCondominiums();
  const condominiums = condosResult.ok ? (condosResult.data ?? []) : [];
  const user = await getAuthUser();

  let oauthUser: { email: string; fullName: string } | null = null;

  if (user?.email) {
    const memberships = await getUserMemberships();
    const superAdmin = await isSuperAdmin();

    if (memberships.length > 0 || superAdmin) {
      redirect("/app");
    }

    oauthUser = {
      email: user.email,
      fullName:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        user.email.split("@")[0] ??
        "",
    };
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <BrandLogo href="/" size="lg" className="items-start text-left" />
        <div>
          <h2 className="text-3xl font-bold leading-tight">Crie sua conta</h2>
          <p className="mt-4 max-w-md text-sidebar-foreground/70">
            Escolha o condomínio e informe sua unidade. O responsável receberá sua solicitação e
            liberará o acesso após aprovação.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} Granja Brasil</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="mb-6 lg:hidden">
          <BrandLogo size="hero" showTagline priority />
        </div>
        <Card className="w-full max-w-md shadow-sm">
          <CardHeader>
            <CardTitle>{oauthUser ? "Concluir cadastro" : "Criar conta"}</CardTitle>
            <CardDescription>
              {oauthUser
                ? "Complete sua pré-qualificação para solicitar acesso ao condomínio."
                : "Cadastre-se com Google ou e-mail, senha e pré-qualificação do seu condomínio."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignUpForm condominiums={condominiums} oauthUser={oauthUser} />
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground lg:hidden">{BRAND_TAGLINE}</p>
      </div>
    </div>
  );
}
