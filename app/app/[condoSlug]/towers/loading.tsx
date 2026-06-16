import { TableSkeleton } from "@/components/shared/loading-skeleton";

export default function TowersLoading() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <TableSkeleton rows={4} cols={3} />
    </div>
  );
}
