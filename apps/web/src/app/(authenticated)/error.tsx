"use client";

/**
 * D-04 — confine d'errore DENTRO la shell autenticata.
 *
 * Un confine esisteva già, ma solo alla radice (F-008): cattura tutto, e proprio per
 * questo sostituisce l'intera applicazione. Un errore su una singola pagina faceva
 * sparire la barra laterale e l'intestazione, lasciando l'utente su una schermata da cui
 * l'unica via d'uscita è il tasto «indietro» del browser.
 *
 * Questo confine sta sotto `(authenticated)/layout.tsx`, quindi la navigazione
 * sopravvive: il guasto resta confinato all'area di contenuto, e da lì si può andare
 * altrove senza ricaricare. Con 113 pagine, un file qui le copre tutte — un `error.tsx`
 * per rotta sarebbe stato lo stesso comportamento, ripetuto 113 volte.
 *
 * Il confine radice resta al suo posto per ciò che sta FUORI dall'area autenticata
 * (accesso, pagine pubbliche) e per i guasti del layout stesso.
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@heuresys/ui";

export default function AuthenticatedSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error("[section-error]", error);
  }, [error]);

  return (
    <div
      role="alert"
      data-testid="section-error-boundary"
      className="mx-auto mt-16 max-w-md rounded-card border border-border bg-card p-6 text-center shadow-card"
    >
      <h2 className="text-lg font-semibold text-danger">{t("error.boundaryTitle")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("error.boundaryBody")}</p>
      {error.digest ? (
        <p className="mt-1 text-xs text-muted-foreground/70">
          {t("error.boundaryRef")} {error.digest}
        </p>
      ) : null}
      <Button className="mt-4" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
