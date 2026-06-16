import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { getAccessibleCondominiums } from "@/lib/auth/access";
import { getActiveCondoSlug } from "@/lib/auth/active-condo";
import { selectCondominiumFormAction, signOutAction } from "@/lib/auth/actions";
import { requireSession } from "@/lib/auth/session";
import { getRolePermissions } from "@/lib/auth/roles";
import { REGISTRATION_REQUEST_STATUS } from "@/lib/constants";
import { REGISTRATION_REQUEST_STATUS_LABELS } from "@/lib/registrations/labels";
import { listRegistrationRequestsForProfile } from "@/lib/services/registration-requests";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=config");
  }

  const session = await requireSession();
  const memberships = await getAccessibleCondominiums();
  const activeSlug = await getActiveCondoSlug();
  const myRequestsResult = await listRegistrationRequestsForProfile(session.user.id);
  const myRequests = myRequestsResult.ok ? (myRequestsResult.data ?? []) : [];
  const pendingRequests = myRequests.filter(
    (request) => request.status === REGISTRATION_REQUEST_STATUS.PENDING,
  );

  if (memberships.length === 1) {
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
              <CardTitle>Aguardando aprovação</CardTitle>
              <CardDescription>
                Sua conta foi criada. O síndico do condomínio precisa aprovar seu cadastro antes
                do acesso ao painel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingRequests.length > 0 ? (
                <div className="space-y-3">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="rounded-md border bg-muted/20 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {request.condominium?.name ?? "Condomínio"}
                        </span>
                        <Badge className="border bg-background">
                          {REGISTRATION_REQUEST_STATUS_LABELS[request.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        Solicitado em {formatDateTime(request.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Se você ainda não fez o cadastro com pré-qualificação,{" "}
                  <Link href="/signup" className="text-primary hover:underline">
                    crie uma nova conta
                  </Link>{" "}
                  informando condomínio e unidade.
                </p>
              )}
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
