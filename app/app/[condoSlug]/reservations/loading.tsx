import { TableSkeleton } from "@/components/shared/loading-skeleton";

export default function ReservationsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-9 w-full max-w-2xl animate-pulse rounded bg-muted" />
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
}
