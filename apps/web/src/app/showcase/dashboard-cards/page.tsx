import Link from "next/link";

export const metadata = { title: "Showcase / Dashboard cards — Heuresys" };

function SimpleKpiCard({ label, value, delta, tone }: { label: string; value: string; delta: string; tone: "positive" | "negative" | "neutral" }) {
  const toneClass = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-700" : "text-[var(--muted-foreground)]";
  return (
    <div className="hx-card-hover rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className={`mt-1 text-xs ${toneClass}`}>{delta}</p>
    </div>
  );
}

function SparklineCard({ label, value, delta, points }: { label: string; value: string; delta: string; points: number[] }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const w = 200;
  const h = 50;
  const step = w / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${i * step},${h - ((p - min) / range) * h}`).join(" ");
  return (
    <div className="hx-card-hover rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-emerald-700">{delta}</p>
        </div>
        <svg width={w} height={h} className="text-blue-600" aria-hidden>
          <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function ProgressCard({ label, value, target, pct }: { label: string; value: string; target: string; pct: number }) {
  return (
    <div className="hx-card-hover rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</p>
      <div className="mt-1 flex items-baseline justify-between">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        <p className="text-xs text-[var(--muted-foreground)]">of {target}</p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-[var(--muted)]">
        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{pct}% capacity</p>
    </div>
  );
}

function MultiStatCard() {
  const segments = [
    { label: "Validated", value: 412, color: "#16A34A" },
    { label: "Self-assessed", value: 287, color: "#F59E0B" },
    { label: "Pending", value: 113, color: "#94A3B8" },
  ];
  const total = segments.reduce((a, b) => a + b.value, 0);
  let acc = 0;
  return (
    <div className="hx-card-hover rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">Skill records by source</p>
        <p className="text-xs text-[var(--muted-foreground)] tabular-nums">{total} total</p>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[var(--muted)]">
        {segments.map((s) => {
          const w = (s.value / total) * 100;
          acc += w;
          return <div key={s.label} style={{ width: `${w}%`, background: s.color }} />;
        })}
      </div>
      <ul className="mt-3 space-y-1 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="tabular-nums text-[var(--muted-foreground)]">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActivityCard() {
  const items = [
    { t: "14:02", text: "Mario Rossi self-assessed 4 skills", tag: "Skills" },
    { t: "13:48", text: "Anna Bianchi completed 'GDPR Foundations'", tag: "Learning" },
    { t: "13:21", text: "Tenant RTL_BANK_REFERENCE refreshed", tag: "Ops" },
    { t: "12:55", text: "Position 'Senior Risk Analyst' opened", tag: "Workforce" },
  ];
  return (
    <div className="hx-card-hover rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">Recent activity</p>
      <ul className="mt-3 divide-y divide-[var(--border)]">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3 py-2 text-sm">
            <span className="w-12 shrink-0 font-mono text-xs text-[var(--muted-foreground)]">{it.t}</span>
            <span className="flex-1 text-[var(--card-foreground)]">{it.text}</span>
            <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--card-foreground)]">{it.tag}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DashboardCardsShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Showcase</p>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard cards</h1>
        <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">
          KPI + data card variants on realistic Heuresys workforce content. Card surfaces, radius and
          shadow inherit from <code>tokens.css</code>; values use <code>font-variant-numeric: tabular-nums</code> for KPI alignment.
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Simple KPI</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SimpleKpiCard label="Active positions" value="1,284" delta="+12 this week" tone="positive" />
          <SimpleKpiCard label="Open skill gaps" value="342" delta="−18 vs last month" tone="positive" />
          <SimpleKpiCard label="Critical certifications expiring" value="27" delta="+5 in 30d" tone="negative" />
          <SimpleKpiCard label="Tenants live" value="23" delta="+1 (RTL_BANK_REFERENCE)" tone="neutral" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Sparkline</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SparklineCard
            label="Learning completions — last 12 weeks"
            value="5,917 YTD"
            delta="78% of annual plan"
            points={[120, 142, 138, 165, 178, 195, 210, 198, 230, 245, 261, 280]}
          />
          <SparklineCard
            label="Position fill rate"
            value="94.2%"
            delta="+1.3pp QoQ"
            points={[88, 89, 89.5, 90, 91.2, 91.8, 92.5, 92.9, 93.4, 93.7, 94.0, 94.2]}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Progress vs target</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ProgressCard label="Hiring plan H1 2026" value="412" target="500" pct={82} />
          <ProgressCard label="Mandatory training Q2" value="2,914" target="3,200" pct={91} />
          <ProgressCard label="Position descriptions reviewed" value="876" target="1,284" pct={68} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Composite</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MultiStatCard />
          <ActivityCard />
        </div>
      </section>
    </div>
  );
}
