"use client";

/**
 * apps/web/src/components/progetto/gantt.tsx — il Gantt e il grafo delle dipendenze di un progetto
 * (V7 del piano docs/piani/PIANO_processi-e-progetti-sistematici_20261118.md).
 *
 * I dati sono quelli di `GET /v1/projects/:id/scheda`. Il Gantt si disegna solo dove ci sono le
 * date («Gantt dove applicabile», Enzo 18/11): una riga per fase nell'ordine dell'albero, la barra
 * pianificata a contorno, l'effettiva piena, l'avanzamento come riempimento, la tappa come rombo, le
 * dipendenze fine-inizio come frecce, la linea di oggi. Il grafo mette le fasi in colonne per
 * precedenza. Tutti e due stanno nell'area navigabile degli organigrammi, con l'esportazione SVG.
 */
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import type { ProjectScheda } from "@heuresys/shared";
import { AreaNavigabile, ATTR_OGGETTO } from "@/components/organigramma/area-navigabile";
import { svgEsportabile } from "@/components/organigramma/blocchi";
import { dueRighe } from "@/components/processo/diagrammi";

type Fase = ProjectScheda["phases"][number];

const C = {
  riquadro: "var(--card)",
  fascia: "var(--muted)",
  testo: "var(--foreground)",
  tenue: "var(--muted-foreground)",
  bordo: "var(--muted-foreground)",
  forte: "var(--primary)",
};

const GIORNO = 86_400_000;
const giorno = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / GIORNO;

/** Profondità di ogni fase nell'albero (0 = primo livello). */
export function profondita(fasi: Fase[]): Map<string, number> {
  const padre = new Map(fasi.map((f) => [f.phaseId, f.parentId]));
  const out = new Map<string, number>();
  for (const f of fasi) {
    let d = 0, p = f.parentId;
    const visti = new Set<string>();
    while (p && !visti.has(p)) { visti.add(p); d++; p = padre.get(p) ?? null; }
    out.set(f.phaseId, d);
  }
  return out;
}

export function haDate(fasi: Fase[]): boolean {
  return fasi.some((f) => f.plannedStart || f.plannedEnd || f.actualStart || f.actualEnd);
}

function useEsporta(nomeFile: string) {
  const ref = useRef<SVGSVGElement>(null);
  const esporta = () => {
    if (!ref.current) return;
    const blob = new Blob([svgEsportabile(ref.current)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${nomeFile}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return { ref, esporta };
}

function Esporta({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation("common");
  return (
    <button type="button" onClick={onClick} className="ml-1 inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">
      <Download className="h-3.5 w-3.5" />{t("organigramma.esportaSvg")}
    </button>
  );
}

const ETW = 260, RH = 28, TOP = 40, PXG = 14;

export function GanttProgetto({
  scheda, oggi, mesi, onApri, nomeFile, ariaLabel, testId,
}: {
  scheda: ProjectScheda;
  /** `YYYY-MM-DD` di oggi, passato da chi chiama (niente orologio dentro il disegno). */
  oggi: string;
  /** nomi brevi dei mesi, gennaio primo */
  mesi: readonly string[];
  onApri?: (phaseId: string) => void;
  nomeFile: string;
  ariaLabel: string;
  testId?: string;
}) {
  const { ref, esporta } = useEsporta(nomeFile);
  const d = useMemo(() => {
    const fasi = scheda.phases;
    const prof = profondita(fasi);
    const date = fasi.flatMap((f) => [f.plannedStart, f.plannedEnd, f.actualStart, f.actualEnd]).filter((x): x is string => Boolean(x));
    const g0 = Math.min(...date.map(giorno)) - 3;
    const g1 = Math.max(...date.map(giorno)) + 4;
    const giorni = Math.max(14, g1 - g0);
    const px = giorni > 400 ? 3 : giorni > 150 ? 6 : PXG;
    const x = (g: number) => ETW + (g - g0) * px;
    const riga = new Map(fasi.map((f, i) => [f.phaseId, i]));
    const larghezza = ETW + giorni * px + 20;
    const altezza = TOP + fasi.length * RH + 10;
    // le tacche dei mesi
    const tacche: Array<{ x: number; etichetta: string }> = [];
    const inizio = new Date(g0 * GIORNO);
    let m = Date.UTC(inizio.getUTCFullYear(), inizio.getUTCMonth() + 1, 1) / GIORNO;
    while (m < g0 + giorni) {
      const dm = new Date(m * GIORNO);
      tacche.push({ x: x(m), etichetta: `${mesi[dm.getUTCMonth()] ?? ""} ${dm.getUTCFullYear()}` });
      m = Date.UTC(dm.getUTCFullYear(), dm.getUTCMonth() + 1, 1) / GIORNO;
    }
    return { fasi, prof, x, riga, larghezza, altezza, tacche, px, g0, giorni };
  }, [scheda, mesi]);

  const gOggi = giorno(oggi);
  const yRiga = (i: number) => TOP + i * RH;

  return (
    <AreaNavigabile larghezza={d.larghezza} altezza={d.altezza} ariaLabel={ariaLabel} {...(testId ? { testId } : {})} strumenti={<Esporta onClick={esporta} />}>
      <svg ref={ref} role="group" aria-label={ariaLabel} width={d.larghezza} height={d.altezza} viewBox={`0 0 ${d.larghezza} ${d.altezza}`} fontFamily="Inter, Arial, Helvetica, sans-serif" className="block">
        <defs>
          <marker id="freccia-gantt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" style={{ fill: C.bordo }} />
          </marker>
        </defs>
        {d.tacche.map((tc) => (
          <g key={tc.x}>
            <line x1={tc.x} x2={tc.x} y1={TOP - 8} y2={d.altezza} style={{ stroke: C.bordo, strokeOpacity: 0.25 }} />
            <text x={tc.x + 4} y={TOP - 14} fontSize={11} style={{ fill: C.tenue }}>{tc.etichetta}</text>
          </g>
        ))}
        {d.fasi.map((f, i) => (
          <rect key={`sf-${f.phaseId}`} x={0} y={yRiga(i)} width={d.larghezza} height={RH} style={{ fill: i % 2 ? C.fascia : "transparent", fillOpacity: 0.35 }} />
        ))}
        {gOggi >= d.g0 && gOggi <= d.g0 + d.giorni ? (
          <line x1={d.x(gOggi)} x2={d.x(gOggi)} y1={TOP - 8} y2={d.altezza} data-testid="gantt-oggi" style={{ stroke: C.forte, strokeWidth: 1.5, strokeDasharray: "4 3" }} />
        ) : null}
        {scheda.dependencies.map((dep) => {
          const a = d.fasi.find((f) => f.phaseId === dep.predecessorId);
          const b = d.fasi.find((f) => f.phaseId === dep.successorId);
          if (!a || !b) return null;
          const fineA = dep.kind === "SS" || dep.kind === "SF" ? (a.plannedStart ?? a.plannedEnd) : (a.plannedEnd ?? a.plannedStart);
          const inizioB = dep.kind === "FF" || dep.kind === "SF" ? (b.plannedEnd ?? b.plannedStart) : (b.plannedStart ?? b.plannedEnd);
          if (!fineA || !inizioB) return null;
          const xa = d.x(giorno(fineA) + (dep.kind === "SS" || dep.kind === "SF" ? 0 : 1)), ya = yRiga(d.riga.get(a.phaseId)!) + RH / 2;
          const xb = d.x(giorno(inizioB) + (dep.kind === "FF" || dep.kind === "SF" ? 1 : 0)), yb = yRiga(d.riga.get(b.phaseId)!) + RH / 2;
          const xm = Math.max(xa + 6, Math.min(xb - 6, xa + 12));
          return <path key={dep.dependencyId} data-testid="gantt-dipendenza" d={`M${xa},${ya} H${xm} V${yb} H${xb - 1}`} fill="none" markerEnd="url(#freccia-gantt)" style={{ stroke: C.bordo, strokeWidth: 1.2 }} />;
        })}
        {d.fasi.map((f, i) => {
          const y = yRiga(i);
          const rientro = (d.prof.get(f.phaseId) ?? 0) * 14;
          const apri = onApri ? { [ATTR_OGGETTO]: "", style: { cursor: "pointer" }, onDoubleClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onApri(f.phaseId); } } : {};
          const ps = f.plannedStart ?? f.plannedEnd, pe = f.plannedEnd ?? f.plannedStart;
          const as = f.actualStart, ae = f.actualEnd ?? (f.actualStart ? (f.status === "COMPLETED" ? f.actualStart : null) : null);
          return (
            <g key={f.phaseId} data-testid="gantt-riga" {...apri}>
              <title>{`${f.name}${ps ? ` — ${ps}${pe && pe !== ps ? ` → ${pe}` : ""}` : ""}`}</title>
              <text x={8 + rientro} y={y + RH / 2 + 4} fontSize={11.5} fontWeight={f.kind === "PHASE" ? 600 : 400} style={{ fill: C.testo }}>
                {dueRighe(f.name, Math.max(10, Math.floor((ETW - 16 - rientro) / 6.6)))[0]}
              </text>
              {f.kind === "MILESTONE" && ps ? (
                <path data-testid="gantt-tappa" d={`M${d.x(giorno(ps) + 0.5)},${y + 6} l8,8 l-8,8 l-8,-8 z`} style={{ fill: C.forte }} />
              ) : ps && pe ? (
                <g data-testid="gantt-barra">
                  <rect x={d.x(giorno(ps))} y={y + 6} width={Math.max(3, (giorno(pe) - giorno(ps) + 1) * d.px)} height={RH - 12} rx={3}
                    style={{ fill: f.kind === "PHASE" ? C.fascia : C.riquadro, stroke: C.bordo, strokeWidth: 1 }} />
                  {f.progressPct !== null ? (
                    <rect x={d.x(giorno(ps))} y={y + 6} width={Math.max(0, (giorno(pe) - giorno(ps) + 1) * d.px * (f.progressPct / 100))} height={RH - 12} rx={3}
                      style={{ fill: C.forte, fillOpacity: 0.35 }} />
                  ) : null}
                </g>
              ) : null}
              {as ? (
                <rect x={d.x(giorno(as))} y={y + RH - 7} width={Math.max(3, ((ae ? giorno(ae) : Math.max(giorno(as), gOggi)) - giorno(as) + 1) * d.px)} height={3}
                  style={{ fill: C.forte }} />
              ) : null}
            </g>
          );
        })}
      </svg>
    </AreaNavigabile>
  );
}

/* ------------------------------------------------------------------ grafo delle dipendenze */

const NW = 200, NH = 40, CX = 250, RY = 54;

export function GrafoDipendenze({
  scheda, onApri, nomeFile, ariaLabel, testId,
}: {
  scheda: ProjectScheda;
  onApri?: (phaseId: string) => void;
  nomeFile: string;
  ariaLabel: string;
  testId?: string;
}) {
  const { ref, esporta } = useEsporta(nomeFile);
  const d = useMemo(() => {
    // colonne per precedenza: la colonna di una fase è uno più la massima dei suoi predecessori
    const fasi = scheda.phases.filter((f) => f.kind !== "PHASE" || scheda.dependencies.some((x) => x.predecessorId === f.phaseId || x.successorId === f.phaseId));
    const pred = new Map<string, string[]>();
    for (const x of scheda.dependencies) pred.set(x.successorId, [...(pred.get(x.successorId) ?? []), x.predecessorId]);
    const col = new Map<string, number>();
    const calcola = (id: string, giro: Set<string>): number => {
      if (col.has(id)) return col.get(id)!;
      if (giro.has(id)) return 0;
      giro.add(id);
      const c = Math.max(-1, ...(pred.get(id) ?? []).map((p) => calcola(p, giro))) + 1;
      col.set(id, c);
      return c;
    };
    for (const f of fasi) calcola(f.phaseId, new Set());
    const colonne: Fase[][] = [];
    for (const f of fasi) { const c = col.get(f.phaseId) ?? 0; (colonne[c] ??= []).push(f); }
    const righe = Math.max(1, ...colonne.map((c) => c?.length ?? 0));
    const altezza = righe * RY + 20;
    const pos = new Map<string, { x: number; y: number }>();
    colonne.forEach((cc, ci) => {
      const off = (altezza - cc.length * RY) / 2;
      cc.forEach((f, ri) => pos.set(f.phaseId, { x: 10 + ci * CX, y: off + ri * RY + (RY - NH) / 2 }));
    });
    return { fasi, pos, larghezza: 20 + Math.max(1, colonne.length) * CX - (CX - NW), altezza };
  }, [scheda]);

  return (
    <AreaNavigabile larghezza={d.larghezza} altezza={d.altezza} ariaLabel={ariaLabel} {...(testId ? { testId } : {})} strumenti={<Esporta onClick={esporta} />}>
      <svg ref={ref} role="group" aria-label={ariaLabel} width={d.larghezza} height={d.altezza} viewBox={`0 0 ${d.larghezza} ${d.altezza}`} fontFamily="Inter, Arial, Helvetica, sans-serif" className="block">
        <defs>
          <marker id="freccia-dipendenze" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" style={{ fill: C.bordo }} />
          </marker>
        </defs>
        {scheda.dependencies.map((x) => {
          const p = d.pos.get(x.predecessorId), q = d.pos.get(x.successorId);
          if (!p || !q) return null;
          const x0 = p.x + NW, y0 = p.y + NH / 2, x1 = q.x, y1 = q.y + NH / 2, xm = (x0 + x1) / 2;
          return <path key={x.dependencyId} d={`M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1 - 2},${y1}`} fill="none" markerEnd="url(#freccia-dipendenze)" style={{ stroke: C.bordo, strokeWidth: 1.2 }} />;
        })}
        {d.fasi.map((f) => {
          const p = d.pos.get(f.phaseId)!;
          const apri = onApri ? { [ATTR_OGGETTO]: "", style: { cursor: "pointer" }, onDoubleClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onApri(f.phaseId); } } : {};
          return (
            <g key={f.phaseId} data-testid="grafo-fase" {...apri}>
              <title>{f.name}</title>
              <rect x={p.x} y={p.y} width={NW} height={NH} rx={f.kind === "MILESTONE" ? NH / 2 : 6}
                style={{ fill: f.kind === "MILESTONE" ? C.forte : C.riquadro, stroke: C.bordo, strokeWidth: 1 }} />
              {dueRighe(f.name, 28).map((r, k, tutte) => (
                <text key={k} x={p.x + 10} y={p.y + NH / 2 + (k - (tutte.length - 1) / 2) * 13 + 4} fontSize={11}
                  style={{ fill: f.kind === "MILESTONE" ? "var(--primary-foreground)" : C.testo }}>{r}</text>
              ))}
            </g>
          );
        })}
      </svg>
    </AreaNavigabile>
  );
}
