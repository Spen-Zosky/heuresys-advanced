"use client";

/**
 * /tassonomie — il navigatore dei cataloghi di classificazione (settori, professioni, competenze).
 *
 * Pagina NUOVA e additiva: legge solo endpoint che esistono già (`activity-classifications`,
 * `activity-classification-mappings`, `occupation-classifications`, `skills`,
 * `skill-taxonomy-edges`, ricerca per significato), quindi vede esattamente ciò che advanced
 * tiene per il tenant e non apre alcuna via verso il catalogo generale del datastore
 * (ADR-0043, regole 3 e 5). Se il perimetro dei cataloghi verrà ristretto lato API, questa
 * pagina si restringe da sola.
 *
 * Porta: scheda del gruppo «skill» in `section-tabs.tsx`, nessuna voce di menu nuova.
 */

import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/intestazione-pagina";
import { SchedePagina } from "@/components/schede-pagina";
import { SemanticSearchPanel } from "@/components/semantic-search-panel";
import { NavigatoreCodici, NavigatoreCompetenze } from "./_components/navigatore";

export default function TassonomiePage() {
  const { t } = useTranslation("hr");
  return (
    <main data-testid="tassonomie-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
      <PageHeader title={t("tassonomie.titolo")} description={t("tassonomie.descrizione")} />
      <SchedePagina
        schede={[
          {
            id: "settori",
            titolo: t("tassonomie.schede.settori"),
            contenuto: <NavigatoreCodici tipo="attivita" />,
          },
          {
            id: "professioni",
            titolo: t("tassonomie.schede.professioni"),
            contenuto: <NavigatoreCodici tipo="professione" />,
          },
          {
            id: "competenze",
            titolo: t("tassonomie.schede.competenze"),
            contenuto: <NavigatoreCompetenze />,
          },
          {
            id: "significato",
            titolo: t("tassonomie.schede.significato"),
            contenuto: <SemanticSearchPanel />,
          },
        ]}
      />
    </main>
  );
}
