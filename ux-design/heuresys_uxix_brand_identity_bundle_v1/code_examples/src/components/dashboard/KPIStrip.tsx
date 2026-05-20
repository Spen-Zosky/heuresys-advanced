import type { ReactNode } from "react";

/**
 * KPI strip — 5-card horizontal grid with sparklines.
 * Spec: docs/16_system_health_admin_dashboard_patterns.md § 2.
 */

export type KpiCardData = Readonly<{
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  icon?: ReactNode;
  iconTone?: "success" | "warning" | "danger" | "info" | "palette-1" | "palette-2" | "palette-3" | "palette-4";
  sparkline?: ReadonlyArray<number>;        // values normalized 0..1; rendered as polyline
  sparklineTone?: "success" | "warning" | "danger" | "info" | "primary";
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  /** Replace the default sparkline/footer slot with a custom body. */
  body?: ReactNode;
}>;

export type KPIStripProps = Readonly<{ items: ReadonlyArray<KpiCardData> }>;

export function KPIStrip({ items }: KPIStripProps) {
  return (
    <section aria-label="Indicatori principali" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {items.map((kpi, i) => (
        <KpiCard key={i} {...kpi} />
      ))}
    </section>
  );
}

export function KpiCard(props: KpiCardData) {
  const { label, value, unit, icon, iconTone = "success", sparkline, sparklineTone = "success",
          footerLeft, footerRight, body } = props;
  return (
    <article className="rounded-card border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="num text-2xl font-semibold text-foreground">{value}</span>
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
        </div>
        {icon && (
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-control bg-${iconTone}/10 text-${iconTone}`}>
            {icon}
          </span>
        )}
      </div>
      {body ?? (sparkline && <SparklineMini values={sparkline} tone={sparklineTone} />)}
      {(footerLeft || footerRight) && (
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{footerLeft}</span>
          <span>{footerRight}</span>
        </div>
      )}
    </article>
  );
}

function SparklineMini({ values, tone }: { values: ReadonlyArray<number>; tone: string }) {
  if (values.length < 2) return null;
  const W = 120, H = 28;
  const step = W / (values.length - 1);
  const points = values.map((v, i) => `${i * step},${H - v * (H - 4) - 2}`).join(" ");
  const areaPoints = `${points} ${W},${H} 0,${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-7 w-full" aria-hidden="true" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={`hsl(var(--${tone}))`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={areaPoints} fill={`hsl(var(--${tone}) / 0.12)`} stroke="none" />
    </svg>
  );
}
