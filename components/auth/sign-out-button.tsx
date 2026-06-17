import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SignOutButtonProps {
  variant?: "sidebar" | "menu";
}

export function SignOutButton({ variant = "sidebar" }: SignOutButtonProps) {
  return (
    <form action={signOutAction}>
      <Button
        type="submit"
        variant="ghost"
        className={cn(
          "w-full justify-start",
          variant === "sidebar"
            ? "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            : "text-foreground hover:bg-muted",
        )}
      >
        <LogOut className="h-4 w-4" />
        Sair do app
      </Button>
    </form>
  );
}
