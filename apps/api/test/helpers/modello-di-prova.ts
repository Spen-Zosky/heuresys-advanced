/**
 * apps/api/test/helpers/modello-di-prova.ts
 * UN MODELLO SEMINATO DAL TEST, NON UN ARCHETIPO CON UN ALTRO NOME (#132 F3, E29).
 *
 * Il piano di `#132` è esplicito su questo punto: *«i test costruiscono da un modello
 * **seminato nel test**, non da uno globale: è la differenza fra una fixture e un archetipo
 * mascherato.»* Un modello unico condiviso da tutti i test tornerebbe a essere, nei fatti,
 * l'archetipo appena ritirato — solo scritto in SQL invece che in TypeScript, e con il
 * difetto in più di legare fra loro test che dovrebbero essere indipendenti.
 *
 * Perciò: **ogni chiamata crea un modello suo**, con un suffisso proprio, e chi la usa lo fa
 * dentro la transazione del proprio file, che a fine corsa torna indietro.
 *
 * ⚠ IL MODELLO DI PROVA NON È UNA BANCA, ed è la sostanza di E29 tradotta in una fixture.
 * È una piccola azienda manifatturiera — direzione, stabilimento, magazzino, una linea — coi
 * tipi `PLANT` e `WAREHOUSE` che l'archetipo bancario non sapeva nemmeno nominare. Se qualcuno
 * rimettesse un modello bancario come base dei test, la differenza si vedrebbe subito.
 */
import { BLUEPRINT_CONTENT_KEY } from "../../src/modules/tenant-materialization/blueprint-build-source.js";
import type { DbConnector } from "../../src/modules/tenant-materialization/build-source.js";

export interface ModelloDiProva {
  familyId: string;
  variantId: string;
  /** La versione di variante: è questa che si passa a chi costruisce. */
  variantVersionId: string;
  /** `famiglia/variante v1` — l'etichetta che il piano produrrà. */
  label: string;
  /** Quante righe il modello dichiara, per dominio: i test ci confrontano i conteggi. */
  attese: { orgUnits: number; positions: number; skills: number; kpis: number };
}

/**
 * Semina famiglia + variante + versione + contenuto, e restituisce gli identificativi.
 *
 * ⚠ La versione 1 **non** si inserisce: la crea il trigger `sys_blueprint_variant_ensure_version`
 * quando nasce la variante. Inserirla a mano viola la chiave `(variante, numero)` — è il primo
 * errore in cui si inciampa scrivendo un test su queste tabelle.
 */
export async function seminaModello(
  client: DbConnector,
  suffisso: string,
): Promise<ModelloDiProva> {
  const familyCode = `PROVA-${suffisso}`;
  const variantCode = `VAR-${suffisso}`;

  const f = await client.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_families (blueprint_family_code, blueprint_family_name)
     VALUES ($1, $2) RETURNING blueprint_family_id AS id`,
    [familyCode, `Modello di prova ${suffisso}`],
  );
  const familyId = f.rows[0]!.id;

  const v = await client.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_variants
       (blueprint_variant_family_id, blueprint_variant_code, blueprint_variant_name)
     VALUES ($1, $2, $3) RETURNING blueprint_variant_id AS id`,
    [familyId, variantCode, `Variante di prova ${suffisso}`],
  );
  const variantId = v.rows[0]!.id;

  const vv = await client.query<{ id: string }>(
    `UPDATE sys.sys_blueprint_variant_versions
        SET blueprint_variant_version_build_source_key = $2
      WHERE blueprint_variant_version_variant_id = $1
        AND blueprint_variant_version_number = 1
      RETURNING blueprint_variant_version_id AS id`,
    [variantId, BLUEPRINT_CONTENT_KEY],
  );
  if (!vv.rows[0]) throw new Error("il trigger non ha creato la versione 1 della variante");
  const variantVersionId = vv.rows[0].id;

  // Le unità: i codici portano il suffisso, così due modelli seminati nello stesso file non
  // si contendono la chiave naturale dell'azienda su cui verranno costruiti.
  await client.query(
    `INSERT INTO sys.sys_blueprint_content_units
       (blueprint_content_unit_version_id, blueprint_content_unit_code, blueprint_content_unit_name,
        blueprint_content_unit_type, blueprint_content_unit_parent_code, blueprint_content_unit_level)
     VALUES ($1, $2, 'Direzione generale',      'GENERAL_MANAGEMENT', NULL, 0),
            ($1, $3, 'Stabilimento',            'PLANT',              $2,   1),
            ($1, $4, 'Magazzino centrale',      'WAREHOUSE',          $3,   2),
            ($1, $5, 'Linea di produzione 1',   'TEAM',               $3,   2)`,
    [variantVersionId, `DG-${suffisso}`, `STAB-${suffisso}`, `MAG-${suffisso}`, `LIN-${suffisso}`],
  );

  await client.query(
    `INSERT INTO sys.sys_blueprint_content_positions
       (blueprint_content_position_version_id, blueprint_content_position_code,
        blueprint_content_position_title, blueprint_content_position_unit_code,
        blueprint_content_position_criticality, blueprint_content_position_economic_weight)
     VALUES ($1, $2, 'Direttore generale',  $4, 'CRITICAL', 0.900),
            ($1, $3, 'Capo stabilimento',   $5, 'HIGH',     0.600)`,
    [
      variantVersionId,
      `POS-DG-${suffisso}`,
      `POS-CAPO-${suffisso}`,
      `DG-${suffisso}`,
      `STAB-${suffisso}`,
    ],
  );

  // La categoria è obbligatoria per il piano: una competenza senza categoria costruisce e
  // rompe il deploy successivo (il difetto T9a di `#198`, già pagato una volta).
  //
  // ⚠ LE CATEGORIE SI LEGGONO DAL CATALOGO, non si scrivono qui. Scriverle a mano sarebbe
  //   duplicare una SoT dentro una fixture: `TECHNICAL` e `SOFT` sembravano ovvie e **non
  //   esistono** — il catalogo dice `Technical`, `Personal`, `Leadership`… Il motore le ha
  //   respinte con `SKILL_CATEGORY_UNKNOWN`, che è il comportamento giusto; il difetto era
  //   nella fixture. Derivandole, il giorno in cui il catalogo cambia questa resta valida.
  const cat = await client.query<{ code: string }>(
    `SELECT skill_category_code AS code FROM sys.sys_skill_categories ORDER BY 1 LIMIT 2`,
  );
  if (cat.rows.length < 2) {
    throw new Error(
      `il catalogo delle categorie di competenza ne ha ${cat.rows.length}: la fixture ne pretende 2`,
    );
  }
  await client.query(
    `INSERT INTO sys.sys_blueprint_content_skills
       (blueprint_content_skill_version_id, blueprint_content_skill_code,
        blueprint_content_skill_name, blueprint_content_skill_kind, blueprint_content_skill_category)
     VALUES ($1, $2, 'Lean manufacturing',    'KNOWLEDGE', $4),
            ($1, $3, 'Sicurezza sul lavoro',  'BEHAVIOR',  $5)`,
    [
      variantVersionId,
      `SK-LEAN-${suffisso}`,
      `SK-SICU-${suffisso}`,
      cat.rows[0]!.code,
      cat.rows[1]!.code,
    ],
  );

  await client.query(
    `INSERT INTO sys.sys_blueprint_content_kpis
       (blueprint_content_kpi_version_id, blueprint_content_kpi_code, blueprint_content_kpi_name,
        blueprint_content_kpi_unit, blueprint_content_kpi_direction)
     VALUES ($1, $2, 'Efficienza degli impianti', '%', 'HIGHER_IS_BETTER'),
            ($1, $3, 'Scarti di produzione',      '%', 'LOWER_IS_BETTER')`,
    [variantVersionId, `KPI-OEE-${suffisso}`, `KPI-SCAR-${suffisso}`],
  );

  return {
    familyId,
    variantId,
    variantVersionId,
    label: `${familyCode}/${variantCode} v1`,
    attese: { orgUnits: 4, positions: 2, skills: 2, kpis: 2 },
  };
}
