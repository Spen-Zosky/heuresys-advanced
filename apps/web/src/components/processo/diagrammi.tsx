"use client";

/**
 * apps/web/src/components/processo/diagrammi.tsx — i disegni della scheda del processo (V5 del piano
 * docs/piani/PIANO_processi-e-progetti-sistematici_20261118.md).
 *
 * Due disegni, sugli stessi dati di `GET /v1/processes/:id/scheda`, nella stessa area navigabile
 * degli organigrammi (adatta all'apertura, rotella e +/−, doppio clic sul vuoto riadatta,
 * trascinamento, doppio clic su un oggetto lo apre) e con l'esportazione in SVG:
 *   · il FLUSSO A CORSIE: una corsia per unità (chi esegue), le attività in ordine da sinistra a
 *     destra, una fascia per sottoprocesso in testa, le frecce fra un'attività e la successiva
 *     dello stesso sottoprocesso. È il diagramma a blocchi del banco del datastore («corsie dei
 *     ruoli»), ridisegnato con i dati del tenant;
 *   · il GRAFO A NODI: processo → sottoprocessi → attività → unità, per colonne.
 * Il testo che non sta in un riquadro va a capo su due righe e porta il titolo completo nel
 * suggerimento: niente si perde in silenzio (R5).
 *
 * Il giro di verifica del 25/11/2026 (classi N1, N3, N4) ha cambiato tre cose: i disegni si aprono
 * alla scala 1 (SCALA_APERTURA_PROCESSO) con nessun testo sotto i 12 px, invece di rimpicciolirsi
 * fino al 70% con il testo a 7 px; il titolo della fascia finisce con «…» quando si tronca; e il nome
 * accessibile di ogni oggetto che si apre contiene il testo che l'oggetto mostra (`nomeAccessibile`),
 * con il suggerimento (`<title>`) fuori dal pulsante, perché non entri nel testo che il pulsante mostra.
 */
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import type { TenantProcessScheda } from "@heuresys/shared";
import { AreaNavigabile, ATTR_OGGETTO } from "@/components/organigramma/area-navigabile";
import { svgEsportabile } from "@/components/organigramma/blocchi";
import { attivitaInOrdine, corsieFasi, dueRighe, etichettaAttivita, nomeAccessibile, propsApribili, unaRiga } from "./corsie-fasi";
import { SCALA_APERTURA_PROCESSO } from "@/lib/navigazione-area";

export { attivitaInOrdine, dueRighe };

const C = {
  riquadro: "var(--card)",
  fascia: "var(--muted)",
  testo: "var(--foreground)",
  tenue: "var(--muted-foreground)",
  bordo: "var(--muted-foreground)",
  forte: "var(--primary)",
};

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

function BottoneEsporta({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation("common");
  return (
    <button type="button" onClick={onClick} className="ml-1 inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">
      <Download className="h-3.5 w-3.5" />{t("organigramma.esportaSvg")}
    </button>
  );
}

/**
 * Un oggetto del disegno che si apre: porta sempre il suo nome (`aria-label`), che un gruppo SVG non ha
 * da sé. Il nome contiene il testo che l'oggetto mostra (`visibili`, nell'ordine in cui si legge).
 */
const aprendo = (visibili: readonly string[], completo: string, f: () => void) => ({ [ATTR_OGGETTO]: "", ...propsApribili(nomeAccessibile(visibili, completo), f) });

/** Uno spazio dopo ogni riga: il testo che il pulsante mostra si legge a parole separate, non incollate. */
const SP = " ";

/* ------------------------------------------------------------------ flusso a corsie */

const LW = 190; // larghezza dell'etichetta di corsia
const BW = 176, BH = 62, GX = 34, LH = 86, TOP = 34;

export function FlussoCorsie({
  scheda, senzaUnita, onApriAttivita, onApriUnita, nomeFile, ariaLabel, testId,
}: {
  scheda: TenantProcessScheda;
  senzaUnita: string;
  onApriAttivita: (id: string) => void;
  onApriUnita?: (id: string) => void;
  nomeFile: string;
  ariaLabel: string;
  testId?: string;
}) {
  const { ref, esporta } = useEsporta(nomeFile);
  const d = useMemo(() => {
    const att = attivitaInOrdine(scheda);
    const { corsie, indice } = corsieFasi(scheda, att, senzaUnita);
    const nomi = new Map([[scheda.process.processId, scheda.process.name], ...scheda.subprocesses.map((p) => [p.processId, p.name] as [string, string])]);
    const fasce: Array<{ processId: string; nome: string; da: number; a: number }> = [];
    att.forEach((a, i) => {
      const f = fasce[fasce.length - 1];
      if (f && f.processId === a.processId) f.a = i; else fasce.push({ processId: a.processId, nome: nomi.get(a.processId) ?? "", da: i, a: i });
    });
    const x = (i: number) => LW + 16 + i * (BW + GX);
    const y = (corsia: number) => TOP + 10 + corsia * LH + (LH - BH) / 2;
    const larghezza = Math.max(x(att.length) + 8, 480);
    const altezza = TOP + 10 + corsie.length * LH + 10;
    return { att, corsie, indice, fasce, x, y, larghezza, altezza };
  }, [scheda, senzaUnita]);

  return (
    <AreaNavigabile scalaMinFit={SCALA_APERTURA_PROCESSO} larghezza={d.larghezza} altezza={d.altezza} ariaLabel={ariaLabel} {...(testId ? { testId } : {})} strumenti={<BottoneEsporta onClick={esporta} />}>
      <svg ref={ref} role="group" aria-label={ariaLabel} width={d.larghezza} height={d.altezza} viewBox={`0 0 ${d.larghezza} ${d.altezza}`} fontFamily="Inter, Arial, Helvetica, sans-serif" className="block">
        <defs>
          <marker id="freccia-corsie" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" style={{ fill: C.bordo }} />
          </marker>
        </defs>
        {d.fasce.map((f) => {
          const x0 = d.x(f.da) - GX / 2 + 4, x1 = d.x(f.a) + BW + GX / 2 - 4;
          return (
            <g key={`${f.processId}-${f.da}`}>
              <rect x={x0} y={4} width={x1 - x0} height={TOP - 4} rx={4} style={{ fill: C.fascia }} />
              <text x={x0 + 8} y={TOP / 2 + 6} fontSize={12} fontWeight={600} style={{ fill: C.testo }}>
                <title>{f.nome}</title>
                {unaRiga(f.nome, Math.max(8, Math.floor((x1 - x0 - 16) / 7.5)))}
              </text>
            </g>
          );
        })}
        {d.corsie.map((c, i) => {
          const y0 = TOP + 10 + i * LH;
          return (
            <g key={c.chiave} data-testid="corsia">
              <rect x={0} y={y0} width={d.larghezza} height={LH} style={{ fill: i % 2 ? C.fascia : "transparent", fillOpacity: 0.35 }} />
              <line x1={0} x2={d.larghezza} y1={y0} y2={y0} style={{ stroke: C.bordo, strokeOpacity: 0.3 }} />
              <g>
                <title>{c.nome}</title>
                <g {...(c.id && onApriUnita ? aprendo(dueRighe(c.nome, 24), c.nome, () => onApriUnita(c.id!)) : {})}>
                  {dueRighe(c.nome, 24).map((r, k) => (
                    <text key={k} x={10} y={y0 + LH / 2 + (k - 0.5) * 16 + 4} fontSize={13} fontWeight={600} style={{ fill: C.testo }}>{r}{SP}</text>
                  ))}
                </g>
              </g>
            </g>
          );
        })}
        {d.att.map((a, i) => {
          const nx = d.att[i + 1];
          if (!nx || nx.processId !== a.processId) return null;
          const c0 = d.indice.get(a.unitId ?? `x:${a.unitName ?? a.executorName ?? ""}`)!;
          const c1 = d.indice.get(nx.unitId ?? `x:${nx.unitName ?? nx.executorName ?? ""}`)!;
          const x0 = d.x(i) + BW, y0 = d.y(c0) + BH / 2, x1 = d.x(i + 1), y1 = d.y(c1) + BH / 2;
          const xm = (x0 + x1) / 2;
          return <path key={`f-${a.activityId}`} d={`M${x0},${y0} H${xm} V${y1} H${x1 - 2}`} fill="none" markerEnd="url(#freccia-corsie)" style={{ stroke: C.bordo, strokeWidth: 1.4 }} />;
        })}
        {d.att.map((a, i) => {
          const c = d.indice.get(a.unitId ?? `x:${a.unitName ?? a.executorName ?? ""}`)!;
          const x = d.x(i), y = d.y(c);
          const nome = dueRighe(a.name, 23);
          return (
            <g key={a.activityId}>
              <title>{etichettaAttivita(a)}</title>
              <g data-testid="flusso-attivita" {...aprendo([String(a.ordinal), ...nome], etichettaAttivita(a), () => onApriAttivita(a.activityId))}>
                <rect x={x} y={y} width={BW} height={BH} rx={6} style={{ fill: C.riquadro, stroke: C.bordo, strokeWidth: 1 }} />
                <text x={x + 8} y={y + 16} fontSize={12} style={{ fill: C.tenue }}>{a.ordinal}{SP}</text>
                {nome.map((r, k) => (
                  <text key={k} x={x + 8} y={y + 33 + k * 16} fontSize={12} style={{ fill: C.testo }}>{r}{SP}</text>
                ))}
              </g>
            </g>
          );
        })}
      </svg>
    </AreaNavigabile>
  );
}

/* ------------------------------------------------------------------ diagramma per fasi */

const FCW = 220, FBW = 206, FLH = 120;

/**
 * Il diagramma per fasi: una colonna per attività (la «fase»), nell'ordine del catalogo, una corsia per
 * unità; il riquadro sta nella corsia di chi esegue, con il nome dell'esecutore. A differenza del flusso
 * a corsie NON disegna frecce: l'ordine è quello del catalogo, non una sequenza temporale (ADR-0061 §3,
 * la gerarchia non è il flusso). Le relazioni «precede» arriveranno col passo 6 dell'ADR.
 */
export function DiagrammaFasi({
  scheda, senzaUnita, senzaAttivita, ruoloUnita, onApriAttivita, onApriUnita, nomeFile, ariaLabel, testId,
}: {
  scheda: TenantProcessScheda;
  senzaUnita: string;
  /** il testo, già tradotto, di una corsia di un'unità del processo che non ha attività */
  senzaAttivita: string;
  /** il nome, già tradotto, del ruolo RACI di una unità nel processo */
  ruoloUnita: (unitId: string) => string | null;
  onApriAttivita: (id: string) => void;
  onApriUnita?: (id: string) => void;
  nomeFile: string;
  ariaLabel: string;
  testId?: string;
}) {
  const { ref, esporta } = useEsporta(nomeFile);
  const d = useMemo(() => {
    const att = attivitaInOrdine(scheda);
    const { corsie, indice, chiaveDi } = corsieFasi(scheda, att, senzaUnita);
    const nomi = new Map([[scheda.process.processId, scheda.process.name], ...scheda.subprocesses.map((p) => [p.processId, p.name] as [string, string])]);
    const fasce: Array<{ processId: string; nome: string; da: number; a: number }> = [];
    att.forEach((a, i) => {
      const f = fasce[fasce.length - 1];
      if (f && f.processId === a.processId) f.a = i; else fasce.push({ processId: a.processId, nome: nomi.get(a.processId) ?? "", da: i, a: i });
    });
    const LW2 = 210, TOP2 = 62;
    const x = (i: number) => LW2 + i * FCW + (FCW - FBW) / 2;
    const larghezza = Math.max(LW2 + att.length * FCW + 8, 480);
    const altezza = TOP2 + corsie.length * FLH + 6;
    const occupate = new Set(att.map(chiaveDi));
    return { att, corsie, indice, fasce, chiaveDi, occupate, x, LW2, TOP2, larghezza, altezza };
  }, [scheda, senzaUnita]);

  return (
    <AreaNavigabile scalaMinFit={SCALA_APERTURA_PROCESSO} larghezza={d.larghezza} altezza={d.altezza} ariaLabel={ariaLabel} {...(testId ? { testId } : {})} strumenti={<BottoneEsporta onClick={esporta} />}>
      <svg ref={ref} role="group" aria-label={ariaLabel} width={d.larghezza} height={d.altezza} viewBox={`0 0 ${d.larghezza} ${d.altezza}`} fontFamily="Inter, Arial, Helvetica, sans-serif" className="block">
        {d.fasce.map((f) => {
          const x0 = d.LW2 + f.da * FCW + 4, x1 = d.LW2 + (f.a + 1) * FCW - 4;
          return (
            <g key={`${f.processId}-${f.da}`}>
              <rect x={x0} y={4} width={x1 - x0} height={26} rx={4} style={{ fill: C.fascia }} />
              <text x={x0 + 8} y={22} fontSize={13} fontWeight={600} style={{ fill: C.testo }}>
                <title>{f.nome}</title>
                {unaRiga(f.nome, Math.max(8, Math.floor((x1 - x0 - 16) / 8)))}
              </text>
            </g>
          );
        })}
        {d.att.map((a, i) => (
          <text key={`h-${a.activityId}`} x={d.LW2 + i * FCW + FCW / 2} y={d.TOP2 - 8} fontSize={12} textAnchor="middle" style={{ fill: C.tenue }}>{`${a.ordinal} · ${a.code}`}</text>
        ))}
        {d.corsie.map((c, k) => {
          const y0 = d.TOP2 + k * FLH;
          const ruolo = c.id ? ruoloUnita(c.id) : null;
          const nomeCorsia = dueRighe(c.nome, 20);
          return (
            <g key={c.chiave} data-testid="fasi-corsia">
              <rect x={0} y={y0} width={d.larghezza} height={FLH} style={{ fill: k % 2 ? C.fascia : "transparent", fillOpacity: 0.35 }} />
              <line x1={0} x2={d.larghezza} y1={y0} y2={y0} style={{ stroke: C.bordo, strokeOpacity: 0.3 }} />
              {d.att.map((_, i) => <line key={i} x1={d.LW2 + i * FCW} x2={d.LW2 + i * FCW} y1={y0} y2={y0 + FLH} style={{ stroke: C.bordo, strokeOpacity: 0.15 }} />)}
              <g>
                <title>{c.nome}</title>
                <g {...(c.id && onApriUnita ? aprendo([...(ruolo ? [ruolo] : []), ...nomeCorsia], ruolo ? `${ruolo}: ${c.nome}` : c.nome, () => onApriUnita(c.id!)) : {})}>
                  {/* Il ruolo si scrive com'è tradotto, non in maiuscolo: «CONTRIBUTES» sembrava un codice (classe N3). */}
                  {ruolo ? <text x={10} y={y0 + 24} fontSize={12} fontWeight={700} style={{ fill: C.tenue }}>{ruolo}{SP}</text> : null}
                  {nomeCorsia.map((r, j) => (
                    <text key={j} x={10} y={y0 + 46 + j * 18} fontSize={14} fontWeight={600} style={{ fill: C.testo }}>{r}{SP}</text>
                  ))}
                </g>
              </g>
              {!d.occupate.has(c.chiave) ? <text x={d.LW2 + 14} y={y0 + FLH / 2 + 4} fontSize={12} fontStyle="italic" style={{ fill: C.tenue }}>{senzaAttivita}</text> : null}
            </g>
          );
        })}
        {d.att.map((a, i) => {
          const k = d.indice.get(d.chiaveDi(a))!;
          const x = d.x(i), y = d.TOP2 + k * FLH + 8;
          const nome = dueRighe(a.name, 22), esec = a.executorName ? unaRiga(a.executorName, 26) : null;
          const ore = a.typicalHoursPerCycle !== null ? `${a.typicalHoursPerCycle} h` : null;
          const completo = `${etichettaAttivita(a)}${ore ? `, ${ore}` : ""}`;
          return (
            <g key={a.activityId}>
              <title>{etichettaAttivita(a)}</title>
              <g data-testid="fasi-attivita" {...aprendo([...nome, ...(esec ? [esec] : []), ...(ore ? [ore] : [])], completo, () => onApriAttivita(a.activityId))}>
                <rect x={x} y={y} width={FBW} height={FLH - 16} rx={6} style={{ fill: C.riquadro, stroke: C.testo, strokeWidth: 1.4 }} />
                {nome.map((r, j) => <text key={j} x={x + 8} y={y + 20 + j * 16} fontSize={13} fontWeight={700} style={{ fill: C.testo }}>{r}{SP}</text>)}
                {esec ? <text x={x + 8} y={y + 20 + nome.length * 16 + 8} fontSize={12} style={{ fill: C.tenue }}>{esec}{SP}</text> : null}
                {ore ? <text x={x + 8} y={y + FLH - 22} fontSize={12} style={{ fill: C.tenue }}>{ore}{SP}</text> : null}
              </g>
            </g>
          );
        })}
      </svg>
    </AreaNavigabile>
  );
}

/* ------------------------------------------------------------------ grafo a nodi */

const NW = 212, NH = 42, CX = 270, RY = 54;

export function GrafoProcesso({
  scheda, onApriAttivita, onApriUnita, onApriProcesso, nomeFile, ariaLabel, testId,
}: {
  scheda: TenantProcessScheda;
  onApriAttivita: (id: string) => void;
  onApriUnita?: (id: string) => void;
  onApriProcesso: (id: string) => void;
  nomeFile: string;
  ariaLabel: string;
  testId?: string;
}) {
  const { ref, esporta } = useEsporta(nomeFile);
  const d = useMemo(() => {
    const att = attivitaInOrdine(scheda);
    const unita = [...new Map(att.filter((a) => a.unitId).map((a) => [a.unitId!, a.unitName ?? ""])).entries()].map(([id, nome]) => ({ id, nome }));
    const colonne = [
      [{ id: scheda.process.processId, nome: scheda.process.name, tipo: "processo" as const }],
      scheda.subprocesses.map((p) => ({ id: p.processId, nome: p.name, tipo: "sottoprocesso" as const })),
      att.map((a) => ({ id: a.activityId, nome: `${a.ordinal}. ${a.name}`, tipo: "attivita" as const })),
      unita.map((u) => ({ id: u.id, nome: u.nome, tipo: "unita" as const })),
    ].filter((c) => c.length > 0);
    const righe = Math.max(...colonne.map((c) => c.length));
    const altezza = righe * RY + 20;
    const pos = new Map<string, { x: number; y: number }>();
    colonne.forEach((col, ci) => {
      const off = (altezza - col.length * RY) / 2;
      col.forEach((n, ri) => pos.set(n.id, { x: 10 + ci * CX, y: off + ri * RY + (RY - NH) / 2 }));
    });
    const archi: Array<[string, string]> = [];
    for (const s of scheda.subprocesses) archi.push([scheda.process.processId, s.processId]);
    for (const a of att) {
      archi.push([a.processId, a.activityId]);
      if (a.unitId) archi.push([a.activityId, a.unitId]);
    }
    return { colonne, pos, archi, larghezza: 20 + colonne.length * CX - (CX - NW), altezza };
  }, [scheda]);

  const apri = (tipo: string, id: string) => {
    if (tipo === "attivita") onApriAttivita(id);
    else if (tipo === "unita") onApriUnita?.(id);
    else if (tipo === "sottoprocesso") onApriProcesso(id);
  };

  return (
    <AreaNavigabile scalaMinFit={SCALA_APERTURA_PROCESSO} larghezza={d.larghezza} altezza={d.altezza} ariaLabel={ariaLabel} {...(testId ? { testId } : {})} strumenti={<BottoneEsporta onClick={esporta} />}>
      <svg ref={ref} role="group" aria-label={ariaLabel} width={d.larghezza} height={d.altezza} viewBox={`0 0 ${d.larghezza} ${d.altezza}`} fontFamily="Inter, Arial, Helvetica, sans-serif" className="block">
        {d.archi.map(([da, a]) => {
          const p = d.pos.get(da), q = d.pos.get(a);
          if (!p || !q) return null;
          const x0 = p.x + NW, y0 = p.y + NH / 2, x1 = q.x, y1 = q.y + NH / 2, xm = (x0 + x1) / 2;
          return <path key={`${da}-${a}`} d={`M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1}`} fill="none" style={{ stroke: C.bordo, strokeOpacity: 0.55, strokeWidth: 1 }} />;
        })}
        {d.colonne.flat().map((n) => {
          const p = d.pos.get(n.id)!;
          const apribile = n.tipo !== "processo" && (n.tipo !== "unita" || Boolean(onApriUnita));
          const righe = dueRighe(n.nome, 28);
          return (
            <g key={`${n.tipo}-${n.id}`}>
              <title>{n.nome}</title>
              <g data-testid={`grafo-${n.tipo}`} {...(apribile ? aprendo(righe, n.nome, () => apri(n.tipo, n.id)) : {})}>
                <rect x={p.x} y={p.y} width={NW} height={NH} rx={n.tipo === "unita" ? NH / 2 : 6}
                  style={{ fill: n.tipo === "processo" ? C.forte : C.riquadro, stroke: n.tipo === "processo" ? C.forte : C.bordo, strokeWidth: n.tipo === "sottoprocesso" ? 1.6 : 1 }} />
                {righe.map((r, k, tutte) => (
                  <text key={k} x={p.x + 10} y={p.y + NH / 2 + (k - (tutte.length - 1) / 2) * 15 + 4} fontSize={12}
                    fontWeight={n.tipo === "attivita" ? 400 : 600} style={{ fill: n.tipo === "processo" ? "var(--primary-foreground)" : C.testo }}>{r}{SP}</text>
                ))}
              </g>
            </g>
          );
        })}
      </svg>
    </AreaNavigabile>
  );
}
