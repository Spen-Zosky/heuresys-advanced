/**
 * apps/api/src/modules/tenant-materialization/blueprint-build-source.ts
 * LA SORGENTE CHE LEGGE IL MODELLO DAL DATABASE (#132 F2, E29 — S1072).
 *
 * La seconda implementazione di `BuildSource`, e la ragione per cui l'interfaccia esiste.
 * La sorgente che l'ha preceduta leggeva 296 righe di TypeScript scritte a mano; questa legge le
 * cinque tabelle `sys.sys_blueprint_content_*` che la `000327` ha creato, agganciate alla
 * **versione di variante**. È il presupposto perché `F3` possa ritirare l'archetipo:
 * finché il contenuto vive solo in un file, ogni azienda costruita è quella banca —
 * misurato il 2026-08-19 costruendo (e poi disfacendo) un'azienda che è nata banca senza
 * che nessuno lo chiedesse.
 *
 * ⚠ QUESTO FILE È IL PRIMO CHE PROVA DAVVERO A COSTRUIRE DA QUELLE TABELLE, e scrivendolo
 * sono emersi quattro difetti che il piano non prevedeva. Nessuno era visibile finché il
 * contenuto lo scriveva a mano un archetipo corretto per costruzione:
 *
 *   ① **L'ORDINE DELLE UNITÀ NON È UN DETTAGLIO.** `materialize` risolve il padre da una
 *      mappa `codice → id` che riempie **man mano**: se un figlio arriva prima del padre,
 *      `codeToId.get(parentCode)` torna `undefined`, il codice lo trasforma in `null`, e
 *      l'unità **nasce in cima all'albero senza che nessuno protesti**. Un `SELECT` da una
 *      tabella non ha un ordine buono per costruire un albero. Qui le unità si ordinano
 *      **topologicamente** (§ `ordinaPerAlbero`), e un ciclo diventa un errore invece di
 *      una struttura mutilata.
 *   ② **UN TIPO IGNOTO ERA SILENZIOSO.** `orgUnitTypeId` tornava `null` per un codice che
 *      il catalogo non conosce, e `organization_unit_type_id` è nullable: l'unità nasceva
 *      senza tipo. Qui i tipi si verificano contro `sys_organization_unit_types` **prima**
 *      di produrre il piano.
 *   ③ **IL VOCABOLARIO DELLA `000327` NON ERA QUELLO DEL PRODOTTO** — corretto dalla
 *      `000328`: la specie di una competenza ammetteva `LANGUAGE`/`CERTIFICATION`, che
 *      `sys_skills` non conosce, e il verso di un indicatore ammetteva `TARGET_IS_BEST`,
 *      che non esiste da nessuna parte.
 *   ④ **`OrgUnitType` ENUMERAVA I SEI TIPI DELLA BANCA** su un catalogo che ne ha dieci:
 *      `PLANT` e `WAREHOUSE` — cioè uno stabilimento e un magazzino — non erano esprimibili
 *      (→ commento in `build-plan.ts`).
 *
 * LO ZERO SILENZIOSO È IL DIFETTO PEGGIORE, e il piano di `#132` lo dice per esteso: un
 * fascicolo **senza** modello non deve costruire «zero righe con successo», deve
 * **rifiutarsi**. Uno zero che somiglia a un successo è la cosa più difficile da attribuire
 * — chi guarda vede un'azienda vuota e un atto riuscito, e non ha modo di sapere quale dei
 * due ha mentito. Qui ogni ragione di zero ha un errore col suo nome.
 *
 * PERCHÉ NON CI SONO PERSONE NEL PIANO (`incumbents: []`), ed è una decisione, non un buco.
 * Un modello descrive la **forma** di un'azienda — unità, posizioni, competenze, indicatori
 * — non chi ci lavora. La `000327` non ha creato alcuna tabella di persone, e quella era già
 * la decisione presa: le persone di un cliente sono dati del cliente. L'archetipo generava
 * titolari segnaposto `SYN_*` con evidenze sintetiche perché doveva mostrare un'azienda
 * "piena" a chi guardava una demo; un modello che nasce dalla ricerca non ha nessun motivo
 * di inventare persone, e inventarle significherebbe far nascere ogni azienda con lo stesso
 * organico fittizio — la stessa forma di difetto che E29 chiede di togliere.
 */
import type { BuildSourceSummary } from "@heuresys/shared";

import { ConflictError } from "../../errors/index.js";
import type {
  BuildPlan,
  Criticality,
  KpiPolarity,
  PlannedKpi,
  PlannedOrgUnit,
  PlannedPosition,
  PlannedSkill,
  SkillKind,
} from "./build-plan.js";
import type { BuildSource, DbConnector } from "./build-source.js";

/**
 * La chiave che una versione di variante dichiara in `blueprint_variant_version_build_source_key`
 * per dire «il mio contenuto sta nel database, non in un file».
 *
 * Non è una fra tante: quando `F3` avrà ritirato l'archetipo, sarà **l'unica** — e questo
 * file resterà l'unico posto in cui è scritta.
 */
export const BLUEPRINT_CONTENT_KEY = "BLUEPRINT_CONTENT";

interface RigaUnita {
  code: string;
  name: string;
  parent_code: string | null;
  type: string;
}
interface RigaPosizione {
  code: string;
  title: string;
  unit_code: string;
  criticality: string;
  economic_weight: string | null;
  metadata: Record<string, unknown>;
}
interface RigaCompetenza {
  code: string;
  name: string;
  kind: string;
  category: string | null;
  metadata: Record<string, unknown>;
}
interface RigaIndicatore {
  code: string;
  name: string;
  unit: string | null;
  direction: string;
  metadata: Record<string, unknown>;
}

/**
 * La ragione che giustifica una riga, letta dal modello.
 *
 * `F4` (il motore di ricerca) e `F6` (il ponte) scriveranno nel `metadata` di ogni voce di
 * contenuto il riferimento alla **proposta approvata** che l'ha generata; da quel momento la
 * `justification` che finisce nel registro dell'origine è una catena completa fino alla fonte
 * web. Finché quel campo non c'è, si scrive **da dove viene la riga** — il modello, per nome
 * e versione — che è comunque più di quanto dicesse l'archetipo («archetipo X»).
 *
 * ⚠ Non si inventa un riferimento che nessuno ha ancora scritto: se il `metadata` non porta
 * una `justification`, non se ne finge una.
 */
function ragione(metadata: Record<string, unknown> | null, modello: string, difetto: string): string {
  const dichiarata = metadata?.["justification"];
  if (typeof dichiarata === "string" && dichiarata.trim().length > 0) return dichiarata.trim();
  return `${modello}: ${difetto}`;
}

/**
 * Le unità ordinate padri-prima-dei-figli, oppure un errore che dice quali restano fuori.
 *
 * Perché non basta un `ORDER BY`: la gerarchia è un albero espresso per **codice**, e nessuna
 * colonna della tabella porta la profondità. Un ordinamento per codice o per data di
 * creazione è corretto per caso, e il caso qui costa un albero mutilato in silenzio (① sopra).
 *
 * L'algoritmo è una visita a onde: prima le radici (nessun padre), poi tutte le unità il cui
 * padre è già uscito, e così via. Ciò che non esce mai è **irraggiungibile** — o perché il
 * padre non esiste, o perché fa parte di un ciclo — e sono esattamente i due casi che il
 * `CHECK` della `000327` non può intercettare (impedisce solo che un'unità sia padre di sé
 * stessa; un ciclo `A → B → A` lo attraversa indisturbato).
 */
function ordinaPerAlbero(unita: RigaUnita[], modello: string): RigaUnita[] {
  const codici = new Set(unita.map((u) => u.code));
  const uscite = new Set<string>();
  const ordinate: RigaUnita[] = [];
  let restanti = unita.slice();

  while (restanti.length > 0) {
    const pronte = restanti.filter((u) => u.parent_code === null || uscite.has(u.parent_code));
    if (pronte.length === 0) break; // nessun progresso: il resto è irraggiungibile
    for (const u of pronte) {
      ordinate.push(u);
      uscite.add(u.code);
    }
    restanti = restanti.filter((u) => !uscite.has(u.code));
  }

  if (restanti.length > 0) {
    const orfane = restanti.filter((u) => u.parent_code !== null && !codici.has(u.parent_code));
    const inCiclo = restanti.filter((u) => u.parent_code !== null && codici.has(u.parent_code));
    const dettagli: string[] = [];
    if (orfane.length > 0) {
      dettagli.push(
        `padre inesistente: ${orfane.map((u) => `${u.code}→${u.parent_code}`).join(", ")}`,
      );
    }
    if (inCiclo.length > 0) {
      dettagli.push(`ciclo fra: ${inCiclo.map((u) => u.code).sort().join(", ")}`);
    }
    throw new ConflictError(
      `Il modello ${modello} ha una struttura che non forma un albero — ${dettagli.join(" · ")}`,
      "BLUEPRINT_CONTENT_INCOHERENT",
    );
  }
  return ordinate;
}

/**
 * La sorgente che legge il contenuto di una **versione di variante**.
 *
 * Riceve un connettore perché una sorgente vera legge: era già previsto dalla firma di
 * `BuildSource.plan()`, dichiarata asincrona proprio per questo (E21).
 */
export class BlueprintBuildSource implements BuildSource {
  readonly key = BLUEPRINT_CONTENT_KEY;
  private readonly db: DbConnector;
  private readonly variantVersionId: string;

  constructor(db: DbConnector, variantVersionId: string) {
    this.db = db;
    this.variantVersionId = variantVersionId;
  }

  async plan(): Promise<BuildPlan> {
    const modello = await this.etichetta();

    const [unita, posizioni, competenze, indicatori] = await Promise.all([
      this.leggiUnita(),
      this.leggiPosizioni(),
      this.leggiCompetenze(),
      this.leggiIndicatori(),
    ]);

    // ── LA PROVA CHE DEVE POTER FALLIRE (piano #132, F2) ─────────────────────────
    // Un modello senza struttura non costruisce «zero righe con successo». Il confine è
    // sulle UNITÀ e non sul totale, e la ragione è strutturale: ogni posizione dichiara
    // `unit_code NOT NULL`, quindi senza unità nessuna posizione è collocabile e ciò che
    // resterebbe non è un'azienda piccola — è un elenco di nomi.
    if (unita.length === 0) {
      throw new ConflictError(
        `Il modello ${modello} non ha contenuto: nessuna unità organizzativa. ` +
          `Un fascicolo ancorato a un modello vuoto non è costruibile — va prima riempito ` +
          `(ricerca, o ponte dalle proposte approvate).`,
        "BLUEPRINT_CONTENT_EMPTY",
      );
    }

    const ordinate = ordinaPerAlbero(unita, modello);
    await this.verificaTipiDiUnita(ordinate, modello);

    // Ogni posizione deve stare in un'unità che esiste in QUESTA versione. Il legame è per
    // codice e non c'è FK che lo protegga — è voluto (una proposta di ricerca nomina «la
    // direzione commerciale», non un uuid), e il prezzo è che qualcuno lo verifichi.
    const codiciUnita = new Set(ordinate.map((u) => u.code));
    const collocateMale = posizioni.filter((p) => !codiciUnita.has(p.unit_code));
    if (collocateMale.length > 0) {
      throw new ConflictError(
        `Il modello ${modello} colloca ${collocateMale.length} posizioni in unità che non esistono: ` +
          collocateMale.map((p) => `${p.code}→${p.unit_code}`).join(", "),
        "BLUEPRINT_CONTENT_INCOHERENT",
      );
    }

    // La categoria di una competenza è obbligatoria nel piano, e non per pignoleria: il
    // motore creerebbe competenze con `skill_category_id` nullo, la costruzione riuscirebbe,
    // e a rompersi sarebbe il **deploy successivo** — la post-condizione della `000196`
    // trova le evidenze scoperte e ferma la catena (è il difetto T9a di `#198`, già pagato
    // una volta). La colonna del contenuto ammette il nullo perché descrive cosa il database
    // accetta; qui si dichiara cosa una costruzione pretende.
    const senzaCategoria = competenze.filter((s) => !s.category || s.category.trim() === "");
    if (senzaCategoria.length > 0) {
      throw new ConflictError(
        `Il modello ${modello} dichiara ${senzaCategoria.length} competenze senza categoria: ` +
          senzaCategoria.map((s) => s.code).join(", ") +
          ". Una competenza senza categoria costruisce, e rompe il deploy successivo.",
        "BLUEPRINT_CONTENT_INCOHERENT",
      );
    }

    const orgUnits: PlannedOrgUnit[] = ordinate.map((u) => ({
      code: u.code,
      name: u.name,
      type: u.type,
      parentCode: u.parent_code,
      justification: `${modello}: unità organizzativa del modello`,
    }));

    const positions: PlannedPosition[] = posizioni.map((p) => ({
      code: p.code,
      title: p.title,
      orgUnitCode: p.unit_code,
      criticality: p.criticality as Criticality,
      // `numeric` arriva come stringa dal driver: la conversione è esplicita, e un peso
      // assente resta assente invece di diventare 0 — che vorrebbe dire «pesa niente».
      economicWeight: p.economic_weight === null ? 0 : Number(p.economic_weight),
      justification: ragione(p.metadata, modello, `posizione del modello, in ${p.unit_code}`),
    }));

    const skills: PlannedSkill[] = competenze.map((s) => ({
      code: s.code,
      name: s.name,
      kind: s.kind as SkillKind,
      categoryCode: s.category!,
      justification: ragione(s.metadata, modello, "competenza del catalogo di modello"),
    }));

    const kpis: PlannedKpi[] = indicatori.map((k) => ({
      code: k.code,
      name: k.name,
      polarity: k.direction as KpiPolarity,
      unit: k.unit ?? "",
      justification: ragione(k.metadata, modello, "indicatore del catalogo di modello"),
    }));

    return {
      sourceKey: this.key,
      label: modello,
      orgUnits,
      positions,
      skills,
      kpis,
      incumbents: [],
    };
  }

  /** `famiglia/variante v<n>` — ciò che chi legge il registro dell'origine vedrà scritto. */
  private async etichetta(): Promise<string> {
    const r = await this.db.query<{ etichetta: string }>(
      `SELECT f.blueprint_family_code || '/' || v.blueprint_variant_code
              || ' v' || vv.blueprint_variant_version_number AS etichetta
         FROM sys.sys_blueprint_variant_versions vv
         JOIN sys.sys_blueprint_variants v
           ON v.blueprint_variant_id = vv.blueprint_variant_version_variant_id
         JOIN sys.sys_blueprint_families f
           ON f.blueprint_family_id = v.blueprint_variant_family_id
        WHERE vv.blueprint_variant_version_id = $1`,
      [this.variantVersionId],
    );
    const e = r.rows[0]?.etichetta;
    if (!e) {
      throw new ConflictError(
        `La versione di modello ${this.variantVersionId} non esiste`,
        "BLUEPRINT_CONTENT_MISSING",
      );
    }
    return e;
  }

  /**
   * I tipi dichiarati devono esistere nel catalogo `sys_organization_unit_types`.
   *
   * Si verifica **prima** di costruire e non durante, perché durante è troppo tardi: il
   * motore ha già scritto le unità che precedono quella difettosa, e in modalità `plan`
   * (l'anteprima, che non scrive) il tipo non viene nemmeno risolto — l'anteprima direbbe
   * «tutto bene» e la costruzione fallirebbe dopo la firma.
   */
  private async verificaTipiDiUnita(unita: RigaUnita[], modello: string): Promise<void> {
    const dichiarati = [...new Set(unita.map((u) => u.type))];
    const r = await this.db.query<{ code: string }>(
      `SELECT organization_unit_type_code AS code
         FROM sys.sys_organization_unit_types
        WHERE organization_unit_type_code = ANY($1::text[])`,
      [dichiarati],
    );
    const noti = new Set(r.rows.map((x) => x.code));
    const ignoti = dichiarati.filter((t) => !noti.has(t));
    if (ignoti.length > 0) {
      throw new ConflictError(
        `Il modello ${modello} dichiara tipi di unità che il catalogo non conosce: ${ignoti.join(", ")}`,
        "BLUEPRINT_CONTENT_INCOHERENT",
      );
    }
  }

  private async leggiUnita(): Promise<RigaUnita[]> {
    const r = await this.db.query<RigaUnita>(
      `SELECT blueprint_content_unit_code        AS code,
              blueprint_content_unit_name        AS name,
              blueprint_content_unit_parent_code AS parent_code,
              blueprint_content_unit_type        AS type
         FROM sys.sys_blueprint_content_units
        WHERE blueprint_content_unit_version_id = $1
        ORDER BY blueprint_content_unit_level, blueprint_content_unit_code`,
      [this.variantVersionId],
    );
    return r.rows;
  }

  private async leggiPosizioni(): Promise<RigaPosizione[]> {
    const r = await this.db.query<RigaPosizione>(
      `SELECT blueprint_content_position_code            AS code,
              blueprint_content_position_title           AS title,
              blueprint_content_position_unit_code       AS unit_code,
              blueprint_content_position_criticality     AS criticality,
              blueprint_content_position_economic_weight AS economic_weight,
              blueprint_content_position_metadata        AS metadata
         FROM sys.sys_blueprint_content_positions
        WHERE blueprint_content_position_version_id = $1
        ORDER BY blueprint_content_position_code`,
      [this.variantVersionId],
    );
    return r.rows;
  }

  private async leggiCompetenze(): Promise<RigaCompetenza[]> {
    const r = await this.db.query<RigaCompetenza>(
      `SELECT blueprint_content_skill_code     AS code,
              blueprint_content_skill_name     AS name,
              blueprint_content_skill_kind     AS kind,
              blueprint_content_skill_category AS category,
              blueprint_content_skill_metadata AS metadata
         FROM sys.sys_blueprint_content_skills
        WHERE blueprint_content_skill_version_id = $1
        ORDER BY blueprint_content_skill_code`,
      [this.variantVersionId],
    );
    return r.rows;
  }

  private async leggiIndicatori(): Promise<RigaIndicatore[]> {
    const r = await this.db.query<RigaIndicatore>(
      `SELECT blueprint_content_kpi_code      AS code,
              blueprint_content_kpi_name      AS name,
              blueprint_content_kpi_unit      AS unit,
              blueprint_content_kpi_direction AS direction,
              blueprint_content_kpi_metadata  AS metadata
         FROM sys.sys_blueprint_content_kpis
        WHERE blueprint_content_kpi_version_id = $1
        ORDER BY blueprint_content_kpi_code`,
      [this.variantVersionId],
    );
    return r.rows;
  }
}

/**
 * Chi costruisce, data la chiave che il modello dichiara.
 *
 * Un solo posto in cui la scelta si fa, ed è ciò che rende `F3` un'operazione di
 * **rimozione** e non di riscrittura: quando l'archetipo sparirà, sparirà il secondo ramo
 * di questa funzione e nient'altro. I chiamanti — l'atto di applicazione (`#198` T5) e
 * l'anteprima del piano (T6) — non cambiano.
 *
 * ⚠ Una chiave ignota torna `undefined`, **mai un ripiego**. È la regola di E21 e ha già un
 * motivo pratico: ripiegare su un archetipo qualsiasi significherebbe costruire un'azienda
 * diversa da quella firmata, e l'atto risulterebbe riuscito.
 */
export function resolveBuildSource(
  db: DbConnector,
  key: string,
  variantVersionId: string | null,
): BuildSource | undefined {
  if (key === BLUEPRINT_CONTENT_KEY) {
    // Senza versione non c'è contenuto da leggere: `undefined` fa dire al chiamante
    // «sorgente sconosciuta», che è vero — questa sorgente non è istanziabile qui.
    return variantVersionId ? new BlueprintBuildSource(db, variantVersionId) : undefined;
  }
  // ⚠ QUI C'ERA IL SECONDO RAMO, quello che risolveva un archetipo, ed è sparito con `F3`.
  //   Era la promessa scritta in `F2`: «quando l'archetipo sparirà, sparirà il secondo ramo di
  //   questa funzione e nient'altro». È andata esattamente così — i chiamanti non sono
  //   cambiati. Una chiave che non sia quella del contenuto non risolve più niente, e non
  //   ripiega: costruire un'azienda diversa da quella firmata, con l'atto che risulta
  //   riuscito, resta il difetto peggiore possibile qui.
  return undefined;
}

/**
 * I modelli da cui si PUÒ costruire — cioè quelli che hanno davvero del contenuto.
 *
 * ⚠ Il filtro non è cosmetico. Un elenco che mostrasse anche le versioni vuote inviterebbe a
 * sceglierne una, e la costruzione che ne segue è il difetto che `F2` esiste per chiudere:
 * zero righe create con successo, indistinguibile da un successo vero. Qui il criterio è lo
 * stesso della sorgente — **almeno un'unità organizzativa** — così che ciò che l'elenco offre
 * e ciò che la costruzione accetta siano la stessa cosa. Se divergessero, l'elenco sarebbe
 * una promessa che la costruzione non mantiene.
 */
export async function listBuildSources(db: DbConnector): Promise<BuildSourceSummary[]> {
  const r = await db.query<{
    variant_version_id: string;
    family_code: string;
    variant_code: string;
    version_number: number;
    status: string;
    org_unit_count: string;
    position_count: string;
    skill_count: string;
    kpi_count: string;
  }>(
    `SELECT vv.blueprint_variant_version_id     AS variant_version_id,
            f.blueprint_family_code             AS family_code,
            v.blueprint_variant_code            AS variant_code,
            vv.blueprint_variant_version_number AS version_number,
            vv.blueprint_variant_version_status AS status,
            (SELECT count(*) FROM sys.sys_blueprint_content_units u
              WHERE u.blueprint_content_unit_version_id = vv.blueprint_variant_version_id) AS org_unit_count,
            (SELECT count(*) FROM sys.sys_blueprint_content_positions p
              WHERE p.blueprint_content_position_version_id = vv.blueprint_variant_version_id) AS position_count,
            (SELECT count(*) FROM sys.sys_blueprint_content_skills s
              WHERE s.blueprint_content_skill_version_id = vv.blueprint_variant_version_id) AS skill_count,
            (SELECT count(*) FROM sys.sys_blueprint_content_kpis k
              WHERE k.blueprint_content_kpi_version_id = vv.blueprint_variant_version_id) AS kpi_count
       FROM sys.sys_blueprint_variant_versions vv
       JOIN sys.sys_blueprint_variants v
         ON v.blueprint_variant_id = vv.blueprint_variant_version_variant_id
       JOIN sys.sys_blueprint_families f
         ON f.blueprint_family_id = v.blueprint_variant_family_id
      WHERE EXISTS (SELECT 1 FROM sys.sys_blueprint_content_units u
                     WHERE u.blueprint_content_unit_version_id = vv.blueprint_variant_version_id)
      ORDER BY f.blueprint_family_code, v.blueprint_variant_code, vv.blueprint_variant_version_number`,
  );
  return r.rows.map((x) => ({
    variantVersionId: x.variant_version_id,
    label: `${x.family_code}/${x.variant_code} v${x.version_number}`,
    familyCode: x.family_code,
    variantCode: x.variant_code,
    versionNumber: x.version_number,
    status: x.status,
    orgUnitCount: Number(x.org_unit_count),
    positionCount: Number(x.position_count),
    skillCount: Number(x.skill_count),
    kpiCount: Number(x.kpi_count),
  }));
}
