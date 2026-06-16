import { TableSkeleton } from "@/components/shared/loading-skeleton";

export default function ResidentsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="flex gap-3">
        <div className="h-9 w-44 animate-pulse rounded bg-muted" />
        <div className="h-9 w-52 animate-pulse rounded bg-muted" />
      </div>
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
}
