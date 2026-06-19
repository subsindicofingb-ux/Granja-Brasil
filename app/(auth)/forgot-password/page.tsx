import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { BRAND_TAGLINE } from "@/lib/brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <BrandLogo href="/" size="lg" className="items-start text-left" />
        <div>
          <h2 className="text-3xl font-bold leading-tight">Recupere o acesso à sua conta.</h2>
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
            <CardTitle>Esqueci a senha</CardTitle>
            <CardDescription>
              Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ForgotPasswordForm />
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
