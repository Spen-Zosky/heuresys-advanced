/**
 * apps/api/src/modules/tenant-materialization/build-plan.ts
 * IL PIANO DI COSTRUZIONE (#198 T4, E21 — S1067).
 *
 * Che cos'è, in una frase: **l'elenco delle righe da creare, già deciso**, per tabella, con
 * accanto la ragione che le giustifica. Non è una copia dell'archetipo con un altro nome —
 * è il confine oltre il quale il motore non guarda.
 *
 * PERCHÉ ESISTE, ed è una decisione di modello, non un riordino di file (E21). Il motore
 * `materialize` leggeva `archetype.orgUnits`, `archetype.positions`, `archetype.skills`,
 * `archetype.kpis`, e chiamava `archetypeUsers()` / `synProficiency()` / `synKpiValue()`
 * per conto proprio. Finché fa così, **la sorgente è una sola per costruzione**: qualunque
 * altra — una ricerca (P2a), un'estrazione (P4), un fascicolo compilato a mano — dovrebbe
 * fingersi un archetipo TypeScript per essere costruita. La promessa di E21 («il motore
 * prima della sorgente») sarebbe falsa nel codice mentre è vera nei documenti.
 *
 * Qui il piano porta **anche le evidenze già calcolate**, non i loro ingredienti. Se
 * portasse gli indici (`ui`, `sj`) e lasciasse al motore il compito di chiamare
 * `synProficiency`, il motore continuerebbe a conoscere la regola di generazione di UNA
 * sorgente specifica — che è esattamente ciò che si sta togliendo.
 *
 * La `justification` non è ornamento: è ciò che P3 deve poter scrivere nel registro
 * dell'origine per ogni riga creata. Una riga generata senza la decisione che la giustifica
 * è indistinguibile da una riga arrivata per caso, ed è il difetto che P3 esiste per
 * chiudere.
 */
/**
 * I domini dei campi categorici vivono QUI e non in `blueprints.ts`, ed è una conseguenza
 * diretta di E21: se il piano importasse i tipi dall'archetipo, il confine sarebbe scritto
 * al contrario — il modulo neutro dipenderebbe da UNA sorgente specifica. Questi valori
 * non appartengono comunque all'archetipo: sono i domini `CHECK` delle colonne (RD-08).
 */
export type OrgUnitType = "HEADQUARTERS" | "DIVISION" | "DEPARTMENT" | "TEAM" | "BRANCH" | "OFFICE";
export type Criticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SkillKind = "SKILL" | "KNOWLEDGE" | "COMPETENCE" | "BEHAVIOR";
export type KpiPolarity = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "TARGET_RANGE";

/** Una riga pianificata porta sempre con sé la ragione per cui esiste. */
export interface Planned {
  /** La decisione del fascicolo (o della sorgente) che giustifica questa riga. */
  justification: string;
}

export interface PlannedOrgUnit extends Planned {
  code: string;
  name: string;
  type: OrgUnitType;
  parentCode: string | null;
}

export interface PlannedPosition extends Planned {
  code: string;
  title: string;
  orgUnitCode: string;
  criticality: Criticality;
  economicWeight: number;
}

export interface PlannedSkill extends Planned {
  code: string;
  name: string;
  kind: SkillKind;
  /**
   * La CATEGORIA, dichiarata dalla sorgente e non dedotta dal `kind`.
   *
   * Perche' e' obbligatoria (#198 T9a, S1069). Il motore creava competenze con
   * `skill_category_id` nullo, e la costruzione riusciva: il difetto si vedeva **al deploy
   * successivo**, dove la post-condizione della mig. `000196` — «ogni evidenza punta a una
   * competenza con categoria» — trovava 176 evidenze scoperte e fermava la catena. Un difetto
   * che non rompe cio' che lo produce ma cio' che viene dopo e' il piu' difficile da attribuire.
   *
   * Non si deriva dal `kind`: `COMPETENCE` non vuol dire «Leadership», e una regola del genere
   * sarebbe vera per l'archetipo di oggi e falsa per la prima sorgente che arriva. Il catalogo
   * `sys_skill_categories` e' GLOBALE (nessun tenant), quindi un'azienda appena creata lo ha
   * gia' a disposizione.
   */
  categoryCode: string;
}

export interface PlannedKpi extends Planned {
  code: string;
  name: string;
  polarity: KpiPolarity;
  unit: string;
}

/** Un'evidenza di competenza, col valore GIÀ deciso dalla sorgente. */
export interface PlannedSkillEvidence {
  skillCode: string;
  declaredProficiency: string;
}

/** Un'evidenza di indicatore, col valore e l'unità GIÀ decisi dalla sorgente. */
export interface PlannedKpiEvidence {
  kpiCode: string;
  measuredValue: number;
  unit: string;
}

export interface PlannedIncumbent extends Planned {
  externalCode: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  positionCode: string;
  skillEvidence: PlannedSkillEvidence[];
  kpiEvidence: PlannedKpiEvidence[];
}

export interface BuildPlan {
  /**
   * La chiave della sorgente. Finisce in `metadata.materialized_from` dove quel campo
   * esiste — e ⚠ quel campo **non è** il marchio di provenienza (`#197`): copre 3 tabelle
   * su 8, e la fonte vera è `sys.sys_generated_record_origins`.
   */
  sourceKey: string;
  /** Etichetta leggibile della sorgente, per i referti. */
  label: string;
  orgUnits: PlannedOrgUnit[];
  positions: PlannedPosition[];
  skills: PlannedSkill[];
  kpis: PlannedKpi[];
  incumbents: PlannedIncumbent[];
}

/** Un piano vuoto — utile ai test e come valore neutro; costruisce zero righe. */
export function emptyPlan(sourceKey: string, label = sourceKey): BuildPlan {
  return { sourceKey, label, orgUnits: [], positions: [], skills: [], kpis: [], incumbents: [] };
}
