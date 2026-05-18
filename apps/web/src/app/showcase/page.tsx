import Link from "next/link";

type ShowcaseRoute = {
  href: string;
  title: string;
  blurb: string;
  status: "live" | "scaffold" | "pending";
  decisionId: string | null;
};

const ROUTES: ShowcaseRoute[] = [
  {
    href: "/showcase/shell",
    title: "Shell",
    blurb: "Fixed-viewport shell, expanded vs collapsed sidebar, independent scroll, Header+Footer immutability.",
    status: "scaffold",
    decisionId: "UXIX-0001",
  },
  {
    href: "/showcase/palettes",
    title: "Palettes",
    blurb: "Primary brand palette candidates A and B, side-by-side on identical UI fixtures.",
    status: "scaffold",
    decisionId: "UXIX-0005",
  },
  {
    href: "/showcase/typography",
    title: "Typography",
    blurb: "Typeface + scale candidates A (Exo 2) and B (alternative).",
    status: "scaffold",
    decisionId: "UXIX-0006",
  },
  {
    href: "/showcase/logo",
    title: "Logo",
    blurb: "Three logo candidates (hex node / H ladder / constellation) at full + symbol + collapsed sidebar scales, light + dark surfaces.",
    status: "scaffold",
    decisionId: "UXIX-0007",
  },
  { href: "/showcase/header", title: "Header", blurb: "Composition variants for the persistent top region.", status: "pending", decisionId: "UXIX-0002" },
  { href: "/showcase/sidebar", title: "Sidebar", blurb: "Tree groups open/closed, badges, active route, collapsed icon-only.", status: "pending", decisionId: "UXIX-0004" },
  { href: "/showcase/footer", title: "Footer", blurb: "Copyright + Heuresys.com link + 4 social icon variants.", status: "pending", decisionId: "UXIX-0003" },
  { href: "/showcase/icons", title: "Icons", blurb: "Lucide outline library + StatusIcon semantic tones.", status: "pending", decisionId: "UXIX-0008" },
  { href: "/showcase/page-types", title: "Page types", blurb: "Dashboard, module ±tabs, login, primary initial, public landing.", status: "pending", decisionId: null },
  { href: "/showcase/dashboard-cards", title: "Dashboard cards", blurb: "KPI cards, sparkline cards, data cards variants.", status: "pending", decisionId: null },
  { href: "/showcase/forms", title: "Forms", blurb: "Form controls + validation states.", status: "pending", decisionId: null },
  { href: "/showcase/tables", title: "Tables", blurb: "Density, sort, filter, pagination variants.", status: "pending", decisionId: null },
  { href: "/showcase/charts", title: "Charts", blurb: "Data viz showcases — bar, line, donut, heatmap on Heuresys domain.", status: "pending", decisionId: null },
  { href: "/showcase/landing-page", title: "Landing page", blurb: "Full prototype of the public marketing landing.", status: "pending", decisionId: null },
  { href: "/showcase/login-page", title: "Login page", blurb: "Full prototype of the authentication entry.", status: "pending", decisionId: null },
  { href: "/showcase/primary-initial-page", title: "Primary initial page", blurb: "Authenticated landing, distinct from role-specific dashboards.", status: "pending", decisionId: null },
];

const STATUS_LABEL: Record<ShowcaseRoute["status"], string> = {
  live: "Live",
  scaffold: "Scaffold",
  pending: "Pending",
};

const STATUS_CHIP_CLASS: Record<ShowcaseRoute["status"], string> = {
  live: "bg-emerald-100 text-emerald-900 border-emerald-200",
  scaffold: "bg-amber-100 text-amber-900 border-amber-200",
  pending: "bg-neutral-100 text-neutral-700 border-neutral-200",
};

export default function ShowcaseIndexPage() {
  const scaffolded = ROUTES.filter((r) => r.status !== "pending").length;
  const total = ROUTES.length;

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Brand identity showcase</h1>
        <p className="max-w-2xl text-sm text-neutral-600">
          Candidates and prototypes for the Heuresys brand identity v1. Use this index to navigate to each
          subject area. Decisions are tracked in{" "}
          <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs">docs/design-decisions/DECISION_REGISTER.md</code>.
        </p>
        <p className="text-xs uppercase tracking-wider text-neutral-500">
          {scaffolded} / {total} scaffolded · Session 1 in progress
        </p>
      </section>

      <section aria-labelledby="route-list">
        <h2 id="route-list" className="sr-only">Showcase routes</h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ROUTES.map((r) => {
            const interactive = r.status !== "pending";
            const Card = interactive ? Link : "div";
            const cardProps = interactive ? { href: r.href } : {};
            return (
              <li key={r.href}>
                <Card
                  {...(cardProps as { href: string })}
                  className={`block rounded-xl border border-neutral-200 bg-white p-5 transition ${
                    interactive ? "hover:border-neutral-400 hover:shadow-sm" : "opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold tracking-tight">{r.title}</h3>
                      <p className="mt-1 text-sm text-neutral-600">{r.blurb}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_CHIP_CLASS[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  {r.decisionId ? (
                    <p className="mt-3 text-xs text-neutral-500">
                      Tied to <code className="rounded bg-neutral-100 px-1 py-0.5">{r.decisionId}</code>
                    </p>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
