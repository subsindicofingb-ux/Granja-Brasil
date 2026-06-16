"use client";

import { createContext, useContext } from "react";
import type { CondoAccess } from "@/lib/auth/types";

const CondoAccessContext = createContext<CondoAccess | null>(null);

export function CondoAccessProvider({
  access,
  children,
}: {
  access: CondoAccess;
  children: React.ReactNode;
}) {
  return (
    <CondoAccessContext.Provider value={access}>{children}</CondoAccessContext.Provider>
  );
}

export function useCondoAccess() {
  const context = useContext(CondoAccessContext);
  if (!context) {
    throw new Error("useCondoAccess deve ser usado dentro de CondoAccessProvider");
  }
  return context;
}
