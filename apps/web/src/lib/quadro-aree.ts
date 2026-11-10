/**
 * apps/web/src/lib/quadro-aree.ts — quali aree del quadro degli insight (C15) apre ogni pagina.
 * Il prefisso più lungo vince. Le dashboard aprono tutto; l'area personale apre le lenti di chi
 * guarda.
 */
import type { AreaQuadro } from "@heuresys/shared";

const TUTTE: AreaQuadro[] = ["organizzazione", "posizioni", "persone", "assenze", "obiettivi", "valutazioni", "formazione", "selezione", "approvazioni", "retribuzioni", "personale"];

export const AREE_PER_ROTTA: Array<[string, AreaQuadro[]]> = [
  ["/dashboard", TUTTE],
  ["/process-owner", TUTTE],
  ["/org-director", ["organizzazione", "posizioni", "persone"]],
  ["/organization", ["organizzazione", "posizioni"]],
  ["/positions", ["posizioni"]],
  ["/job-catalog", ["posizioni"]],
  ["/users", ["persone"]],
  ["/time-off", ["assenze"]],
  ["/analytics/attendance", ["assenze"]],
  ["/analytics/overtime", ["assenze"]],
  ["/analytics/compensation", ["retribuzioni"]],
  ["/compensation-intelligence", ["retribuzioni"]],
  ["/analytics/workforce", ["persone", "organizzazione"]],
  ["/analytics/kpi", ["obiettivi"]],
  ["/analytics/skills", ["formazione"]],
  ["/goals", ["obiettivi"]],
  ["/okrs", ["obiettivi"]],
  ["/kpis", ["obiettivi"]],
  ["/performance", ["valutazioni", "obiettivi"]],
  ["/talent-review", ["valutazioni"]],
  ["/career-succession", ["posizioni", "valutazioni"]],
  ["/insights", ["persone", "valutazioni"]],
  ["/skills", ["formazione"]],
  ["/gaps", ["formazione"]],
  ["/learning", ["formazione"]],
  ["/recruiting", ["selezione"]],
  ["/approvals", ["approvazioni"]],
  ["/engagement", ["persone"]],
  ["/me", ["personale"]],
];

export function areeDellaRotta(pathname: string | null): AreaQuadro[] {
  if (!pathname) return [];
  let migliore: [string, AreaQuadro[]] | undefined;
  for (const voce of AREE_PER_ROTTA) {
    if ((pathname === voce[0] || pathname.startsWith(`${voce[0]}/`)) && (!migliore || voce[0].length > migliore[0].length)) migliore = voce;
  }
  return migliore?.[1] ?? [];
}
