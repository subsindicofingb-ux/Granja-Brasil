import { TableSkeleton } from "@/components/shared/loading-skeleton";

export default function UnitsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-10 w-64 animate-pulse rounded bg-muted" />
      <TableSkeleton rows={5} cols={4} />
    </div>
  );
}
