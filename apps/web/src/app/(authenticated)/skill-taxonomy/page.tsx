"use client";

/**
 * /skill-taxonomy — l'ossatura del catalogo competenze (#43, linea C2).
 *
 * Pagina NUOVA. Tre moduli API — `skill-families`, `skill-categories`,
 * `skill-proficiency-levels` — avevano endpoint completi e nessuna interfaccia:
 * la struttura sotto le 14.000 competenze si governava solo da database.
 *
 * Sta su una pagina propria e non dentro `/skills` perché quella è già densa
 * (ricerca semantica, ricerca testuale, creazione, modifica, 14k righe) e
 * perché sono due mestieri diversi: là si cura il CATALOGO, qui la sua FORMA.
 *
 * La voce nel menù è una riga del registro sul database (migrazione `000220`).
 */

import { useTranslation } from "react-i18next";
import { PageHeader } from "@heuresys/ui";
import {
  ProficiencyLevelsPanel,
  SkillCategoriesPanel,
  SkillFamiliesPanel,
} from "./_components/taxonomy-panels";

export default function SkillTaxonomyPage() {
  const { t } = useTranslation("hr");

  return (
    <main data-testid="skill-taxonomy-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="skill-taxonomy-title"
        title={t("taxonomy.title")}
        description={t("taxonomy.description_page")}
      />
      {/* Ordine = gerarchia: le famiglie contengono le categorie, che
          classificano le competenze; i livelli chiudono come riferimento. */}
      <SkillFamiliesPanel />
      <SkillCategoriesPanel />
      <ProficiencyLevelsPanel />
    </main>
  );
}
