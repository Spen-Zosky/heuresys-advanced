import { GroupToggle } from "@/components/dashboard/GroupToggle";

/**
 * DB Supervisor sidebar entry — special palette-2 callout + sub-tree preview.
 * Spec: docs/07_sidebar_specification.md § "DB Supervisor sidebar entry — special variant"
 *       + docs/16_system_health_admin_dashboard_patterns.md § 11.
 *
 * Renders inside the "Database" sidebar group. The sub-tree preview lists the
 * 12 DBMS object types covered by the dedicated multi-tab DB Supervisor page.
 */

export type DBSubItem = Readonly<{ label: string; count: string }>;

export const DB_SUBITEMS: ReadonlyArray<DBSubItem> = [
  { label: "Schemas",            count: "5" },
  { label: "Tables",             count: "576" },
  { label: "Views & MViews",     count: "42" },
  { label: "Indexes",            count: "1 284" },
  { label: "Functions & Proc.",  count: "118" },
  { label: "Triggers",           count: "63" },
  { label: "Sequences",          count: "189" },
  { label: "Constraints & FKs",  count: "950" },
  { label: "Roles & Grants",     count: "14" },
  { label: "Extensions",         count: "9" },
  { label: "Connection Pools",   count: "3" },
  { label: "Backups & PITR",     count: "14d" },
  { label: "Vacuum & Bloat",     count: "ok" },
];

export function DBSupervisorSidebar() {
  return (
    <GroupToggle groupId="database" label={
      <span className="flex items-baseline gap-1.5">
        <span>Database</span>
        <span className="font-mono text-[9px] normal-case tracking-normal text-muted-foreground/60">pg 16</span>
      </span>
    }>
      <li>
        <a href="#" className="nav-link flex items-center justify-between gap-2 rounded-control border border-palette-2/30 bg-palette-2/5 px-2 py-2 text-sm font-medium text-foreground transition hover:bg-palette-2/10 hover:border-palette-2/50">
          <span className="flex min-w-0 items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-palette-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            <span className="nav-label truncate">DB Supervisor</span>
          </span>
          <span className="nav-aux inline-flex items-center gap-0.5 rounded-sm bg-palette-2/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-palette-2"
                title="Apre pagina con tabs dedicate per ogni oggetto DBMS">
            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="4" />
              <rect x="3" y="10" width="18" height="4" />
              <rect x="3" y="16" width="18" height="4" />
            </svg>
            tabs
          </span>
        </a>
        <ul className="sidebar-subtree mt-1 ml-3 space-y-0.5 border-l border-border/60 pl-2.5">
          {DB_SUBITEMS.map((item) => (
            <li key={item.label}>
              <a href="#" className="flex items-center justify-between gap-2 rounded-control px-2 py-1 text-[12px] text-muted-foreground transition hover:bg-accent hover:text-foreground">
                <span>{item.label}</span>
                <span className="num font-mono text-[10px] text-muted-foreground/70">{item.count}</span>
              </a>
            </li>
          ))}
        </ul>
      </li>
    </GroupToggle>
  );
}
