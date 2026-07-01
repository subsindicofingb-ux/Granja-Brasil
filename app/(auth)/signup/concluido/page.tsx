import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SignOutForm } from "@/components/auth/sign-out-form";
import {
  SIGNUP_WELCOME_FOOTNOTE,
  SIGNUP_WELCOME_MESSAGE,
  SIGNUP_WELCOME_TITLE,
} from "@/lib/auth/signup-success";
import { getAuthUser } from "@/lib/auth/session";
import { BRAND_TAGLINE } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SignUpCompletePage() {
  const user = await getAuthUser();

  if (user) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // Limpa a sessão local na próxima navegação, se necessário.
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <BrandLogo href="/" size="lg" className="items-start text-left" />
        <div>
          <h2 className="text-3xl font-bold leading-tight">{SIGNUP_WELCOME_TITLE}</h2>
          <p className="mt-4 max-w-md text-sidebar-foreground/70">{SIGNUP_WELCOME_MESSAGE}</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} Granja Brasil</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="mb-6 lg:hidden">
          <BrandLogo size="hero" showTagline priority />
        </div>

        <Card className="w-full max-w-md shadow-sm">
          <CardHeader className="text-center">
            <CardTitle>{SIGNUP_WELCOME_TITLE}</CardTitle>
            <CardDescription>{SIGNUP_WELCOME_MESSAGE}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
              {SIGNUP_WELCOME_FOOTNOTE}
            </div>

            <div className="grid gap-2">
              <Button asChild className="w-full">
                <Link href="/login">Ir para o login</Link>
              </Button>
              <SignOutForm>
                <Button variant="outline" type="submit" className="w-full">
                  Fechar
                </Button>
              </SignOutForm>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground lg:hidden">{BRAND_TAGLINE}</p>
      </div>
    </div>
  );
}
