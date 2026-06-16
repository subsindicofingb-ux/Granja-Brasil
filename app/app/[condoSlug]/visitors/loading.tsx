export default function VisitorsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-24 animate-pulse rounded-xl border bg-muted/40" />
      <div className="h-64 animate-pulse rounded-xl border bg-muted/40" />
    </div>
  );
}
