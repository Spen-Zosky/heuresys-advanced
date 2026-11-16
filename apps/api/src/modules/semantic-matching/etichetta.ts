/**
 * apps/api/src/modules/semantic-matching/etichetta.ts
 * L'etichetta di una professione si sceglie per la lingua di chi guarda (giudizio qa-web 16/11, F4008).
 *
 * Prima preferiva SEMPRE la colonna italiana, qualunque fosse la lingua della richiesta.
 * Il testo del vettore (`label_text`) e' quello inglese dell'ESCO; l'etichetta italiana, quando il
 * catalogo la porta (esco_occupation_mapping_esco_label_it, caricata dal datastore), vale solo in italiano.
 */

export type LinguaMatching = "it" | "en";

/** Senza lingua si resta all'italiano, il comportamento di prima. */
export function linguaDellaRichiesta(lingua: LinguaMatching | undefined): LinguaMatching {
  return lingua === "en" ? "en" : "it";
}

/**
 * Il frammento SQL che da' l'etichetta della professione, per l'alias `v` che porta `esco_uri` e `label_text`.
 * Si legge per chiave JSON cosi' la query regge anche su uno schema dove la colonna non c'e' ancora.
 */
export function etichettaOccupazioneSql(lingua: LinguaMatching | undefined): string {
  if (linguaDellaRichiesta(lingua) === "en") return "v.label_text";
  return `coalesce((
         SELECT nullif(btrim(to_jsonb(m) ->> 'esco_occupation_mapping_esco_label_it'), '')
           FROM sys.sys_esco_occupation_mappings m
          WHERE m.esco_occupation_mapping_esco_uri = v.esco_uri
          ORDER BY 1 NULLS LAST LIMIT 1), v.label_text)`;
}
