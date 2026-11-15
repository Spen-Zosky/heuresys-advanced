"use client";

/**
 * Pagina 404 dell'applicazione (Next.js App Router). Senza questo file Next mostra il proprio
 * testo in inglese («This page could not be found.») anche con l'interfaccia in italiano:
 * qui il testo segue la lingua scelta, come ogni altra pagina.
 */

import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto mt-16 max-w-md p-6 text-center" data-testid="pagina-non-trovata">
      <h1 className="text-lg font-semibold">{t("error.notFoundTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("error.notFoundBody")}</p>
      <Link href="/" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
        {t("error.notFoundHome")}
      </Link>
    </main>
  );
}
