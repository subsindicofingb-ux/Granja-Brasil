"use client";

import { useState } from "react";
import { LogOut, User } from "lucide-react";
import { clearAppSessionTab } from "@/lib/auth/session-tab";
import { signOutAction } from "@/lib/auth/actions";
import type { CondoAccess } from "@/lib/auth/types";
import { getInitials } from "@/lib/auth/types";
import { RoleBadge } from "@/components/auth/permission-gate";
import { Button } from "@/components/ui/button";

interface UserMenuProps {
  access: CondoAccess;
}

export function UserMenu({ access }: UserMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        title={access.profile.fullName}
        onClick={() => setOpen((value) => !value)}
      >
        {getInitials(access.profile.fullName)}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Fechar menu do usuário"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border bg-card p-3 shadow-lg">
            <div className="flex items-start gap-3 border-b pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{access.profile.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">{access.profile.email}</p>
                <div className="mt-2">
                  <RoleBadge access={access} />
                </div>
              </div>
            </div>
            <form
              action={signOutAction}
              className="pt-3"
              onSubmit={() => {
                clearAppSessionTab();
              }}
            >
              <Button
                type="submit"
                variant="outline"
                className="w-full justify-start"
                onClick={() => setOpen(false)}
              >
                <LogOut className="h-4 w-4" />
                Sair do app
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
