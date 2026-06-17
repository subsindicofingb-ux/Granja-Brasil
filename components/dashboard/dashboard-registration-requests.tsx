import Link from "next/link";
import type { RegistrationRequestRecord } from "@/lib/registrations/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface DashboardRegistrationRequestsProps {
  condoSlug: string;
  requests: RegistrationRequestRecord[];
  showCondominium?: boolean;
  viewAllHref: string;
}

export function DashboardRegistrationRequests({
  condoSlug,
  requests,
  showCondominium = false,
  viewAllHref,
}: DashboardRegistrationRequestsProps) {
  if (requests.length === 0) {
    return null;
  }

  const preview = requests.slice(0, 5);

  return (
    <Card className="border-sky-200 bg-sky-50/50">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          Solicitações de cadastro ({requests.length})
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href={viewAllHref}>Ver todas</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {preview.map((request) => (
          <div key={request.id} className="rounded-lg border bg-card p-3 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{request.full_name}</p>
                <p className="text-muted-foreground">{request.email}</p>
              </div>
              {showCondominium && request.condominium?.name && (
                <p className="text-xs font-medium text-muted-foreground">
                  {request.condominium.name}
                </p>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Solicitado em {formatDateTime(request.created_at)}
            </p>
          </div>
        ))}
        <Button size="sm" variant="outline" asChild>
          <Link href={viewAllHref}>Analisar solicitações</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
