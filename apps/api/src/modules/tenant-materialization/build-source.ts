/**
 * apps/api/src/modules/tenant-materialization/build-source.ts
 * LA SORGENTE PARAMETRICA (#198 T4, E21 — S1067).
 *
 * E21, la decisione di Enzo: **il motore viene prima della sorgente**. Una `BuildSource`
 * risponde a una sola domanda — *quali righe vanno create, e perché* — e la risposta è un
 * `BuildPlan`. Il motore non sa da dove viene: un archetipo TypeScript oggi, domani una
 * ricerca (P2a, `#132`), un'estrazione (P4, `#206`), o un fascicolo compilato a mano.
 *
 * Oggi l'implementazione è UNA SOLA, ed è voluto. Un'interfaccia con un solo esemplare non
 * è astrazione prematura quando il secondo esemplare è già progettato e datato: qui serve a
 * rendere **meccanicamente verificabile** che il motore non guardi dentro l'archetipo —
 * `grep "blueprints.js" repository.ts` deve non trovare niente. Senza questo confine la
 * promessa di E21 resterebbe vera nei documenti e falsa nel codice.
 *
 * ⚠ Le evidenze si calcolano QUI, non nel motore. `synProficiency` e `synKpiValue` sono la
 * regola di generazione di *questa* sorgente: lasciarle al motore significherebbe che il
 * motore conosce ancora come una sorgente specifica inventa i suoi numeri.
 */
import { archetypeUsers, getArchetype, synKpiValue, synProficiency, type Archetype } from "./blueprints.js";
import type { BuildPlan, PlannedKpiEvidence, PlannedSkillEvidence } from "./build-plan.js";

/**
 * Da dove nasce un piano di costruzione. `key` è ciò che il fascicolo dichiara nel campo
 * `blueprint_variant_version_build_source_key`.
 */
export interface BuildSource {
  key: string;
  /** Il piano che questa sorgente produce. Asincrono: una sorgente vera legge (DB, rete). */
  plan(): Promise<BuildPlan>;
}

/**
 * La sorgente che legge un archetipo TypeScript. `justification` dice **quale decisione**
 * giustifica ogni riga: per l'archetipo è la scelta dell'archetipo stesso, e va scritta per
 * esteso perché finisce nel registro dell'origine di P3, dove qualcuno la leggerà senza
 * avere questo file davanti.
 */
export class ArchetypeBuildSource implements BuildSource {
  readonly key: string;
  private readonly archetype: Archetype;

  constructor(archetype: Archetype) {
    this.archetype = archetype;
    this.key = archetype.key;
  }

  /** Risolve la chiave dichiarata dal fascicolo. Chiave ignota → `undefined`, mai un ripiego. */
  static fromKey(key: string): ArchetypeBuildSource | undefined {
    const a = getArchetype(key);
    return a ? new ArchetypeBuildSource(a) : undefined;
  }

  async plan(): Promise<BuildPlan> {
    const a = this.archetype;
    const perche = `archetipo ${a.key}`;

    const incumbenti = archetypeUsers(a).map((u, ui) => {
      const skillEvidence: PlannedSkillEvidence[] = a.skills.map((sk, sj) => ({
        skillCode: sk.code,
        declaredProficiency: synProficiency(ui, sj),
      }));
      const kpiEvidence: PlannedKpiEvidence[] = a.kpis.map((kp, kj) => ({
        kpiCode: kp.code,
        measuredValue: synKpiValue(ui, kj),
        unit: kp.unit,
      }));
      return {
        externalCode: u.externalCode,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        displayName: u.displayName,
        positionCode: u.positionCode,
        skillEvidence,
        kpiEvidence,
        justification: `${perche}: titolare segnaposto della posizione ${u.positionCode}`,
      };
    });

    return {
      sourceKey: a.key,
      label: a.label,
      orgUnits: a.orgUnits.map((ou) => ({
        code: ou.code, name: ou.name, type: ou.type, parentCode: ou.parentCode,
        justification: `${perche}: unità organizzativa del modello`,
      })),
      positions: a.positions.map((p) => ({
        code: p.code, title: p.title, orgUnitCode: p.orgUnitCode,
        criticality: p.criticality, economicWeight: p.economicWeight,
        justification: `${perche}: posizione del modello, in ${p.orgUnitCode}`,
      })),
      skills: a.skills.map((sk) => ({
        code: sk.code, name: sk.name, kind: sk.kind, categoryCode: sk.categoryCode,
        justification: `${perche}: competenza del catalogo di modello`,
      })),
      kpis: a.kpis.map((kp) => ({
        code: kp.code, name: kp.name, polarity: kp.polarity, unit: kp.unit,
        justification: `${perche}: indicatore del catalogo di modello`,
      })),
      incumbents: incumbenti,
    };
  }
}
