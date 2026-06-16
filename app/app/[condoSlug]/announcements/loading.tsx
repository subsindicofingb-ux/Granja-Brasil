export default function AnnouncementsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-9 w-56 animate-pulse rounded bg-muted" />
      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    </div>
  );
}
