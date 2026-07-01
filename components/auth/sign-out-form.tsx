"use client";

import type { ReactNode } from "react";
import { clearAppSessionTab } from "@/lib/auth/session-tab";
import { signOutAction } from "@/lib/auth/actions";

type SignOutFormProps = {
  children: ReactNode;
  className?: string;
};

export function SignOutForm({ children, className }: SignOutFormProps) {
  return (
    <form
      action={signOutAction}
      className={className}
      onSubmit={() => {
        clearAppSessionTab();
      }}
    >
      {children}
    </form>
  );
}
