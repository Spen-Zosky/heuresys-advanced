import Link from "next/link";
import {
  DashboardFooter,
  DashboardHeader,
  DashboardShell,
  DashboardSidebar,
  HeuresysLogoBadge,
  HeuresysWordmark,
} from "@/app/showcase/_ui-client";

export const metadata = {
  title: "Showcase / Shell — Heuresys",
};

const KPI_FIXTURES = [
  { label: "Active positions", value: "1,284", delta: "+12 this week" },
  { label: "Open skill gaps", value: "342", delta: "−18 vs last month" },
  { label: "Learning completions YTD", value: "5,917", delta: "78% of plan" },
  { label: "Tenants live", value: "23", delta: "+1 (RTL_BANK_REFERENCE)" },
];

const SIDEBAR_GROUPS = [
  {
    id: "workforce",
    label: "Workforce",
    items: [
      { id: "positions", label: "Positions", href: "#" },
      { id: "skills", label: "Skills", href: "#", active: true },
      { id: "competencies", label: "Competencies", href: "#" },
      { id: "career", label: "Career & succession", href: "#" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { id: "blueprints", label: "Blueprints", href: "#" },
      { id: "processes", label: "Processes", href: "#" },
      { id: "brownfield", label: "Brownfield adaptation", href: "#" },
      { id: "seeds", label: "Seed acquisition", href: "#" },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { id: "kpis", label: "KPIs", href: "#" },
      { id: "gaps", label: "Gaps", href: "#" },
      { id: "comp", label: "Compensation intelligence", href: "#" },
      { id: "viz", label: "Visualizations", href: "#" },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    items: [
      { id: "tenants", label: "Tenants", href: "#" },
      { id: "users", label: "Users", href: "#" },
      { id: "roles", label: "Admin / Roles", href: "#" },
    ],
  },
];

export default function ShellShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">UXIX-0001 · Accepted</p>
        <h1 className="text-3xl font-semibold tracking-tight">Shell architecture</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Live <code>DashboardShell</code> from <code>@heuresys/ui</code>. Fixed-viewport 3-row grid
          (header 64px / content 1fr / footer 44px) with inner 2-column grid switching between{" "}
          <code>260px 1fr</code> (expanded) and <code>72px 1fr</code> (collapsed). Header and Footer
          remain immutable across the collapse transition. Sidebar and Main scroll independently.
        </p>
        <p className="text-xs text-muted-foreground">
          Source of truth: <code>@heuresys/ui/dashboard/DashboardShell</code> ·{" "}
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section aria-labelledby="live-shell" className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="live-shell" className="text-base font-semibold tracking-tight">
            Live shell — click the toggle in the sidebar header to collapse / expand
          </h2>
          <p className="text-[11px] text-muted-foreground">State persists to <code>localStorage</code></p>
        </div>
        <div className="relative h-[640px] overflow-hidden rounded-xl border border-border shadow-sm">
          <DashboardShell
            className="!h-full"
            header={
              <DashboardHeader
                breadcrumb={[
                  { label: "Workforce", href: "#" },
                  { label: "Skills" },
                ]}
                user={{ initials: "ES", username: "enzo.spenuso", role: "USER", roleTone: "info" }}
                language="IT"
                logo={<HeuresysWordmark variant="brand" size={24} />}
                logoBadge={<HeuresysLogoBadge>advanced</HeuresysLogoBadge>}
              />
            }
            sidebar={<DashboardSidebar groups={SIDEBAR_GROUPS} />}
            footer={
              <DashboardFooter
                rightSlot={
                  <>
                    <span>v5.0.0-mvp3</span>
                    <span aria-hidden="true" className="text-border">·</span>
                    <span>showcase / shell</span>
                    <span aria-hidden="true" className="text-border">·</span>
                    <span>RTL_BANK_REFERENCE</span>
                  </>
                }
              />
            }
          >
            <div className="space-y-5">
              <div>
                <h3 className="text-xl font-semibold tracking-tight">Workforce dashboard</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Body content scrolls independently of Header and Footer.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {KPI_FIXTURES.map((k) => (
                  <div key={k.label} className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{k.value}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{k.delta}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-muted" />
                ))}
              </div>
            </div>
          </DashboardShell>
        </div>
      </section>

      <section aria-labelledby="contract" className="space-y-2 rounded-lg border border-border bg-card p-5">
        <h2 id="contract" className="text-base font-semibold tracking-tight">Contract checklist</h2>
        <ul className="space-y-1 text-sm text-card-foreground">
          <li>✓ Header height fixed at 64px across collapse states</li>
          <li>✓ Footer height fixed at 44px across collapse states</li>
          <li>✓ Body grid columns switch between 260px+1fr and 72px+1fr (Chrome quirk worked around via `!important`)</li>
          <li>✓ Sidebar scrolls independently of Main (long content)</li>
          <li>✓ Main scrolls independently of Sidebar (long content)</li>
          <li>✓ Collapse state persists to <code>localStorage</code> under key <code>heuresys-sidebar</code></li>
          <li>✓ Header and Footer do not remount on collapse (mutation via inline grid-template-columns, not React re-render)</li>
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-2">
        <h2 className="text-base font-semibold tracking-tight">How collapse works</h2>
        <p className="text-sm text-card-foreground">
          The toggle button in the sidebar header sets <code>data-sidebar=&quot;collapsed&quot;</code> on{" "}
          <code>&lt;body&gt;</code>, then mutates <code>[data-shell=&quot;grid&quot;]</code>{" "}
          inline style with <code>grid-template-columns: 72px 1fr !important</code>. The{" "}
          <code>!important</code> override is required because of a known Chrome quirk where{" "}
          <code>transition: grid-template-columns</code> can fight Tailwind utilities. Sidebar items
          render icon-only when collapsed (label hidden via CSS, full label restored on hover via{" "}
          <code>title</code> attribute on each <code>&lt;li&gt;</code>).
        </p>
      </section>
    </div>
  );
}
