import { SessionTabGuard } from "@/components/auth/session-tab-guard";

export const dynamic = "force-dynamic";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionTabGuard>{children}</SessionTabGuard>;
}
