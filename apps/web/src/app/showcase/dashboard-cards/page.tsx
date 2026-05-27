import Link from "next/link";
import { AuditFeed, KPIStrip } from "@/app/showcase/_ui-client";
import { BookOpen, Briefcase, Database, Layers } from "lucide-react";

export const metadata = { title: "Showcase / Dashboard cards — Heuresys" };

function ProgressBody({ pct }: { pct: number }) {
  return (
    <div className="mt-3">
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{pct}% capacity</p>
    </div>
  );
}

function MultiStatCard() {
  const segments = [
    { label: "Validated", value: 412, tone: "success" as const },
    { label: "Self-assessed", value: 287, tone: "warning" as const },
    { label: "Pending", value: 113, tone: "neutral" as const },
  ];
  const total = segments.reduce((a, b) => a + b.value, 0);
  return (
    <article className="rounded-card border border-border bg-card p-4 shadow-card">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Skill records by source</p>
        <p className="text-xs tabular-nums text-muted-foreground">{total} total</p>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
        {segments.map((s) => {
          const w = (s.value / total) * 100;
          const cls =
            s.tone === "success" ? "bg-success" : s.tone === "warning" ? "bg-warning" : "bg-muted-foreground";
          return <div key={s.label} className={cls} style={{ width: `${w}%` }} />;
        })}
      </div>
      <ul className="mt-3 space-y-1 text-xs">
        {segments.map((s) => {
          const swatchCls =
            s.tone === "success" ? "bg-success" : s.tone === "warning" ? "bg-warning" : "bg-muted-foreground";
          return (
            <li key={s.label} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${swatchCls}`} />
                {s.label}
              </span>
              <span className="tabular-nums text-muted-foreground">{s.value}</span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export default function DashboardCardsShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Showcase</p>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard cards</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          KPI + data card variants composed from <code>@heuresys/ui</code> primitives
          (<code>KPIStrip</code>, <code>AuditFeed</code>). Card surfaces, radius and shadow inherit
          from the design tokens; values use <code>font-variant-numeric: tabular-nums</code> for KPI
          alignment.
        </p>
        <p className="text-xs text-muted-foreground">
          Source of truth: <code>@heuresys/ui/dashboard/KPIStrip</code> +{" "}
          <code>@heuresys/ui/dashboard/AuditFeed</code> ·{" "}
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Simple KPI — KPIStrip</h2>
        <KPIStrip
          items={[
            { label: "Active positions", value: "1,284", iconTone: "palette-1", footerLeft: "+12 this week", footerRight: <span className="text-success">▲ 0.9%</span> },
            { label: "Open skill gaps", value: "342", iconTone: "warning", footerLeft: "−18 vs last month", footerRight: <span className="text-success">▼ 5%</span> },
            { label: "Certifications expiring", value: "27", iconTone: "danger", footerLeft: "next 30 days", footerRight: <span className="text-destructive">▲ 22%</span> },
            { label: "Tenants live", value: "23", iconTone: "palette-3", footerLeft: "+1 (RTL_BANK_REFERENCE)" },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Sparkline — KPIStrip with series</h2>
        <KPIStrip
          items={[
            {
              label: "Learning completions · 12w",
              value: "5,917",
              unit: "YTD",
              iconTone: "palette-2",
              sparkline: [0.42, 0.5, 0.48, 0.58, 0.62, 0.68, 0.74, 0.7, 0.81, 0.86, 0.92, 1],
              sparklineTone: "primary",
              footerLeft: "78% of plan",
              footerRight: <span className="text-success">▲ 14%</span>,
            },
            {
              label: "Position fill rate",
              value: "94.2",
              unit: "%",
              iconTone: "success",
              sparkline: [0.62, 0.65, 0.68, 0.7, 0.78, 0.82, 0.86, 0.89, 0.92, 0.94, 0.97, 1],
              sparklineTone: "success",
              footerLeft: "+1.3pp QoQ",
              footerRight: <span className="text-success">▲ 1.3%</span>,
            },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Progress vs target — custom body</h2>
        <KPIStrip
          items={[
            { label: "Hiring plan H1 2026", value: "412", unit: "/ 500", iconTone: "palette-1", body: <ProgressBody pct={82} /> },
            { label: "Mandatory training Q2", value: "2,914", unit: "/ 3,200", iconTone: "success", body: <ProgressBody pct={91} /> },
            { label: "Position descriptions reviewed", value: "876", unit: "/ 1,284", iconTone: "warning", body: <ProgressBody pct={68} /> },
          ]}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
        <MultiStatCard />
        <AuditFeed
          title="Recent activity"
          subtitle="Tenant RTL_BANK_REFERENCE · last 4 events"
          events={[
            {
              icon: <Layers className="h-3.5 w-3.5" />,
              tone: "info",
              title: "Mario Rossi self-assessed 4 skills",
              meta: <><span>14:02</span><span>·</span><span>Risk Mgmt</span></>,
            },
            {
              icon: <BookOpen className="h-3.5 w-3.5" />,
              tone: "success",
              title: "Anna Bianchi completed 'GDPR Foundations'",
              meta: <><span>13:48</span><span>·</span><span>Learning</span></>,
            },
            {
              icon: <Database className="h-3.5 w-3.5" />,
              tone: "palette-1",
              title: "Tenant RTL_BANK_REFERENCE refreshed",
              meta: <><span>13:21</span><span>·</span><span>Ops</span></>,
            },
            {
              icon: <Briefcase className="h-3.5 w-3.5" />,
              tone: "warning",
              title: "Position 'Senior Risk Analyst' opened",
              meta: <><span>12:55</span><span>·</span><span>Workforce</span></>,
            },
          ]}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold tracking-tight">Pattern selection guide</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="pb-2">Need</th>
              <th className="pb-2">Use</th>
              <th className="pb-2">From</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-card-foreground">
            <tr><td className="py-2">Single number + delta</td><td><code>KPIStrip</code> with no sparkline</td><td><code>@heuresys/ui</code></td></tr>
            <tr><td className="py-2">Number + trend</td><td><code>KPIStrip</code> + <code>sparkline</code> array</td><td><code>@heuresys/ui</code></td></tr>
            <tr><td className="py-2">Number + target bar</td><td><code>KPIStrip</code> + <code>body</code> slot</td><td><code>@heuresys/ui</code></td></tr>
            <tr><td className="py-2">Composition by source</td><td>Local stacked bar (see <em>MultiStatCard</em>)</td><td>this page</td></tr>
            <tr><td className="py-2">Event timeline</td><td><code>AuditFeed</code></td><td><code>@heuresys/ui</code></td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
