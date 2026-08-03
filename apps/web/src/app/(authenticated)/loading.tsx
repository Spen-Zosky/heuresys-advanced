"use client";
/**
 * D-04 — stato di caricamento della shell autenticata.
 *
 * Serve nel momento in cui un segmento non è ancora pronto: senza, la navigazione resta
 * sulla pagina precedente senza alcun segnale, e su una connessione lenta l'utente
 * clicca due volte credendo che il primo clic sia andato perso.
 *
 * È volutamente uno SCHELETRO e non un centrifugatore: occupa lo spazio che il contenuto
 * occuperà, così la pagina non salta quando arriva. Non è un componente riusabile — vive
 * qui perché descrive questa shell — quindi non appartiene a `@heuresys/ui`.
 *
 * `aria-busy` più il testo per i lettori di schermo: un'animazione muta non comunica
 * nulla a chi non la vede. Il testo passa da i18n come ovunque — per questo il file è
 * client: una stringa cablata qui sarebbe italiana anche per chi usa l'inglese.
 */
import { useTranslation } from "react-i18next";

export default function AuthenticatedSectionLoading() {
  const { t } = useTranslation();
  return (
    <div
      data-testid="section-loading"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto max-w-7xl space-y-6 px-6 py-8"
    >
      <span className="sr-only">{t("loading")}</span>
      <div className="h-8 w-64 animate-pulse rounded-input bg-muted" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded-input bg-muted/70" />
      <div className="space-y-2 pt-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-card bg-muted/50" />
        ))}
      </div>
    </div>
  );
}
