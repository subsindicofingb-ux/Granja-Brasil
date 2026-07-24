import { cn } from "@/lib/utils";

/** Lista em cards no mobile; tabela no desktop — evita conteúdo fora da tela. */
export function ResponsiveRecords({
  mobile,
  desktop,
  className,
}: {
  mobile: React.ReactNode;
  desktop: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="space-y-3 md:hidden">{mobile}</div>
      <div className="hidden min-w-0 md:block">{desktop}</div>
    </div>
  );
}

export function MobileRecordCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-xl border bg-card p-4 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MobileRecordRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0 break-words font-medium text-foreground">{children}</div>
    </div>
  );
}
