import Link from "next/link";

export const metadata = { title: "Showcase / Charts — Heuresys" };

const HEATMAP = {
  cols: ["Risk Mgmt", "Quant", "Compliance", "Data Platform", "Engineering", "Product"],
  rows: ["Basel IV", "Stress testing", "Python", "SQL", "Stakeholder comms", "Regulatory"],
  values: [
    [95, 90, 70, 30, 25, 40],
    [88, 82, 64, 28, 22, 35],
    [40, 38, 25, 78, 85, 80],
    [55, 60, 30, 92, 88, 70],
    [70, 65, 78, 60, 58, 85],
    [62, 50, 88, 35, 30, 55],
  ],
};

const TOKEN_PRIMARY = "var(--color-primary)";
const TOKEN_BORDER = "var(--color-border)";
const TOKEN_FG = "var(--color-foreground)";
const TOKEN_MUTED_FG = "var(--color-muted-foreground)";
const TOKEN_BG = "var(--color-background)";
const TOKEN_SUCCESS = "var(--color-success)";
const TOKEN_WARNING = "var(--color-warning)";
const TOKEN_DANGER = "var(--color-destructive)";

function Heatmap() {
  const cellW = 84;
  const cellH = 36;
  return (
    <div className="overflow-x-auto">
      <svg
        width={(HEATMAP.cols.length + 1) * cellW + 20}
        height={(HEATMAP.rows.length + 1) * cellH + 10}
        role="img"
        aria-label="Skills coverage by department"
      >
        <g transform={`translate(${cellW},${cellH - 8})`}>
          {HEATMAP.cols.map((c, i) => (
            <text key={c} x={i * cellW + cellW / 2} y={0} textAnchor="middle" fontSize="11" fill={TOKEN_MUTED_FG}>
              {c}
            </text>
          ))}
        </g>
        {HEATMAP.rows.map((r, ri) => (
          <g key={r} transform={`translate(0,${(ri + 1) * cellH})`}>
            <text x={cellW - 8} y={cellH / 2 + 4} textAnchor="end" fontSize="11" fill={TOKEN_MUTED_FG}>
              {r}
            </text>
            {HEATMAP.cols.map((_, ci) => {
              const v = HEATMAP.values[ri]![ci]!;
              const opacity = 0.15 + (v / 100) * 0.85;
              return (
                <g key={ci} transform={`translate(${(ci + 1) * cellW},0)`}>
                  <rect x={2} y={2} width={cellW - 4} height={cellH - 4} fill={TOKEN_PRIMARY} opacity={opacity} rx={3} />
                  <text
                    x={cellW / 2}
                    y={cellH / 2 + 4}
                    textAnchor="middle"
                    fontSize="11"
                    fill={v > 60 ? TOKEN_BG : TOKEN_FG}
                  >
                    {v}%
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

function LineChart() {
  const data = [120, 142, 138, 165, 178, 195, 210, 198, 230, 245, 261, 280];
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const w = 560;
  const h = 180;
  const pad = 32;
  const max = Math.max(...data);
  const min = 0;
  const range = max - min || 1;
  const step = (w - pad * 2) / (data.length - 1);
  const points = data.map((d, i) => [pad + i * step, h - pad - ((d - min) / range) * (h - pad * 2)] as const);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Learning completions trend YTD" className="w-full">
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke={TOKEN_BORDER} />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke={TOKEN_BORDER} />
      <path d={path} fill="none" stroke={TOKEN_PRIMARY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={`${path} L${points[points.length - 1]![0]},${h - pad} L${pad},${h - pad} Z`}
        fill={TOKEN_PRIMARY}
        opacity="0.08"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={TOKEN_PRIMARY} />
      ))}
      {labels.map((l, i) => (
        <text key={l} x={pad + i * step} y={h - pad + 14} textAnchor="middle" fontSize="10" fill={TOKEN_MUTED_FG}>
          {l}
        </text>
      ))}
    </svg>
  );
}

function BarChart() {
  const data = [
    { dept: "Risk Mgmt", fill: 96 },
    { dept: "Quant", fill: 87 },
    { dept: "Compliance", fill: 92 },
    { dept: "Data Platform", fill: 89 },
    { dept: "Engineering", fill: 78 },
    { dept: "Product", fill: 65 },
  ];
  const w = 560;
  const h = 200;
  const pad = 80;
  const barH = 18;
  const gap = 8;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Position fill rate by department" className="w-full">
      {data.map((d, i) => {
        const y = pad / 4 + i * (barH + gap);
        const barW = ((w - pad - 30) * d.fill) / 100;
        return (
          <g key={d.dept}>
            <text x={pad - 8} y={y + barH / 2 + 4} textAnchor="end" fontSize="11" fill={TOKEN_MUTED_FG}>
              {d.dept}
            </text>
            <rect x={pad} y={y} width={w - pad - 30} height={barH} fill={TOKEN_BORDER} rx={3} />
            <rect x={pad} y={y} width={barW} height={barH} fill={TOKEN_PRIMARY} rx={3} />
            <text x={pad + barW + 6} y={y + barH / 2 + 4} fontSize="11" fill={TOKEN_FG}>
              {d.fill}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut() {
  const segments = [
    { label: "Critical (>2 gaps)", value: 47, color: TOKEN_DANGER },
    { label: "Watch (1–2 gaps)", value: 132, color: TOKEN_WARNING },
    { label: "Healthy (0 gaps)", value: 163, color: TOKEN_SUCCESS },
  ];
  const total = segments.reduce((a, b) => a + b.value, 0);
  const r = 60;
  const inner = 38;
  const cx = 90;
  const cy = 90;
  let acc = 0;
  return (
    <svg viewBox="0 0 240 180" role="img" aria-label="Skill gap distribution" className="w-full">
      {segments.map((s) => {
        const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
        acc += s.value;
        const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const x0 = cx + r * Math.cos(a0);
        const y0 = cy + r * Math.sin(a0);
        const x1 = cx + r * Math.cos(a1);
        const y1 = cy + r * Math.sin(a1);
        const xi0 = cx + inner * Math.cos(a1);
        const yi0 = cy + inner * Math.sin(a1);
        const xi1 = cx + inner * Math.cos(a0);
        const yi1 = cy + inner * Math.sin(a0);
        return (
          <path
            key={s.label}
            d={`M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${xi0},${yi0} A${inner},${inner} 0 ${large} 0 ${xi1},${yi1} Z`}
            fill={s.color}
          />
        );
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="600" fill={TOKEN_FG}>
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill={TOKEN_MUTED_FG}>
        positions
      </text>
      <g transform="translate(170,32)" fontSize="11">
        {segments.map((s, i) => (
          <g key={s.label} transform={`translate(0,${i * 22})`}>
            <rect width="10" height="10" fill={s.color} rx="2" />
            <text x="16" y="9" fill={TOKEN_FG}>
              {s.label}
            </text>
            <text x="16" y="22" fill={TOKEN_MUTED_FG} fontSize="10">
              {s.value} positions
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

export default function ChartsShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Showcase</p>
        <h1 className="text-3xl font-semibold tracking-tight">Charts — Heuresys workforce intelligence</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Native inline SVG charts on real domain data. All <code>fill</code> and{" "}
          <code>stroke</code> values reference design tokens via <code>var(--color-*)</code> — change
          the palette in the showcase header and every chart re-skins immediately. Bundle-deferred
          B-tier renderers (React Flow, Mermaid) follow once <code>UXIX-0005</code> is Accepted.
        </p>
        <p className="text-xs text-muted-foreground">
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Skills coverage heatmap — by department</h2>
        <div className="hx-card-hover rounded-xl border border-border bg-card p-5">
          <Heatmap />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="hx-card-hover rounded-xl border border-border bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold tracking-tight">Learning completions — trend YTD</h3>
          <LineChart />
        </div>
        <div className="hx-card-hover rounded-xl border border-border bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold tracking-tight">Position fill rate — by department</h3>
          <BarChart />
        </div>
      </section>

      <section className="hx-card-hover rounded-xl border border-border bg-card p-5">
        <h3 className="mb-2 text-sm font-semibold tracking-tight">Skill gap distribution</h3>
        <Donut />
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold tracking-tight">Token usage in this page</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="pb-2">Token</th>
              <th className="pb-2">Used for</th>
              <th className="pb-2">Charts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-card-foreground">
            <tr><td className="py-2 font-mono text-xs">var(--color-primary)</td><td>Series fill / stroke / accent dots</td><td>Heatmap, Line, Bar</td></tr>
            <tr><td className="py-2 font-mono text-xs">var(--color-border)</td><td>Axis lines, baseline track</td><td>Line, Bar</td></tr>
            <tr><td className="py-2 font-mono text-xs">var(--color-foreground)</td><td>Strong text (labels on filled cells, values, totals)</td><td>Heatmap, Bar, Donut</td></tr>
            <tr><td className="py-2 font-mono text-xs">var(--color-muted-foreground)</td><td>Secondary labels (axis ticks, captions)</td><td>Heatmap, Line, Bar, Donut</td></tr>
            <tr><td className="py-2 font-mono text-xs">var(--color-success)</td><td>Healthy segment</td><td>Donut</td></tr>
            <tr><td className="py-2 font-mono text-xs">var(--color-warning)</td><td>Watch segment</td><td>Donut</td></tr>
            <tr><td className="py-2 font-mono text-xs">var(--color-destructive)</td><td>Critical segment</td><td>Donut</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
