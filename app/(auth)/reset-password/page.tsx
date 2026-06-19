import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { BRAND_TAGLINE } from "@/lib/brand";
import { getAuthUser } from "@/lib/auth/session";
import { setPendingPasswordReset } from "@/lib/auth/password-reset";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ResetPasswordPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/forgot-password");
  }

  await setPendingPasswordReset();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <BrandLogo href="/" size="lg" className="items-start text-left" />
        <div>
          <h2 className="text-3xl font-bold leading-tight">Defina uma nova senha.</h2>
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
            <CardTitle>Nova senha</CardTitle>
            <CardDescription>Escolha uma senha com pelo menos 6 caracteres.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm />
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
