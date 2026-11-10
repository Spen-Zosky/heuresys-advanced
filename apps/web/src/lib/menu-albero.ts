/**
 * apps/web/src/lib/menu-albero.ts — l'albero della barra laterale (classe C6 del piano
 * docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * I gruppi di primo livello vengono dal registro (`sys.sys_ui_interfaces`, migrazione 000484:
 * 13 gruppi per funzione, «Dashboard» primo). Enzo, 2026-11-11: «utilizzo di un solo padre-figlio
 * quando si potrebbero utilizzare ramificazioni più profonde». Qui si dichiara, per rotta, il
 * ramo sotto il gruppo: un elenco di chiavi, una per livello, con l'etichetta in
 * `shell:nav.rami.<chiave>`. Una voce senza ramo sta direttamente sotto il gruppo.
 *
 * I quattro gruppi personali (me, me_profile, me_growth, me_results) diventano un solo gruppo
 * «La mia area» con quattro rami: la persona trova le sue cose in un posto solo.
 *
 * Un ramo con una sola voce non si crea (la voce sale al livello sopra): un livello che non
 * raggruppa niente è un clic in più e basta.
 */

/** Gruppo di primo livello che sostituisce quello del registro (fusione dei gruppi personali). */
export const GRUPPO_FUSO: Record<string, { gruppo: string; ramo: string }> = {
  me: { gruppo: "me", ramo: "me_lavoro" },
  me_profile: { gruppo: "me", ramo: "me_profilo" },
  me_growth: { gruppo: "me", ramo: "me_crescita" },
  me_results: { gruppo: "me", ramo: "me_risultati" },
};

/** Rotta → ramo sotto il gruppo (dopo l'eventuale ramo della fusione). */
export const RAMO_DI: Record<string, string[]> = {
  /* Dashboard */
  "/dashboard/company": ["dash_aree"],
  "/dashboard/org": ["dash_aree"],
  "/dashboard/process": ["dash_aree"],
  "/dashboard/hr": ["dash_aree"],
  "/dashboard/branch": ["dash_aree"],
  "/process-owner": ["dash_ruoli"],
  "/org-director": ["dash_ruoli"],
  "/dashboard/tenant": ["dash_governo"],
  "/dashboard/platform": ["dash_governo"],
  /* Organizzazione */
  "/organization/org-chart": ["org_struttura"],
  "/positions": ["org_struttura"],
  "/job-catalog": ["org_struttura"],
  "/organization": ["org_diagnosi"],
  "/org-director/health": ["org_diagnosi"],
  "/org-director/vrio": ["org_diagnosi"],
  "/org-director/advisor": ["org_diagnosi"],
  /* Persone */
  "/users": ["persone_anagrafica"],
  "/recruiting": ["persone_anagrafica"],
  "/time-off": ["persone_tempo"],
  "/analytics/attendance": ["persone_tempo"],
  "/analytics/compensation": ["persone_retribuzioni"],
  /* Performance e talento */
  "/performance": ["talento_risultati"],
  "/goals": ["talento_risultati"],
  "/okrs": ["talento_risultati"],
  "/analytics/kpi": ["talento_risultati"],
  "/talent-review": ["talento_sviluppo"],
  "/career-succession": ["talento_sviluppo"],
  /* Competenze e formazione */
  "/skills": ["comp_mappa"],
  "/skill-taxonomy": ["comp_mappa"],
  "/analytics/skills": ["comp_mappa"],
  "/learning": ["comp_formazione"],
  "/learning/training-initiatives": ["comp_formazione"],
  /* Sicurezza e conformità */
  "/admin/roles": ["conf_accessi"],
  "/admin/mfa-policy": ["conf_accessi"],
  "/provenance": ["conf_registri"],
  "/generated-origins": ["conf_registri"],
  /* Configurazione */
  "/blueprints": ["cfg_modello"],
  "/tenant-blueprints": ["cfg_modello"],
  "/tenants": ["cfg_modello"],
  "/consolidation": ["cfg_dati"],
  "/seed-acquisition/runs": ["cfg_dati"],
  "/content": ["cfg_sito"],
  "/leads": ["cfg_sito"],
  /* La mia area, crescita: un livello in più */
  "/me/skills": ["comp"],
  "/me/skills/self-assessment": ["comp"],
  "/me/gaps": ["comp"],
  "/me/certifications": ["comp"],
  "/me/learning": ["formazione"],
  "/me/learning/catalogue": ["formazione"],
  "/me/career": ["carriera"],
  "/me/career/target": ["carriera"],
  "/me/matching": ["carriera"],
  "/me/positions": ["carriera"],
};

export interface VoceMenu {
  id: string;
  label: string;
  href: string;
  icona: string | null;
  ordine: number;
  testId?: string;
}

export interface Ramo {
  chiave: string;
  voci: VoceMenu[];
  rami: Ramo[];
  ordine: number;
}

/** Costruisce l'albero di un gruppo: le voci senza ramo in testa, poi i rami in ordine. */
export function alberoDelGruppo(voci: Array<VoceMenu & { ramo: string[] }>): Ramo {
  const radice: Ramo = { chiave: "", voci: [], rami: [], ordine: 0 };
  for (const v of voci) {
    let nodo = radice;
    for (const k of v.ramo) {
      let figlio = nodo.rami.find((r) => r.chiave === k);
      if (!figlio) {
        figlio = { chiave: k, voci: [], rami: [], ordine: v.ordine };
        nodo.rami.push(figlio);
      }
      figlio.ordine = Math.min(figlio.ordine, v.ordine);
      nodo = figlio;
    }
    nodo.voci.push(v);
  }
  const pota = (n: Ramo): Ramo => {
    n.rami = n.rami.map(pota);
    /* un ramo con una sola voce e nessun sotto-ramo non raggruppa niente: la voce sale */
    const tenuti: Ramo[] = [];
    for (const r of n.rami) {
      if (r.rami.length === 0 && r.voci.length === 1) n.voci.push(r.voci[0]!);
      else tenuti.push(r);
    }
    n.rami = tenuti.sort((a, b) => a.ordine - b.ordine);
    n.voci.sort((a, b) => a.ordine - b.ordine);
    return n;
  };
  return pota(radice);
}

/** Il ramo della rotta, con il ramo della fusione davanti se il gruppo è fuso. */
export function ramoDi(route: string, gruppoRegistro: string): { gruppo: string; ramo: string[] } {
  const fuso = GRUPPO_FUSO[gruppoRegistro];
  const proprio = RAMO_DI[route] ?? [];
  return fuso ? { gruppo: fuso.gruppo, ramo: [fuso.ramo, ...proprio] } : { gruppo: gruppoRegistro, ramo: proprio };
}
