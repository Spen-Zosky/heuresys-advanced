import Link from "next/link";

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
    label: "Workforce",
    items: ["Positions", "Skills", "Competencies", "Career & succession"],
  },
  {
    label: "Operations",
    items: ["Blueprints", "Processes", "Brownfield adaptation", "Seed acquisition"],
  },
  {
    label: "Intelligence",
    items: ["KPIs", "Gaps", "Compensation intelligence", "Visualizations"],
  },
  { label: "Governance", items: ["Tenants", "Users", "Admin / Roles"] },
];

function ShellDemo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-sm">
      <div
        className="grid h-[480px]"
        style={{
          gridTemplateRows: "64px 1fr 44px",
        }}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4">
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded border border-neutral-300 text-xs">≡</span>
            <span className="font-semibold tracking-tight">Heuresys</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <span>IT / EN</span>
            <span aria-hidden>·</span>
            <span>palette</span>
            <span aria-hidden>·</span>
            <span>◐</span>
            <span aria-hidden>·</span>
            <span>user</span>
          </div>
        </div>
        <div
          className="grid min-h-0"
          style={{ gridTemplateColumns: collapsed ? "72px 1fr" : "280px 1fr" }}
        >
          <aside className="min-h-0 overflow-y-auto border-r border-neutral-200 bg-neutral-50">
            <nav aria-label={`Sidebar ${collapsed ? "collapsed" : "expanded"}`} className="p-2">
              {SIDEBAR_GROUPS.map((g) => (
                <div key={g.label} className="mb-3">
                  {!collapsed ? (
                    <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      {g.label}
                    </p>
                  ) : null}
                  <ul className="space-y-0.5">
                    {g.items.map((it) => (
                      <li
                        key={it}
                        className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200 ${
                          collapsed ? "justify-center" : ""
                        }`}
                        title={collapsed ? it : undefined}
                      >
                        <span aria-hidden className="inline-block h-4 w-4 rounded bg-neutral-300" />
                        {!collapsed ? <span className="truncate">{it}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
          <main className="min-h-0 overflow-y-auto p-5">
            <h3 className="mb-4 text-lg font-semibold tracking-tight">Workforce dashboard</h3>
            <div className="grid grid-cols-2 gap-3">
              {KPI_FIXTURES.map((k) => (
                <div key={k.label} className="rounded-lg border border-neutral-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-wider text-neutral-500">{k.label}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">{k.value}</p>
                  <p className="mt-0.5 text-xs text-neutral-600">{k.delta}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-neutral-100" />
              ))}
            </div>
          </main>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 text-xs text-neutral-600">
          <span>© 2026 Heuresys · heuresys.com</span>
          <span className="flex items-center gap-2">
            <span aria-hidden>in</span>
            <span aria-hidden>gh</span>
            <span aria-hidden>x</span>
            <span aria-hidden>f</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ShellShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-neutral-500">UXIX-0001 · Accepted</p>
        <h1 className="text-3xl font-semibold tracking-tight">Shell architecture</h1>
        <p className="max-w-2xl text-sm text-neutral-600">
          Fixed-viewport shell with persistent Header (64px) and Footer (44px), body grid switching between{" "}
          <code>[280px_1fr]</code> (expanded) and <code>[72px_1fr]</code> (collapsed). Header and Footer
          remain immutable across the collapse transition. Sidebar and Main scroll independently within
          the space between Header and Footer.
        </p>
        <p className="text-xs text-neutral-500">
          Source of truth:{" "}
          <code>ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/01_dashboard_shell_architecture.md</code>{" "}
          ·{" "}
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section aria-labelledby="expanded-state" className="space-y-3">
        <h2 id="expanded-state" className="text-base font-semibold tracking-tight">
          Expanded sidebar (280px)
        </h2>
        <ShellDemo collapsed={false} />
      </section>

      <section aria-labelledby="collapsed-state" className="space-y-3">
        <h2 id="collapsed-state" className="text-base font-semibold tracking-tight">
          Collapsed sidebar (72px)
        </h2>
        <ShellDemo collapsed={true} />
      </section>

      <section aria-labelledby="contract" className="space-y-2 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 id="contract" className="text-base font-semibold tracking-tight">Contract checklist</h2>
        <ul className="space-y-1 text-sm text-neutral-700">
          <li>✓ Header height fixed at 64px across collapse states</li>
          <li>✓ Footer height fixed at 44px across collapse states</li>
          <li>✓ Body grid columns switch between 280px+1fr and 72px+1fr</li>
          <li>✓ Sidebar scrolls independently of Main (long content)</li>
          <li>✓ Main scrolls independently of Sidebar (long content)</li>
          <li>· Header and Footer do not flicker, resize or remount on collapse (visual QA pending)</li>
        </ul>
      </section>
    </div>
  );
}
