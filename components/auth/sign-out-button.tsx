"use client";

import { LogOut } from "lucide-react";
import { clearAppSessionTab } from "@/lib/auth/session-tab";
import { signOutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SignOutButtonProps {
  variant?: "sidebar" | "menu" | "compact";
  label?: string;
}

export function SignOutButton({ variant = "sidebar", label = "Sair do app" }: SignOutButtonProps) {
  const isCompact = variant === "compact";

  return (
    <form
      action={signOutAction}
      onSubmit={() => {
        clearAppSessionTab();
      }}
    >
      <Button
        type="submit"
        variant={isCompact ? "outline" : "ghost"}
        size={isCompact ? "sm" : "default"}
        className={cn(
          isCompact ? undefined : "w-full justify-start",
          variant === "sidebar"
            ? "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            : variant === "menu"
              ? "min-h-14 text-lg text-foreground hover:bg-muted"
              : undefined,
        )}
      >
        <LogOut className={variant === "menu" ? "h-6 w-6" : "h-4 w-4"} />
        {label}
      </Button>
    </form>
  );
}
