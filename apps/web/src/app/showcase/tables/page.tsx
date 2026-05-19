import Link from "next/link";

export const metadata = { title: "Showcase / Tables — Heuresys" };

const POSITIONS = [
  { code: "POS-1042", title: "Senior Risk Analyst", dept: "Risk Mgmt", level: "L4", incumbent: "Anna Bianchi", coverage: 92, gaps: 1, status: "Filled" },
  { code: "POS-1043", title: "Risk Analyst", dept: "Risk Mgmt", level: "L3", incumbent: "—", coverage: 0, gaps: 0, status: "Open" },
  { code: "POS-1044", title: "Stress Testing Lead", dept: "Risk Mgmt", level: "L5", incumbent: "Marco Conti", coverage: 88, gaps: 2, status: "Filled" },
  { code: "POS-1051", title: "Credit Modeler", dept: "Quant", level: "L4", incumbent: "Sofia Greco", coverage: 95, gaps: 0, status: "Filled" },
  { code: "POS-1052", title: "Quant Researcher", dept: "Quant", level: "L4", incumbent: "—", coverage: 0, gaps: 0, status: "Open" },
  { code: "POS-1067", title: "Compliance Officer", dept: "Legal & Compliance", level: "L4", incumbent: "Giulia Esposito", coverage: 74, gaps: 4, status: "At risk" },
  { code: "POS-1068", title: "AML Specialist", dept: "Legal & Compliance", level: "L3", incumbent: "Luca Romano", coverage: 81, gaps: 3, status: "Filled" },
  { code: "POS-1101", title: "Data Engineer", dept: "Data Platform", level: "L4", incumbent: "Davide Marini", coverage: 89, gaps: 2, status: "Filled" },
  { code: "POS-1102", title: "Senior Data Engineer", dept: "Data Platform", level: "L5", incumbent: "Chiara Rizzo", coverage: 96, gaps: 0, status: "Filled" },
  { code: "POS-1103", title: "Data Scientist", dept: "Data Platform", level: "L4", incumbent: "—", coverage: 0, gaps: 0, status: "Open" },
];

const STATUS_CLASS: Record<string, string> = {
  Filled: "bg-emerald-100 text-emerald-900 border-emerald-200",
  Open: "bg-blue-100 text-blue-900 border-blue-200",
  "At risk": "bg-amber-100 text-amber-900 border-amber-200",
};

function Table({ density }: { density: "compact" | "regular" | "relaxed" }) {
  const pad = density === "compact" ? "px-2 py-1" : density === "regular" ? "px-3 py-2" : "px-4 py-3";
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-[var(--muted)] text-left text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
            <th className={pad}>Code <span aria-hidden>↕</span></th>
            <th className={pad}>Title <span aria-hidden className="text-blue-600">↓</span></th>
            <th className={pad}>Dept</th>
            <th className={pad}>Level</th>
            <th className={pad}>Incumbent</th>
            <th className={`${pad} text-right`}>Coverage</th>
            <th className={`${pad} text-right`}>Gaps</th>
            <th className={pad}>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {POSITIONS.map((p) => (
            <tr key={p.code} className="hover:bg-[var(--muted)]">
              <td className={`${pad} font-mono text-xs text-[var(--muted-foreground)]`}>{p.code}</td>
              <td className={`${pad} font-medium text-[var(--card-foreground)]`}>{p.title}</td>
              <td className={`${pad} text-[var(--card-foreground)]`}>{p.dept}</td>
              <td className={`${pad} text-[var(--card-foreground)]`}>{p.level}</td>
              <td className={`${pad} text-[var(--card-foreground)]`}>{p.incumbent}</td>
              <td className={`${pad} text-right tabular-nums`}>{p.coverage > 0 ? `${p.coverage}%` : "—"}</td>
              <td className={`${pad} text-right tabular-nums`}>{p.gaps || "—"}</td>
              <td className={pad}>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[p.status] ?? ""}`}>{p.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TablesShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Showcase</p>
        <h1 className="text-3xl font-semibold tracking-tight">Tables — density, sort, filter, pagination</h1>
        <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">
          Positions catalogue with realistic Heuresys content (RTL_BANK_REFERENCE tenant). Demonstrates
          density variants, sort indicators, filter chips, status pills, tabular numerics.
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Regular density</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[var(--muted-foreground)]">Filters:</span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-900">Status: Open · ×</span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-[var(--card-foreground)]">Dept: Risk Mgmt · ×</span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-[var(--card-foreground)]">Level: L4+ · ×</span>
            <button className="rounded border border-[var(--border)] px-2 py-0.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]">+ Add filter</button>
          </div>
        </div>
        <Table density="regular" />
        <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
          <span>Showing 1–10 of 1,284 positions</span>
          <div className="flex items-center gap-1">
            <button className="rounded border border-[var(--border)] px-2 py-1 text-[var(--muted-foreground)]">‹ Prev</button>
            <button className="rounded border border-blue-500 bg-blue-50 px-2 py-1 text-blue-900">1</button>
            <button className="rounded border border-[var(--border)] px-2 py-1">2</button>
            <button className="rounded border border-[var(--border)] px-2 py-1">3</button>
            <span className="text-[var(--muted-foreground)]">…</span>
            <button className="rounded border border-[var(--border)] px-2 py-1">129</button>
            <button className="rounded border border-[var(--border)] px-2 py-1">Next ›</button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Compact density</h2>
        <Table density="compact" />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Relaxed density</h2>
        <Table density="relaxed" />
      </section>
    </div>
  );
}
