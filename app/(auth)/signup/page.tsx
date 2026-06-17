import { BrandLogo } from "@/components/brand/brand-logo";
import { SignUpForm } from "@/components/auth/signup-form";
import { BRAND_TAGLINE } from "@/lib/brand";
import { listPublicCondominiums } from "@/lib/services/registration-requests";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SignUpPage() {
  const condosResult = await listPublicCondominiums();
  const condominiums = condosResult.ok ? (condosResult.data ?? []) : [];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <BrandLogo href="/" size="lg" className="items-start text-left" />
        <div>
          <h2 className="text-3xl font-bold leading-tight">Crie sua conta</h2>
          <p className="mt-4 max-w-md text-sidebar-foreground/70">
            Escolha o condomínio e a unidade ou casa cadastrada. O síndico receberá sua solicitação
            e liberará o acesso após aprovação.
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
            <CardTitle>Criar conta</CardTitle>
            <CardDescription>
              Cadastro com e-mail, senha e pré-qualificação do seu condomínio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignUpForm condominiums={condominiums} />
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground lg:hidden">{BRAND_TAGLINE}</p>
      </div>
    </div>
  );
}
