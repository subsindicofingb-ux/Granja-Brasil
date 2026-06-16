"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { selectCondominiumAction } from "@/lib/auth/actions";
import type { MembershipWithCondo } from "@/lib/auth/types";
import { getRolePermissions } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";

interface CondoSwitcherProps {
  memberships: MembershipWithCondo[];
  activeSlug: string;
}

export function CondoSwitcher({ memberships, activeSlug }: CondoSwitcherProps) {
  const [pending, startTransition] = useTransition();

  if (memberships.length <= 1) {
    return null;
  }

  return (
    <div className="relative">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border border-sidebar-border px-3 py-2 text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent/60">
          <span>Trocar condomínio</span>
          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
        </summary>
        <div className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-lg border bg-card p-1 shadow-lg">
          {memberships.map((membership) => (
            <Button
              key={membership.id}
              type="button"
              variant="ghost"
              disabled={pending || membership.condominium.slug === activeSlug}
              className="h-auto w-full justify-start px-3 py-2 text-left text-sm font-normal"
              onClick={() => {
                startTransition(async () => {
                  await selectCondominiumAction(membership.condominium.slug);
                });
              }}
            >
              <div>
                <p className="font-medium">{membership.condominium.name}</p>
                <p className="text-xs text-muted-foreground">
                  {getRolePermissions(membership.role).label}
                </p>
              </div>
            </Button>
          ))}
        </div>
      </details>
    </div>
  );
}
