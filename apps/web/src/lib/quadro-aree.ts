/**
 * apps/web/src/lib/quadro-aree.ts — quali aree del quadro degli insight (C15) apre ogni pagina.
 * Il prefisso più lungo vince. Le dashboard aprono tutto; l'area personale apre le lenti di chi
 * guarda. Le assenze di chi guarda («mie-assenze») si aprono solo sul cruscotto personale e sulla
 * pagina delle assenze: in cima a Deleghe o al Manuale l'avviso delle ferie non c'entra (K09).
 */
import type { AreaQuadro } from "@heuresys/shared";

/* tutte le aree di governo e quella personale; le assenze di chi guarda restano al cruscotto personale */
const TUTTE: AreaQuadro[] = ["organizzazione", "posizioni", "persone", "assenze", "obiettivi", "valutazioni", "formazione", "selezione", "approvazioni", "retribuzioni", "personale", "accessi", "processi", "contenuti", "segnalazioni", "progetti", "contatti"];
/* le rotte che valgono solo alla lettera, non per le pagine sotto di loro */
const AREE_ESATTE: Array<[string, AreaQuadro[]]> = [["/me", ["personale", "mie-assenze"]]];
/* le pagine di governo del cliente e della piattaforma */
const GOVERNO: AreaQuadro[] = ["accessi", "processi", "contenuti", "segnalazioni", "progetti", "contatti"];

export const AREE_PER_ROTTA: Array<[string, AreaQuadro[]]> = [
  ["/dashboard", TUTTE],
  ["/process-owner", TUTTE],
  ["/org-director", ["organizzazione", "posizioni", "persone"]],
  ["/organization", ["organizzazione", "posizioni"]],
  ["/positions", ["posizioni"]],
  ["/job-catalog", ["posizioni"]],
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
  ["/admin/catalogo-kpi", ["obiettivi", "processi"]],
  ["/admin/tassonomie", ["posizioni"]],
  ["/admin/dati-di-riferimento", ["posizioni", "formazione"]],
  ["/performance", ["valutazioni", "obiettivi"]],
  ["/talent-review", ["valutazioni"]],
  ["/career-succession", ["posizioni", "valutazioni"]],
  ["/mentorship", ["valutazioni", "formazione"]],
  ["/assessments", ["valutazioni"]],
  ["/insights", ["persone", "valutazioni"]],
  ["/skills", ["formazione"]],
  ["/gaps", ["formazione"]],
  ["/learning", ["formazione"]],
  ["/recruiting", ["selezione"]],
  ["/approvals", ["approvazioni"]],
  ["/engagement", ["persone"]],
  ["/me", ["personale"]],
  ["/me/time-off", ["personale", "mie-assenze"]],
  ["/admin", ["accessi"]],
  ["/users", ["persone", "accessi"]],
  ["/tenants", GOVERNO],
  ["/system-health", GOVERNO],
  ["/dev", GOVERNO],
  ["/blueprints", ["processi", "organizzazione"]],
  ["/tenant-blueprints", ["processi", "organizzazione"]],
  ["/processes", ["processi"]],
  ["/tenant-processes", ["processi"]],
  ["/consolidation", ["processi", "organizzazione"]],
  ["/generated-origins", ["organizzazione", "persone"]],
  ["/provenance", ["organizzazione", "persone"]],
  ["/seed-acquisition", ["organizzazione", "persone"]],
  ["/skill-taxonomy", ["formazione"]],
  ["/visualizations", ["organizzazione", "posizioni"]],
  ["/content", ["contenuti"]],
  ["/whistleblowing-console", ["segnalazioni"]],
  ["/projects", ["progetti"]],
  ["/leads", ["contatti"]],
  ["/analytics", ["persone", "organizzazione"]],
];

export function areeDellaRotta(pathname: string | null): AreaQuadro[] {
  if (!pathname) return [];
  const esatta = AREE_ESATTE.find((v) => v[0] === pathname);
  if (esatta) return esatta[1];
  let migliore: [string, AreaQuadro[]] | undefined;
  for (const voce of AREE_PER_ROTTA) {
    if ((pathname === voce[0] || pathname.startsWith(`${voce[0]}/`)) && (!migliore || voce[0].length > migliore[0].length)) migliore = voce;
  }
  return migliore?.[1] ?? [];
}
