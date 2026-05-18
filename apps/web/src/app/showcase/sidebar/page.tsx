import Link from "next/link";

export const metadata = { title: "Showcase / Sidebar — Heuresys" };

const TREE_GROUPS = [
  {
    id: "workforce",
    label: "Workforce",
    items: [
      { label: "Positions", badge: null, active: false },
      { label: "Skills", badge: "12", active: true },
      { label: "Competencies", badge: null, active: false },
      { label: "Career & succession", badge: "3", active: false },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { label: "Blueprints", badge: null, active: false },
      { label: "Processes", badge: null, active: false },
      { label: "Brownfield adaptation", badge: "47k", active: false },
      { label: "Seed acquisition", badge: null, active: false },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { label: "KPIs", badge: null, active: false },
      { label: "Gaps", badge: "342", active: false },
      { label: "Compensation intelligence", badge: null, active: false },
      { label: "Visualizations", badge: null, active: false },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    items: [
      { label: "Tenants", badge: null, active: false },
      { label: "Users", badge: null, active: false },
      { label: "Admin / Roles", badge: null, active: false },
    ],
  },
];

function SidebarMock({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
      style={{ width: collapsed ? 72 : 280, height: 480 }}
    >
      <nav aria-label={`Sidebar ${collapsed ? "collapsed" : "expanded"}`} className="h-full overflow-y-auto p-2">
        {TREE_GROUPS.map((g) => (
          <div key={g.id} className="mb-3">
            {!collapsed ? (
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                {g.label}
              </p>
            ) : (
              <hr className="my-2 border-neutral-200" />
            )}
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li
                  key={it.label}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                    collapsed ? "justify-center" : "justify-between"
                  } ${
                    it.active ? "bg-blue-50 text-blue-900" : "text-neutral-700 hover:bg-neutral-200"
                  }`}
                  title={collapsed ? it.label : undefined}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span aria-hidden className="inline-block h-4 w-4 shrink-0 rounded bg-neutral-300" />
                    {!collapsed ? <span className="truncate">{it.label}</span> : null}
                  </span>
                  {!collapsed && it.badge ? (
                    <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
                      {it.badge}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default function SidebarShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-neutral-500">UXIX-0004 · Proposed</p>
        <h1 className="text-3xl font-semibold tracking-tight">Sidebar — tree state + collapse</h1>
        <p className="max-w-2xl text-sm text-neutral-600">
          Two independent state levels: <code>sidebarCollapsed</code> (width 280 ↔ 72) and{" "}
          <code>treeGroups[id].open</code> (per-group). Active route highlighted. Badges show
          actionable counts (skill gaps, brownfield queue, succession reviews). localStorage
          persistence per bundle <code>docs/07_sidebar_specification.md</code>.
        </p>
        <p className="text-xs text-neutral-500">
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section className="flex flex-wrap gap-6">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Expanded · 280px</p>
          <SidebarMock collapsed={false} />
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Collapsed · 72px</p>
          <SidebarMock collapsed={true} />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold tracking-tight">State model</h2>
        <pre className="mt-3 overflow-x-auto rounded bg-neutral-100 p-3 text-xs">
{`{
  sidebarCollapsed: boolean,          // 280 ↔ 72, persisted to localStorage
  treeGroups: {
    workforce: { open: true },        // expanded by default
    operations: { open: false },
    intelligence: { open: true },
    governance: { open: false },
  },
}`}
        </pre>
        <p className="mt-3 text-sm text-neutral-700">
          When <code>sidebarCollapsed === true</code>, group labels are hidden and items render as
          icon-only with their full label restored on hover via <code>title</code> attribute.
        </p>
      </section>
    </div>
  );
}
