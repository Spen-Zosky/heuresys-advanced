import Link from "next/link";
import {
  DashboardFooter,
  DashboardHeader,
  DashboardShell,
  DashboardSidebar,
  HeuresysLogoBadge,
  HeuresysWordmark,
} from "@/app/showcase/_ui-client";
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  Database,
  Layers,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

export const metadata = { title: "Showcase / Sidebar — Heuresys" };

const ICON_CLS = "h-4 w-4 shrink-0";

const SIDEBAR_GROUPS = [
  {
    id: "workforce",
    label: "Workforce",
    items: [
      { id: "positions", label: "Positions", href: "#", icon: <Briefcase className={ICON_CLS} /> },
      {
        id: "skills",
        label: "Skills",
        href: "#",
        icon: <Layers className={ICON_CLS} />,
        aux: <span className="rounded-full bg-warning/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-warning">12</span>,
        active: true,
      },
      { id: "competencies", label: "Competencies", href: "#", icon: <BookOpen className={ICON_CLS} /> },
      {
        id: "career",
        label: "Career & succession",
        href: "#",
        icon: <Users className={ICON_CLS} />,
        aux: <span className="font-mono text-[10px] text-muted-foreground">3</span>,
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { id: "blueprints", label: "Blueprints", href: "#", icon: <Layers className={ICON_CLS} /> },
      { id: "processes", label: "Processes", href: "#", icon: <ScrollText className={ICON_CLS} /> },
      {
        id: "brownfield",
        label: "Brownfield adaptation",
        href: "#",
        icon: <Database className={ICON_CLS} />,
        aux: <span className="font-mono text-[10px] text-muted-foreground">47k</span>,
      },
      { id: "seeds", label: "Seed acquisition", href: "#", icon: <Layers className={ICON_CLS} /> },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { id: "kpis", label: "KPIs", href: "#", icon: <AlertCircle className={ICON_CLS} /> },
      {
        id: "gaps",
        label: "Gaps",
        href: "#",
        icon: <AlertCircle className={ICON_CLS} />,
        aux: <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-destructive">342</span>,
      },
      { id: "comp", label: "Compensation intelligence", href: "#", icon: <Layers className={ICON_CLS} /> },
      {
        id: "viz",
        label: "Visualizations",
        href: "#",
        icon: <Layers className={ICON_CLS} />,
        aux: <span className="inline-flex h-1.5 w-1.5 rounded-full bg-info pulse-dot" />,
      },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    defaultExpanded: false,
    items: [
      { id: "tenants", label: "Tenants", href: "#", icon: <Layers className={ICON_CLS} /> },
      { id: "users", label: "Platform Users", href: "#", icon: <Users className={ICON_CLS} /> },
      { id: "roles", label: "Admin / Roles", href: "#", icon: <ShieldCheck className={ICON_CLS} /> },
      { id: "config", label: "Configuration", href: "#", icon: <Settings className={ICON_CLS} /> },
    ],
  },
];

export default function SidebarShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">UXIX-0004 · Proposed</p>
        <h1 className="text-3xl font-semibold tracking-tight">Sidebar — tree state + collapse</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Live <code>DashboardSidebar</code> from <code>@heuresys/ui</code>. Two independent state
          levels: <code>sidebarCollapsed</code> (width 260 ↔ 72, persisted to{" "}
          <code>localStorage</code> key <code>heuresys-sidebar</code>) and per-group{" "}
          <code>defaultExpanded</code> tracked on{" "}
          <code>heuresys-sidebar-groups</code>. Active route highlighted with{" "}
          <code>bg-accent</code> + 2px inset shadow in <code>--primary</code>. Badges show
          actionable counts. Per bundle <code>docs/07_sidebar_specification.md</code>.
        </p>
        <p className="text-xs text-muted-foreground">
          Source of truth: <code>@heuresys/ui/dashboard/DashboardSidebar</code> ·{" "}
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section aria-labelledby="live-sidebar" className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="live-sidebar" className="text-base font-semibold tracking-tight">
            Live sidebar — try the collapse toggle and click group headers
          </h2>
          <p className="text-[11px] text-muted-foreground">Active item · skills (Workforce group)</p>
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
                    <span>showcase / sidebar</span>
                  </>
                }
              />
            }
          >
            <div className="space-y-3">
              <h3 className="text-xl font-semibold tracking-tight">Skills</h3>
              <p className="text-sm text-muted-foreground">
                The sidebar on the left is the actual <code>DashboardSidebar</code> primitive. Try:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-card-foreground">
                <li>Click the collapse toggle (top-right of sidebar header) to switch 260 → 72px</li>
                <li>Click a group header (Workforce / Operations / …) to fold its items</li>
                <li>Hover an icon-only item when collapsed — full label restored via <code>title</code></li>
                <li>Reload the page — both state levels persist via <code>localStorage</code></li>
              </ul>
            </div>
          </DashboardShell>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold tracking-tight">Aux slot taxonomy</h2>
        <p className="mt-2 text-sm text-card-foreground">
          Each <code>NavItem</code> can carry an <code>aux</code> slot rendered on the right side
          of the row (hidden when collapsed). Six canonical patterns:
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="pb-2">Pattern</th>
              <th className="pb-2">Use</th>
              <th className="pb-2">Live example</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-card-foreground">
            <tr>
              <td className="py-2">Neutral count</td>
              <td>Inactive counter (career queue size)</td>
              <td><span className="font-mono text-[10px] text-muted-foreground">3</span></td>
            </tr>
            <tr>
              <td className="py-2">Warning chip</td>
              <td>Soft attention (gap discovered)</td>
              <td><span className="rounded-full bg-warning/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-warning">12</span></td>
            </tr>
            <tr>
              <td className="py-2">Danger chip</td>
              <td>Hard attention (critical gaps)</td>
              <td><span className="rounded-full bg-destructive/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-destructive">342</span></td>
            </tr>
            <tr>
              <td className="py-2">Volume hint</td>
              <td>Large dataset signal (rows queued)</td>
              <td><span className="font-mono text-[10px] text-muted-foreground">47k</span></td>
            </tr>
            <tr>
              <td className="py-2">Info pulse</td>
              <td>Live activity (data viz refresh)</td>
              <td><span className="inline-flex h-1.5 w-1.5 rounded-full bg-info pulse-dot align-middle" /></td>
            </tr>
            <tr>
              <td className="py-2">Success pulse</td>
              <td>OK / live (e.g. system-health active)</td>
              <td><span className="inline-flex h-1.5 w-1.5 rounded-full bg-success pulse-dot align-middle" /></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold tracking-tight">State model</h2>
        <pre className="mt-3 overflow-x-auto rounded bg-muted p-3 text-xs">
{`localStorage["heuresys-sidebar"]        = "collapsed" | "expanded"
localStorage["heuresys-sidebar-groups"] = JSON({ workforce: true, operations: false, ... })

document.body[data-sidebar]              = "collapsed" | (absent when expanded)
document.querySelector('[data-shell="grid"]').style.gridTemplateColumns
                                         = "260px 1fr" | "72px 1fr" (with !important)`}
        </pre>
        <p className="mt-3 text-sm text-card-foreground">
          When <code>data-sidebar=&quot;collapsed&quot;</code> is set on body, CSS hides the
          group labels and <code>.nav-label</code> spans; items render icon-only. The full label
          is restored on hover via the <code>title</code> attribute. The <code>!important</code>{" "}
          on <code>grid-template-columns</code> is required because of a known Chrome quirk where
          a transition can fight Tailwind utilities.
        </p>
      </section>
    </div>
  );
}
