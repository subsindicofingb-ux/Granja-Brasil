import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  PENDING_APPROVAL_FOOTNOTE,
  PENDING_APPROVAL_MESSAGE,
  PENDING_APPROVAL_TITLE,
  userHasAppAccess,
} from "@/lib/auth/pending-approval";
import { requireSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/session";
import { REGISTRATION_REQUEST_STATUS } from "@/lib/constants";
import { REGISTRATION_REQUEST_STATUS_LABELS } from "@/lib/registrations/labels";
import { SIGNUP_WELCOME_TITLE } from "@/lib/auth/signup-success";
import { listRegistrationRequestsForProfile } from "@/lib/services/registration-requests";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PendingApprovalPage() {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=config");
  }

  const session = await requireSession();
  const supabase = await createClient();
  const superAdmin = await isSuperAdmin();

  if (!superAdmin && (await userHasAppAccess(supabase))) {
    redirect("/app");
  }

  const myRequestsResult = await listRegistrationRequestsForProfile(session.user.id);
  const myRequests = myRequestsResult.ok ? (myRequestsResult.data ?? []) : [];
  const pendingRequests = myRequests.filter(
    (request) => request.status === REGISTRATION_REQUEST_STATUS.PENDING,
  );
  const firstName = session.profile.full_name.split(/\s+/)[0] ?? session.profile.full_name;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 via-background to-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <BrandLogo href="/" size="sm" />
          <SignOutButton variant="compact" label="Sair" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <section className="mb-8 rounded-2xl border bg-card p-5 text-center shadow-sm sm:p-8">
          <div className="flex justify-center">
            <BrandLogo size="hero" priority />
          </div>
          <Badge className="mt-5 border-amber-300 bg-amber-50 text-amber-900">
            {PENDING_APPROVAL_TITLE}
          </Badge>
          <h1 className="mt-4 text-xl font-bold sm:text-2xl">
            {SIGNUP_WELCOME_TITLE}, {firstName}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
            {PENDING_APPROVAL_MESSAGE}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{session.user.email}</p>
        </section>

        <Card className="border-amber-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Status da solicitação</CardTitle>
            <CardDescription>{PENDING_APPROVAL_FOOTNOTE}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingRequests.length > 0 ? (
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="rounded-xl border bg-muted/20 p-4 text-sm">
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
      </main>
    </div>
  );
}
