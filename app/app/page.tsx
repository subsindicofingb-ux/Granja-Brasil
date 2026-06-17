import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { RegistrationRequestList } from "@/components/registrations/registration-request-list";
import { getAccessibleCondominiums } from "@/lib/auth/access";
import { getActiveCondoSlug } from "@/lib/auth/active-condo";
import { selectCondominiumFormAction, signOutAction } from "@/lib/auth/actions";
import { requireSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/session";
import { getRolePermissions } from "@/lib/auth/roles";
import { BRAND_TAGLINE } from "@/lib/brand";
import { REGISTRATION_REQUEST_STATUS, ROLES } from "@/lib/constants";
import { REGISTRATION_REQUEST_STATUS_LABELS } from "@/lib/registrations/labels";
import {
  listAllPendingRegistrationRequests,
  listRegistrationRequestsForProfile,
} from "@/lib/services/registration-requests";
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
  const superAdmin = await isSuperAdmin();
  const myRequestsResult = await listRegistrationRequestsForProfile(session.user.id);
  const myRequests = myRequestsResult.ok ? (myRequestsResult.data ?? []) : [];
  const pendingRequests = myRequests.filter(
    (request) => request.status === REGISTRATION_REQUEST_STATUS.PENDING,
  );
  const globalPendingResult = superAdmin ? await listAllPendingRegistrationRequests() : null;
  const globalPendingRequests = globalPendingResult?.ok ? (globalPendingResult.data ?? []) : [];
  const adminCondoSlug = memberships[0]?.condominium.slug ?? activeSlug ?? "residencial-exemplo";
  const firstName = session.profile.full_name.split(/\s+/)[0] ?? session.profile.full_name;

  if (memberships.length === 1) {
    redirect(`/app/${memberships[0].condominium.slug}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 via-background to-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <BrandLogo href="/app" size="sm" />
          <form action={signOutAction}>
            <Button variant="outline" size="sm" type="submit">
              Sair do app
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <section className="mb-8 rounded-2xl border bg-card p-5 text-center shadow-sm sm:p-8">
          <div className="flex justify-center">
            <BrandLogo size="hero" priority />
          </div>
          <h1 className="mt-5 text-xl font-bold sm:text-2xl">Olá, {firstName}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
            {memberships.length > 0
              ? "Selecione o condomínio que deseja acessar."
              : BRAND_TAGLINE}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{session.user.email}</p>
        </section>

        {superAdmin && (
          <section className="mb-8 space-y-4">
            <Card className="border-primary/30 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Administração geral</CardTitle>
                <CardDescription>
                  Cadastro de condomínios, liberação de novos usuários e equipe do sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" className="justify-start" asChild>
                  <Link href={`/app/${adminCondoSlug}/admin/condominiums`}>
                    Cadastrar condomínio
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start" asChild>
                  <Link href={`/app/${adminCondoSlug}/settings/registration-requests`}>
                    Solicitações de cadastro
                    {globalPendingRequests.length > 0 && (
                      <Badge className="ml-auto border bg-background">
                        {globalPendingRequests.length}
                      </Badge>
                    )}
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start" asChild>
                  <Link href={`/app/${adminCondoSlug}/settings/members?role=${ROLES.SYNDIC}`}>
                    Cadastrar síndico
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start" asChild>
                  <Link href={`/app/${adminCondoSlug}/settings/members?role=${ROLES.DOORMAN}`}>
                    Cadastrar portaria
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start sm:col-span-2" asChild>
                  <Link href={`/app/${adminCondoSlug}/settings/members?role=${ROLES.ADMIN}`}>
                    Cadastrar administrador
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {globalPendingRequests.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Novos usuários aguardando liberação</CardTitle>
                  <CardDescription>
                    Solicitações pendentes em todos os condomínios.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RegistrationRequestList
                    condoSlug={adminCondoSlug}
                    requests={globalPendingRequests}
                    showCondominium
                  />
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {memberships.length === 0 ? (
          <Card className="border-amber-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Aguardando aprovação</CardTitle>
              <CardDescription>
                Sua conta foi criada. O síndico precisa aprovar seu cadastro antes do acesso ao
                painel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingRequests.length > 0 ? (
                <div className="space-y-3">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-xl border bg-muted/20 p-4 text-sm"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-medium">
                          {request.condominium?.name ?? "Condomínio"}
                        </span>
                        <Badge className="w-fit border bg-background">
                          {REGISTRATION_REQUEST_STATUS_LABELS[request.status]}
                        </Badge>
                      </div>
                      <p className="mt-2 text-muted-foreground">
                        Solicitado em {formatDateTime(request.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Se você ainda não fez o cadastro com pré-qualificação,{" "}
                  <Link href="/signup" className="font-medium text-primary hover:underline">
                    crie uma nova conta
                  </Link>{" "}
                  informando condomínio e unidade.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {memberships.map((membership) => (
              <Card
                key={membership.id}
                className={
                  membership.condominium.slug === activeSlug
                    ? "border-primary shadow-md"
                    : "shadow-sm"
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="text-lg leading-snug">
                        {membership.condominium.name}
                      </CardTitle>
                      <CardDescription className="truncate">
                        /{membership.condominium.slug}
                      </CardDescription>
                    </div>
                    <Badge className="w-fit border bg-background">
                      {getRolePermissions(membership.role).label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <form action={selectCondominiumFormAction}>
                    <input type="hidden" name="slug" value={membership.condominium.slug} />
                    <Button type="submit" className="h-11 w-full sm:w-auto">
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
