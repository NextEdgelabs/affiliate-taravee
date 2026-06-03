export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="h-4 w-40 rounded bg-muted" />
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square w-full rounded-xl bg-muted" />
        <div className="space-y-4">
          <div className="h-7 w-2/3 rounded bg-muted" />
          <div className="h-6 w-1/4 rounded bg-muted" />
          <div className="h-24 w-full rounded bg-muted" />
          <div className="h-11 w-40 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
