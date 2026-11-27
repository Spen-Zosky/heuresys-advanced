/**
 * apps/api/src/lib/i18n/traduzione-della-riga.ts
 * Le modifiche fatte in inglese finiscono nella traduzione inglese (ADR-0062, punto 3b).
 *
 * Una modifica `PATCH`/`PUT` di una risorsa (`…/:id` in fondo al percorso) fatta in una
 * pagina inglese porta nel corpo i testi come la persona li vede, cioè in inglese. Per ogni
 * campo registrato in `sys.sys_translatable_field` della riga con quell'id:
 *   - testo uguale all'italiano della riga, o alla sua traduzione inglese: torna all'italiano
 *     (la persona non l'ha cambiato);
 *   - testo diverso: è una modifica in inglese. L'italiano della riga resta com'era e il testo
 *     nuovo va nella traduzione inglese (`sys_reference_translations`, fonte `MANUAL`, che le
 *     migrazioni non sovrascrivono), ma solo dopo che la scrittura è riuscita.
 * Una riga senza italiano (campo vuoto) non si tocca: il testo nuovo diventa il canonico.
 *
 * Il legame con la richiesta (difetto segnalato dal controllo di sicurezza, 27/11): si guarda
 * una sola tabella, quella della rotta (`/v1/<risorsa>/:id` → `sys.sys_<risorsa>`), solo i
 * campi che lo schema del corpo della rotta accetta, e solo una riga del tenant di chi scrive
 * (o una riga di catalogo senza tenant). Così un id di un'altra tabella o di un altro tenant
 * non porta niente nel corpo e non riceve nessuna traduzione.
 */

import type { Pool } from "pg";

const IDENT = /^[a-z_][a-z0-9_]*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CampoDellaRiga {
  entity_table: string;
  entity_pk_column: string;
  field: string;
  entity_field_column: string;
  /** La colonna del tenant della riga (`<chiave>_tenant_id`), se la tabella ne ha una. */
  tenant_column: string | null;
}

/** Chi scrive: il suo tenant, o nessuno per un mandato di piattaforma senza tenant. */
export interface Scrivente {
  tenantId: string | null;
}

export interface CampoTrovato {
  tabella: string;
  campo: string;
  it: string | null;
  en: string | null;
}

export interface ModificaInglese {
  tabella: string;
  id: string;
  campo: string;
  testo: string;
  it: string;
}

/** I campi registrati utilizzabili: tabelle che esistono, nomi sicuri, chiave uuid. */
export async function leggiRegistroRighe(db: Pick<Pool, "query">): Promise<CampoDellaRiga[]> {
  const reg = await db.query<CampoDellaRiga>(
    `SELECT f.entity_table, f.entity_pk_column, f.field, f.entity_field_column,
            t.column_name::text AS tenant_column
       FROM sys.sys_translatable_field f
       JOIN information_schema.columns c
         ON c.table_schema = 'sys' AND c.table_name = f.entity_table
        AND c.column_name = f.entity_pk_column AND c.data_type = 'uuid'
       JOIN information_schema.columns v
         ON v.table_schema = 'sys' AND v.table_name = f.entity_table
        AND v.column_name = f.entity_field_column
       LEFT JOIN information_schema.columns t
         ON t.table_schema = 'sys' AND t.table_name = f.entity_table
        AND t.column_name = regexp_replace(f.entity_pk_column, '_id$', '_tenant_id')
        AND t.data_type = 'uuid'
      WHERE f.canonical_locale = 'it'
      ORDER BY f.entity_table, f.field`,
  );
  return reg.rows.filter(
    (c) =>
      [c.entity_table, c.entity_pk_column, c.entity_field_column, c.field].every((x) => IDENT.test(x)) &&
      (c.tenant_column === null || IDENT.test(c.tenant_column)),
  );
}

/**
 * I campi registrati della riga con quell'id nella tabella della rotta, con l'italiano e
 * l'inglese di oggi. Solo i campi in `chiavi` (quelli del corpo che la rotta accetta) e solo
 * una riga del tenant di chi scrive o senza tenant; un mandato di piattaforma senza tenant
 * vede ogni riga, come nel suo handler.
 */
export async function campiDellaRiga(
  db: Pick<Pool, "query">,
  registro: readonly CampoDellaRiga[],
  tabella: string,
  id: string,
  chiavi: ReadonlySet<string>,
  scrivente: Scrivente,
): Promise<CampoTrovato[]> {
  if (!UUID.test(id) || !IDENT.test(tabella)) return [];
  const utili = registro.filter((c) => c.entity_table === tabella && chiavi.has(c.field));
  if (utili.length === 0) return [];
  if (scrivente.tenantId !== null && !UUID.test(scrivente.tenantId)) return [];
  const conTenant = scrivente.tenantId !== null && utili.some((c) => c.tenant_column !== null);
  const parametri: string[] = conTenant ? [id, scrivente.tenantId!] : [id];
  // I nomi vengono dal registro e sono già passati per IDENT: si possono scrivere nel testo.
  const parti = utili.map((c) => {
    const delTenant =
      conTenant && c.tenant_column !== null
        ? ` AND (e.${c.tenant_column} IS NULL OR e.${c.tenant_column} = $2::uuid)`
        : "";
    return `SELECT '${c.entity_table}'::text AS tabella, '${c.field}'::text AS campo,
              e.${c.entity_field_column}::text AS it, x.text AS en
         FROM sys.${c.entity_table} e
         LEFT JOIN sys.sys_reference_translations x
           ON x.entity_table = '${c.entity_table}' AND x.field = '${c.field}'
          AND x.locale = 'en' AND x.entity_id = e.${c.entity_pk_column}
        WHERE e.${c.entity_pk_column} = $1::uuid${delTenant}`;
  });
  const res = await db.query<CampoTrovato>(parti.join("\n UNION ALL \n"), parametri);
  return res.rows;
}

/** La tabella della rotta: `…/<risorsa>/:id` → `sys_<risorsa>` (trattini in sottolineature). */
export function tabellaDellaRotta(urlRotta: string | undefined): string | null {
  if (!urlRotta) return null;
  const m = /\/([a-z][a-z0-9-]*)\/:[A-Za-z_][A-Za-z0-9_]*$/.exec(urlRotta);
  if (!m) return null;
  const t = `sys_${m[1]!.replace(/-/g, "_")}`;
  return IDENT.test(t) ? t : null;
}

/**
 * I campi che lo schema del corpo della rotta accetta (le chiavi di un oggetto Zod). Uno schema
 * che non si lascia leggere (assente, una trasformazione) non ne accetta nessuno: niente 3b.
 */
export function campiAccettati(schemaCorpo: unknown): Set<string> {
  if (schemaCorpo === null || typeof schemaCorpo !== "object") return new Set();
  let forma: unknown;
  try {
    forma = (schemaCorpo as { shape?: unknown }).shape;
  } catch {
    return new Set();
  }
  if (forma === null || typeof forma !== "object") return new Set();
  return new Set(Object.keys(forma));
}

/**
 * Decide, campo per campo, che cosa resta nel corpo e che cosa va nella traduzione.
 * Restituisce il corpo nuovo (copia) e le modifiche inglesi da scrivere dopo la scrittura.
 * Se l'id appartiene a più tabelle registrate con lo stesso campo, non si decide niente.
 */
export function separaModifiche(
  corpo: Record<string, unknown>,
  id: string,
  trovati: readonly CampoTrovato[],
): { corpo: Record<string, unknown>; modifiche: ModificaInglese[]; campi: Set<string> } {
  const perCampo = new Map<string, CampoTrovato[]>();
  for (const t of trovati) perCampo.set(t.campo, [...(perCampo.get(t.campo) ?? []), t]);
  const voci: [string, unknown][] = [];
  const modifiche: ModificaInglese[] = [];
  const campi = new Set<string>();
  for (const [k, v] of Object.entries(corpo)) {
    const righe = perCampo.get(k);
    const t = righe?.length === 1 ? righe[0] : undefined;
    if (!t || typeof v !== "string" || t.it === null || t.it.trim() === "") {
      voci.push([k, v]);
      continue;
    }
    campi.add(k);
    voci.push([k, t.it]);
    if (v !== t.it && v !== t.en) modifiche.push({ tabella: t.tabella, id, campo: k, testo: v, it: t.it });
  }
  return { corpo: Object.fromEntries(voci), modifiche, campi };
}

/** Scrive le modifiche inglesi nella traduzione: fonte MANUAL, una riga per campo. */
export async function scriviTraduzioni(db: Pick<Pool, "query">, modifiche: readonly ModificaInglese[]): Promise<void> {
  for (const m of modifiche) {
    if (m.testo.trim() === "") continue;
    await db.query(
      `INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
       VALUES ($1, $2::uuid, $3, 'en', $4, 'MANUAL')
       ON CONFLICT (entity_table, entity_id, field, locale)
       DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now()`,
      [m.tabella, m.id, m.campo, m.testo],
    );
  }
}

/** L'id della risorsa modificata: il parametro dell'ultimo segmento del percorso (`…/:id`). */
export function idDellaRisorsa(urlRotta: string | undefined, params: unknown): string | null {
  if (!urlRotta || params === null || typeof params !== "object") return null;
  const ultimo = /\/:([A-Za-z_][A-Za-z0-9_]*)$/.exec(urlRotta);
  if (!ultimo) return null;
  const v = (params as Record<string, unknown>)[ultimo[1]!];
  return typeof v === "string" && UUID.test(v) ? v : null;
}
