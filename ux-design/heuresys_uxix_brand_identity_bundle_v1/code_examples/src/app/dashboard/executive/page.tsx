export default function ExecutiveDashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Executive Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Strategic overview of workforce, organization, performance and intelligence signals.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Workforce</p>
          <p className="mt-2 text-3xl font-semibold">158</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Open gaps</p>
          <p className="mt-2 text-3xl font-semibold">37</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Critical coverage</p>
          <p className="mt-2 text-3xl font-semibold">82%</p>
        </div>
      </div>
    </section>
  );
}
