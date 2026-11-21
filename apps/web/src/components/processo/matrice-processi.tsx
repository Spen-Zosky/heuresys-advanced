"use client";

/**
 * apps/web/src/components/processo/matrice-processi.tsx — la mappa processi × unità (passo 1 del
 * piano docs/piani/PIANO_revisione-frontend-da-datastore_20261121.md).
 *
 * Stessa mappa della corsa del datastore, sui dati vivi del tenant (GET /v1/processes/matrice):
 * righe = processi (i sottoprocessi sotto il loro processo), colonne = unità che partecipano ad
 * almeno un processo con l'intestazione verticale, celle = R (responsabile, pieno), E (esecutrice,
 * grigio), C (consultata, tratteggio), I (informata, chiaro). La colonna E/C conta le unità
 * esecutrici e consultate; il nome intero dell'unità compare passando sopra l'intestazione; il clic
 * sul processo ne apre la scheda.
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TenantProcessMatrixResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useFormat } from "@/lib/format";
import { StatoCaricamento, StatoErrore } from "@/components/stato-pagina";

type Ruolo = TenantProcessMatrixResponse["cells"][number]["role"];

const SIGLA: Record<Ruolo, string> = { OWNER: "R", CONTRIBUTOR: "E", CONSULTED: "C", INFORMED: "I" };
const CELLA: Record<Ruolo, string> = {
  OWNER: "bg-foreground font-semibold text-background",
  CONTRIBUTOR: "bg-muted-foreground/60 text-foreground",
  CONSULTED: "bg-background text-foreground outline outline-1 -outline-offset-[3px] outline-dashed outline-muted-foreground",
  INFORMED: "bg-muted text-muted-foreground",
};

export function MatriceProcessi({ tenantId }: { tenantId?: string }) {
  const { t } = useTranslation("blueprints");
  const fmt = useFormat();
  const q = useQuery({
    queryKey: ["processes", "matrice", tenantId ?? null],
    queryFn: ({ signal }) => apiFetch<TenantProcessMatrixResponse>(`/v1/processes/matrice${tenantId ? `?tenantId=${tenantId}` : ""}`, { signal }),
    staleTime: 60_000,
  });
  const m = (k: string, o?: Record<string, unknown>) => t(`processiDelTenant.matrice.${k}`, o);
  if (q.isLoading) return <StatoCaricamento />;
  if (q.isError || !q.data) return <StatoErrore errore={q.error} titolo={m("errore")} onRiprova={() => void q.refetch()} />;
  const d = q.data;
  if (d.processes.length === 0 || d.units.length === 0) {
    return <p className="rounded-lg border border-dashed border-border bg-card p-3 text-sm text-foreground" data-testid="matrice-vuota">{m("vuota")}</p>;
  }
  const ruolo = new Map(d.cells.map((c) => [`${c.processId}|${c.unitId}`, c.role] as const));
  const conta = (pid: string, r: Ruolo) => d.units.filter((u) => ruolo.get(`${pid}|${u.unitId}`) === r).length;
  const fermo = "sticky left-0 z-[1] border-r border-border bg-card";
  const nomeRuolo = (r: Ruolo) => m(`ruolo.${r}`);

  return (
    <section data-testid="matrice-processi" className="space-y-2">
      <p className="text-xs text-muted-foreground">{m("spiega")}</p>
      <p className="text-xs text-muted-foreground">{m("numeri", { processi: fmt.numero(d.processes.length), unita: fmt.numero(d.units.length), celle: fmt.numero(d.cells.length) })}</p>
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-card">
        <table className="border-collapse text-[11px] text-foreground">
          <caption className="sr-only">{m("titolo")}</caption>
          <thead className="sticky top-0 z-[2] bg-card">
            <tr>
              <th className={`${fermo} px-2 py-1 text-left align-bottom font-medium`}>{m("processo")}</th>
              <th className="px-1 py-1 align-bottom text-[10px] font-medium" title={m("eCTitolo")}>E/C</th>
              {d.units.map((u) => (
                <th key={u.unitId} title={u.name} className="rotate-180 whitespace-nowrap px-0.5 py-1 align-bottom text-[10px] font-medium [writing-mode:vertical-rl]">
                  {u.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.processes.map((p) => (
              <tr key={p.processId} className="hover:bg-accent" data-testid="matrice-riga">
                <td className={`${fermo} min-w-[18rem] max-w-[26rem] px-2 py-0.5 ${p.level === 2 ? "pl-6" : ""}`}>
                  <Link href={`/tenant-processes/${p.processId}`} title={m("apri")} className="font-mono underline underline-offset-2" data-testid="matrice-processo">
                    {p.code}
                  </Link>{" "}
                  <span className={p.level === 2 ? "text-muted-foreground" : "font-medium"}>{p.name}</span>
                </td>
                <td className="px-1 text-center text-[10px] tabular-nums text-muted-foreground">
                  {fmt.numero(conta(p.processId, "CONTRIBUTOR"))}/{fmt.numero(conta(p.processId, "CONSULTED"))}
                </td>
                {d.units.map((u) => {
                  const r = ruolo.get(`${p.processId}|${u.unitId}`);
                  return (
                    <td key={u.unitId} title={r ? `${nomeRuolo(r)}: ${u.name}` : undefined} className={`h-5 w-[18px] min-w-[18px] border border-border/50 text-center text-[10px] ${r ? CELLA[r] : ""}`}>
                      {r ? SIGLA[r] : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className={`${fermo} px-2 py-0.5 text-[10px] text-muted-foreground`}>{m("piede")}</td>
              <td />
              {d.units.map((u) => (
                <td key={u.unitId} className="text-center text-[10px] tabular-nums text-muted-foreground">
                  {fmt.numero(d.processes.filter((p) => { const r = ruolo.get(`${p.processId}|${u.unitId}`); return r === "OWNER" || r === "CONTRIBUTOR"; }).length)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
