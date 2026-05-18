import Link from "next/link";

export const metadata = { title: "Showcase / Page types — Heuresys" };

type PageType = {
  id: string;
  name: string;
  example: string;
  description: string;
  sketch: () => React.ReactNode;
};

const PAGE_TYPES: PageType[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    example: "/dashboard, /dashboard/executive",
    description: "Cross-module KPI overview with cards, sparklines, recent activity.",
    sketch: () => (
      <div className="space-y-1.5">
        <div className="h-3 w-1/2 rounded bg-[var(--muted)]" />
        <div className="grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-8 rounded bg-blue-100" />)}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="h-12 rounded bg-[var(--muted)]" />
          <div className="h-12 rounded bg-[var(--muted)]" />
        </div>
      </div>
    ),
  },
  {
    id: "module-tabs",
    name: "Module with tabs",
    example: "/positions, /positions/:id (Catalogue · Skills · Career)",
    description: "Top tabs inside a module surface sibling views without leaving context.",
    sketch: () => (
      <div className="space-y-1.5">
        <div className="h-3 w-2/3 rounded bg-[var(--muted)]" />
        <div className="flex gap-1">
          <div className="h-4 w-12 rounded bg-blue-500" />
          <div className="h-4 w-12 rounded bg-[var(--muted)]" />
          <div className="h-4 w-12 rounded bg-[var(--muted)]" />
        </div>
        <div className="h-20 rounded bg-[var(--muted)]" />
      </div>
    ),
  },
  {
    id: "module-no-tabs",
    name: "Module without tabs",
    example: "/visualizations, /brownfield-adaptation",
    description: "Single-view module: page renders directly under the sidebar selection.",
    sketch: () => (
      <div className="space-y-1.5">
        <div className="h-3 w-1/2 rounded bg-[var(--muted)]" />
        <div className="h-24 rounded bg-[var(--muted)]" />
      </div>
    ),
  },
  {
    id: "login",
    name: "Login",
    example: "/login",
    description: "Public auth entry. Logo + email + password + submit. No shell.",
    sketch: () => (
      <div className="flex h-full items-center justify-center">
        <div className="w-2/3 space-y-1.5 rounded border border-[var(--border)] bg-[var(--card)] p-2">
          <div className="mx-auto h-3 w-12 rounded bg-blue-500" />
          <div className="h-2 rounded bg-[var(--muted)]" />
          <div className="h-2 rounded bg-[var(--muted)]" />
          <div className="h-3 rounded bg-blue-500" />
        </div>
      </div>
    ),
  },
  {
    id: "primary-initial",
    name: "Primary authenticated initial page",
    example: "/home",
    description: "Post-login landing. Distinct from role-specific dashboards: welcome + quick actions + recent activity.",
    sketch: () => (
      <div className="space-y-1.5">
        <div className="h-3 w-2/3 rounded bg-[var(--muted)]" />
        <div className="grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 rounded bg-blue-100" />)}
        </div>
        <div className="h-12 rounded bg-[var(--muted)]" />
      </div>
    ),
  },
  {
    id: "landing",
    name: "Public landing page",
    example: "heuresys.com",
    description: "Marketing surface. Hero + features + CTA + footer. Brand-led, no shell.",
    sketch: () => (
      <div className="space-y-1.5">
        <div className="h-6 rounded bg-blue-600" />
        <div className="grid grid-cols-3 gap-1">
          <div className="h-8 rounded bg-[var(--muted)]" />
          <div className="h-8 rounded bg-[var(--muted)]" />
          <div className="h-8 rounded bg-[var(--muted)]" />
        </div>
        <div className="mx-auto h-3 w-1/3 rounded bg-blue-500" />
      </div>
    ),
  },
  {
    id: "data-table",
    name: "Data table page",
    example: "/users, /tenants, /admin/roles, /positions catalogue",
    description: "Filterable, sortable, paginated tabular list with row actions.",
    sketch: () => (
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <div className="h-3 w-1/3 rounded bg-[var(--muted)]" />
          <div className="h-3 w-1/4 rounded bg-blue-500" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="grid grid-cols-5 gap-1">
            {[1, 2, 3, 4, 5].map((j) => <div key={j} className="h-2 rounded bg-neutral-150" style={{ background: "#E5E7EB" }} />)}
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "form",
    name: "Form page",
    example: "/positions/new, /me/skills/self-assessment, /admin/roles/edit",
    description: "Single-task editor. Field group + validation + Save/Submit.",
    sketch: () => (
      <div className="space-y-1.5">
        <div className="h-3 w-1/2 rounded bg-[var(--muted)]" />
        <div className="grid grid-cols-2 gap-1.5">
          <div className="h-4 rounded bg-[var(--muted)]" />
          <div className="h-4 rounded bg-[var(--muted)]" />
          <div className="h-4 rounded bg-[var(--muted)]" />
          <div className="h-4 rounded bg-[var(--muted)]" />
        </div>
        <div className="ml-auto h-3 w-1/4 rounded bg-blue-500" />
      </div>
    ),
  },
];

export default function PageTypesShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Showcase</p>
        <h1 className="text-3xl font-semibold tracking-tight">Page types</h1>
        <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">
          Eight canonical Heuresys page types per bundle <code>docs/12_page_types_to_design.md</code>.
          Each ships with its own layout grammar; this index helps Product Owner and Development
          calibrate scope when designing a new module.
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PAGE_TYPES.map((p) => (
            <li key={p.id} className="hx-card-hover rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <div className="aspect-[4/3] rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
                {p.sketch()}
              </div>
              <h3 className="mt-3 text-base font-semibold tracking-tight">{p.name}</h3>
              <p className="mt-1 text-xs text-[var(--muted-foreground)] font-mono">{p.example}</p>
              <p className="mt-1.5 text-sm text-[var(--card-foreground)]">{p.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
