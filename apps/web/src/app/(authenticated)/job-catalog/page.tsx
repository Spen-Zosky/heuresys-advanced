"use client";

/**
 * /job-catalog — il catalogo mansioni (#43, linea C2).
 *
 * Pagina NUOVA: `job-families` e `job-roles` erano gli ultimi due moduli del
 * catalogo con API complete (9 endpoint fra i due) e nessuna pagina che li
 * chiamasse. Un dato che nessuna interfaccia espone non è nel prodotto.
 *
 * Struttura: prima le famiglie (l'ossatura), poi i ruoli che ne discendono —
 * e il menù dei ruoli mostra i nomi delle famiglie, non i loro identificativi.
 *
 * La voce nel menù laterale non sta in un file del frontend: è una riga del
 * registro sul database (migrazione `000219`), altrimenti la pagina esiste ma
 * non la raggiunge nessuno.
 */

import { useTranslation } from "react-i18next";
import { PageHeader } from "@heuresys/ui";
import { JobFamiliesPanel } from "./_components/job-families-panel";
import { JobRolesPanel } from "./_components/job-roles-panel";

export default function JobCatalogPage() {
  const { t } = useTranslation("admin");

  return (
    <main data-testid="job-catalog-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="job-catalog-title"
        title={t("jobCatalog.title")}
        description={t("jobCatalog.description")}
      />
      <JobFamiliesPanel />
      <JobRolesPanel />
    </main>
  );
}
