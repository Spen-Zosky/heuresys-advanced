/**
 * apps/web/src/lib/gdpr-mappa.ts
 *
 * Giro forense K34 (2026-11-23): la mappa dei dati personali di /admin/gdpr elencava i nomi fisici
 * delle tabelle (`sys.sys_user_bank_details`), uno per riga, senza dire che cosa contengono. Qui
 * la mappa si legge per classe di dato, con il titolo della tabella: quello dell'API (dal catalogo
 * del Faldone, nella lingua chiesta) o, per le tabelle fuori da quel catalogo, il dizionario della
 * pagina (`admin:gdpr.tabelle.<nome>`). Il nome fisico resta disponibile, ma non è la prima cosa.
 *
 * Funzioni pure, senza React: si provano in `gdpr-mappa.test.ts`.
 */
import { GdprDataClassEnum, type GdprDataClass, type GdprDataMapItem } from "@heuresys/shared";

type Traduci = (chiave: string, opzioni?: Record<string, unknown>) => string;
type Esiste = (chiave: string) => boolean;

/** Il titolo leggibile di una voce, mai il nome fisico. */
export function titoloVoce(m: Pick<GdprDataMapItem, "title" | "tableName">, t: Traduci, esiste: Esiste): string {
  if (m.title) return m.title;
  const chiave = `gdpr.tabelle.${m.tableName}`;
  return esiste(chiave) ? t(chiave) : t("gdpr.senzaTitolo");
}

export interface GruppoMappa {
  classe: GdprDataClass;
  voci: Array<GdprDataMapItem & { titolo: string; ripetuta: number }>;
}

/**
 * Le voci raggruppate per classe di dato (nell'ordine della tassonomia), e dentro ogni classe per
 * titolo. `ripetuta` dice quante volte la stessa tabella compare nella mappa: una per ogni colonna
 * che indica la persona (per esempio chi dà e chi riceve un feedback), ed è ciò che la pagina spiega.
 */
export function raggruppaMappa(items: GdprDataMapItem[], t: Traduci, esiste: Esiste, lingua: string): GruppoMappa[] {
  const conteggio = new Map<string, number>();
  for (const m of items) {
    const k = `${m.tableSchema}.${m.tableName}`;
    conteggio.set(k, (conteggio.get(k) ?? 0) + 1);
  }
  return GdprDataClassEnum.options
    .map((classe) => ({
      classe,
      voci: items
        .filter((m) => m.dataClass === classe)
        .map((m) => ({
          ...m,
          titolo: titoloVoce(m, t, esiste),
          ripetuta: conteggio.get(`${m.tableSchema}.${m.tableName}`) ?? 1,
        }))
        .sort((a, b) => a.titolo.localeCompare(b.titolo, lingua) || a.subjectFkColumn.localeCompare(b.subjectFkColumn)),
    }))
    .filter((g) => g.voci.length > 0);
}
