export function PositionCatalogueView() {
  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Active positions</p>
          <p className="mt-2 text-3xl font-semibold">158</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Critical roles</p>
          <p className="mt-2 text-3xl font-semibold">24</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Profiles needing review</p>
          <p className="mt-2 text-3xl font-semibold">11</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Position Catalogue</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This view will contain the position catalogue table, filters, position cards and detail panels.
        </p>
      </div>
    </section>
  );
}
