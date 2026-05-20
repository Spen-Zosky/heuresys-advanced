import { DataTableWithCrossHair } from "@/components/ui/DataTableWithCrossHair";

/**
 * RBAC permissions matrix — sticky first column + tri-state cells.
 * Spec: docs/16_system_health_admin_dashboard_patterns.md § 7.
 */

export type RbacState = "granted" | "scoped" | "denied";

export type RbacRole = Readonly<{
  code: string;        // e.g. "PLATFORM_ADMIN"
  tone: "warning" | "palette-1" | "palette-2" | "palette-3" | "muted-foreground";
  label?: string;      // optional display name; defaults to code split by _ on two lines
}>;

export type RbacRow = Readonly<{
  permission: string;       // e.g. "users:read"
  description: string;
  states: ReadonlyArray<RbacState>;  // 1-to-1 with `roles` length
  scopeTitles?: ReadonlyArray<string | undefined>;  // optional per-cell scope explanation
}>;

export type RBACMatrixProps = Readonly<{
  roles: ReadonlyArray<RbacRole>;
  rows: ReadonlyArray<RbacRow>;
  lastReload?: string;
  totalMappings?: number;
  totalRoles?: number;
  totalPermissions?: number;
  onExportCsv?: () => void;
  onViewFull?: () => void;
}>;

export function RBACMatrix({ roles, rows, lastReload, totalMappings, totalRoles,
                            totalPermissions, onExportCsv, onViewFull }: RBACMatrixProps) {
  return (
    <section aria-label="RBAC permissions matrix">
      <article className="overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-control bg-palette-1/15 text-palette-1">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">RBAC permissions matrix</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {totalRoles ?? roles.length} roles × {totalMappings ?? "—"} mappings · cached in memory{lastReload ? ` · last reload ${lastReload}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Legend />
            {onExportCsv && (
              <button type="button" onClick={onExportCsv}
                      className="inline-flex h-9 items-center gap-2 rounded-control border border-border px-3 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground hover:border-foreground/30">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export CSV
              </button>
            )}
          </div>
        </div>

        <DataTableWithCrossHair enableCrossHair>
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <th className="sticky left-0 bg-muted/30 px-5 py-3 text-left">Permission</th>
              {roles.map((role) => {
                const lines = (role.label ?? role.code).split(/[_\s]+/);
                return (
                  <th key={role.code} className="px-2 py-3 text-center">
                    <span className={`block text-${role.tone}`}>
                      {lines.map((l, i) => <span key={i} className="block">{l}</span>)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.permission}>
                <td className="sticky left-0 bg-card px-5 py-2.5">
                  <div className="font-mono text-[12px] text-foreground">{row.permission}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{row.description}</div>
                </td>
                {row.states.map((state, i) => (
                  <td key={i} className="px-2 py-2.5">
                    <Cell state={state} title={row.scopeTitles?.[i]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </DataTableWithCrossHair>

        <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[10px] text-muted-foreground">
          <span className="font-mono">showing {rows.length}{totalPermissions != null ? ` / ${totalPermissions} permission codes` : ""}</span>
          {onViewFull && <button type="button" onClick={onViewFull} className="font-medium text-primary hover:underline">view full matrix →</button>}
        </div>
      </article>
    </section>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="inline-flex items-center gap-1"><span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-success/20 text-success"><svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg></span><span className="text-muted-foreground">granted</span></span>
      <span className="inline-flex items-center gap-1"><span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-warning/20 text-warning font-mono text-[9px] font-bold">◐</span><span className="text-muted-foreground">scoped</span></span>
      <span className="inline-flex items-center gap-1"><span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-muted text-muted-foreground/60">·</span><span className="text-muted-foreground">denied</span></span>
    </div>
  );
}

function Cell({ state, title }: { state: RbacState; title?: string }) {
  if (state === "granted") return (
    <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-sm bg-success/20 text-success">
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
    </span>
  );
  if (state === "scoped") return (
    <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-sm bg-warning/20 text-warning" title={title}>
      <span className="font-mono text-[10px] font-bold">◐</span>
    </span>
  );
  return <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-sm bg-muted text-muted-foreground/60">·</span>;
}
