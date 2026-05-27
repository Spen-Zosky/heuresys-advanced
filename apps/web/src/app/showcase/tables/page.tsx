import Link from "next/link";
import { DataTableWithCrossHair } from "@/app/showcase/_ui-client";

export const metadata = { title: "Showcase / Tables — Heuresys" };

type StatusKey = "Filled" | "Open" | "At risk";

const POSITIONS: ReadonlyArray<Readonly<{
  code: string; title: string; dept: string; level: string; incumbent: string;
  coverage: number; gaps: number; status: StatusKey;
}>> = [
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

const STATUS_CLASS: Record<StatusKey, string> = {
  Filled: "border-success/30 bg-success/10 text-success",
  Open: "border-info/30 bg-info/10 text-info",
  "At risk": "border-warning/30 bg-warning/10 text-warning",
};

function StatusPill({ status }: { status: StatusKey }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[status]}`}>
      {status}
    </span>
  );
}

function TableBody({ density }: { density: "compact" | "regular" | "relaxed" }) {
  const pad = density === "compact" ? "px-2 py-1" : density === "regular" ? "px-3 py-2" : "px-4 py-3";
  return (
    <DataTableWithCrossHair className="border-collapse">
      <thead>
        <tr className="border-b border-border bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <th className={pad}>Code <span aria-hidden>↕</span></th>
          <th className={pad}>Title <span aria-hidden className="text-primary">↓</span></th>
          <th className={pad}>Dept</th>
          <th className={pad}>Level</th>
          <th className={pad}>Incumbent</th>
          <th className={`${pad} text-right`}>Coverage</th>
          <th className={`${pad} text-right`}>Gaps</th>
          <th className={pad}>Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {POSITIONS.map((p) => (
          <tr key={p.code} className="hover:bg-muted">
            <td className={`${pad} font-mono text-xs text-muted-foreground`}>{p.code}</td>
            <td className={`${pad} font-medium text-foreground`}>{p.title}</td>
            <td className={`${pad} text-foreground`}>{p.dept}</td>
            <td className={`${pad} text-foreground`}>{p.level}</td>
            <td className={`${pad} text-foreground`}>{p.incumbent}</td>
            <td className={`${pad} text-right tabular-nums`}>{p.coverage > 0 ? `${p.coverage}%` : "—"}</td>
            <td className={`${pad} text-right tabular-nums`}>{p.gaps || "—"}</td>
            <td className={pad}><StatusPill status={p.status} /></td>
          </tr>
        ))}
      </tbody>
    </DataTableWithCrossHair>
  );
}

export default function TablesShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Showcase</p>
        <h1 className="text-3xl font-semibold tracking-tight">Tables — density, sort, filter, cross-hair</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Positions catalogue with realistic Heuresys content (RTL_BANK_REFERENCE tenant). All
          density variants use <code>DataTableWithCrossHair</code> from <code>@heuresys/ui</code>{" "}
          which attaches column + cell highlight on hover. Status pills use semantic tokens
          (<code>--color-success</code> / <code>--color-info</code> / <code>--color-warning</code>) —
          change the palette in the showcase header to see them re-skin.
        </p>
        <p className="text-xs text-muted-foreground">
          Source of truth: <code>@heuresys/ui/dashboard/DataTableWithCrossHair</code> ·{" "}
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Regular density</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Filters:</span>
            <span className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-info">Status: Open · ×</span>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-card-foreground">Dept: Risk Mgmt · ×</span>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-card-foreground">Level: L4+ · ×</span>
            <button className="rounded border border-border px-2 py-0.5 text-muted-foreground hover:bg-muted">+ Add filter</button>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <TableBody density="regular" />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing 1–10 of 1,284 positions</span>
          <div className="flex items-center gap-1">
            <button className="rounded border border-border px-2 py-1 text-muted-foreground">‹ Prev</button>
            <button className="rounded border border-primary bg-primary/10 px-2 py-1 text-primary">1</button>
            <button className="rounded border border-border px-2 py-1">2</button>
            <button className="rounded border border-border px-2 py-1">3</button>
            <span className="text-muted-foreground">…</span>
            <button className="rounded border border-border px-2 py-1">129</button>
            <button className="rounded border border-border px-2 py-1">Next ›</button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Compact density</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <TableBody density="compact" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Relaxed density</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <TableBody density="relaxed" />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold tracking-tight">Status pill semantics</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="pb-2">Status</th>
              <th className="pb-2">Token</th>
              <th className="pb-2">Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-card-foreground">
            <tr><td className="py-2"><StatusPill status="Filled" /></td><td className="font-mono text-xs">--color-success</td><td>Position has an active incumbent.</td></tr>
            <tr><td className="py-2"><StatusPill status="Open" /></td><td className="font-mono text-xs">--color-info</td><td>Vacant + actively recruiting.</td></tr>
            <tr><td className="py-2"><StatusPill status="At risk" /></td><td className="font-mono text-xs">--color-warning</td><td>Filled but coverage &lt; 80% or 3+ gaps.</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
