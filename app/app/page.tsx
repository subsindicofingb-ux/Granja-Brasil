import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { getAccessibleCondominiums } from "@/lib/auth/access";
import { getActiveCondoSlug, setActiveCondoSlug } from "@/lib/auth/active-condo";
import { selectCondominiumFormAction, signOutAction } from "@/lib/auth/actions";
import { requireSession } from "@/lib/auth/session";
import { getRolePermissions } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=config");
  }

  const session = await requireSession();
  const memberships = await getAccessibleCondominiums();
  const activeSlug = await getActiveCondoSlug();

  if (memberships.length === 1) {
    await setActiveCondoSlug(memberships[0].condominium.slug);
    redirect(`/app/${memberships[0].condominium.slug}`);
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2 font-semibold">
            <Building2 className="h-5 w-5 text-primary" />
            Condomínio SaaS
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session.profile.full_name}
            </span>
            <form action={signOutAction}>
              <Button variant="outline" type="submit">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Seus condomínios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {memberships.length > 0
              ? "Selecione o condomínio que deseja administrar."
              : "Você ainda não possui vínculo com nenhum condomínio."}
          </p>
        </div>

        {memberships.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Aguardando vínculo</CardTitle>
              <CardDescription>
                Sua conta foi criada, mas ainda não há membership. Peça a um administrador ou
                síndico para vincular seu e-mail ({session.user.email}) em Configurações →
                Membros.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link href="/signup">Convidar outra pessoa</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {memberships.map((membership) => (
              <Card
                key={membership.id}
                className={membership.condominium.slug === activeSlug ? "border-primary" : ""}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>{membership.condominium.name}</CardTitle>
                      <CardDescription>/{membership.condominium.slug}</CardDescription>
                    </div>
                    <Badge className="border bg-background">
                      {getRolePermissions(membership.role).label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <form action={selectCondominiumFormAction}>
                    <input type="hidden" name="slug" value={membership.condominium.slug} />
                    <Button type="submit">
                      Acessar painel
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
