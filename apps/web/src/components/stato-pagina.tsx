"use client";

/**
 * apps/web/src/components/stato-pagina.tsx
 *
 * F-5 del piano interfacce (lotto L7): i quattro stati di una pagina, in un modo solo.
 *
 *   - caricamento: annunciato a chi usa un lettore di schermo (`role="status"`), non solo scritto;
 *   - vuoto: dice PERCHÉ è vuoto quando la pagina lo sa, non solo «nessun risultato»;
 *   - negato: dice che la persona non ha accesso e perché, invece di un errore generico;
 *   - errore: il testo nella lingua della persona (F-4) e il CODICE, da citare a chi aiuta.
 *
 * Un 403 dell'API non è un errore della pagina: è un accesso negato, e si mostra come tale.
 * Ogni stato porta un `data-testid` sul contenitore (gli stati di `@heuresys/ui` non
 * propagano gli attributi che non conoscono: misurato su `build-plan-error`), così le prove
 * e gli agenti che leggono la pagina riconoscono lo stato senza leggere il testo.
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState, ErrorState, Spinner } from "@heuresys/ui";
import { Inbox, Lock } from "lucide-react";
import { isApiError, NetworkError, SessionExpiredError, testoPerLaPersona } from "@/lib/api/errors";

export function StatoCaricamento({ etichetta, testId = "stato-caricamento" }: { etichetta?: string; testId?: string }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid={testId}
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex items-center gap-2 rounded-card border border-border bg-card p-6 text-sm text-muted-foreground"
    >
      <Spinner className="h-4 w-4" />
      <span>{etichetta ?? t("common:loading")}</span>
    </div>
  );
}

export function StatoVuoto({
  titolo,
  motivo,
  azione,
  icona,
  testId = "stato-vuoto",
}: {
  titolo?: string;
  motivo?: string;
  azione?: ReactNode;
  icona?: ReactNode;
  testId?: string;
}) {
  const { t } = useTranslation();
  return (
    <div data-testid={testId} data-stato="vuoto">
      <EmptyState
        icon={icona ?? <Inbox className="h-6 w-6" aria-hidden="true" />}
        title={titolo ?? t("common:empty.none")}
        {...(motivo ? { description: motivo } : {})}
        {...(azione ? { action: azione } : {})}
      />
    </div>
  );
}

export function StatoNegato({ motivo, testId = "stato-negato" }: { motivo?: string; testId?: string }) {
  const { t } = useTranslation();
  return (
    <div data-testid={testId} data-stato="negato">
      <EmptyState
        icon={<Lock className="h-6 w-6" aria-hidden="true" />}
        title={t("common:stato.negato.titolo")}
        description={motivo ?? t("common:stato.negato.motivo")}
      />
    </div>
  );
}

/** Il codice da citare: quello dell'API, oppure la natura dell'errore quando non viene dall'API. */
export function codiceErrore(error: unknown): string | undefined {
  if (isApiError(error)) return error.code;
  if (error instanceof SessionExpiredError) return "SESSION_EXPIRED";
  if (error instanceof NetworkError) return "NETWORK_ERROR";
  return undefined;
}

export function StatoErrore({
  errore,
  titolo,
  onRiprova,
  testId = "stato-errore",
}: {
  errore?: unknown;
  titolo?: string;
  onRiprova?: () => void;
  testId?: string;
}) {
  const { t } = useTranslation();
  if (isApiError(errore) && errore.status === 403) {
    return <StatoNegato motivo={errore.message} testId={testId} />;
  }
  const codice = codiceErrore(errore);
  const testo = testoPerLaPersona(errore) ?? t("common:error.loadHint");
  return (
    <div data-testid={testId} data-stato="errore" {...(codice ? { "data-codice": codice } : {})} role="alert">
      <ErrorState
        title={titolo ?? t("common:error.load")}
        description={codice ? `${testo} ${t("common:stato.codice", { codice })}` : testo}
        {...(onRiprova ? { retry: onRiprova } : {})}
      />
    </div>
  );
}

/** Lo stato di una query: caricamento, errore, vuoto, oppure il contenuto. */
export function StatoDellaQuery({
  query,
  vuoto,
  vuotoTitolo,
  vuotoMotivo,
  erroreTitolo,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; error?: unknown; refetch?: () => unknown };
  vuoto?: boolean;
  vuotoTitolo?: string;
  vuotoMotivo?: string;
  erroreTitolo?: string;
  children: ReactNode;
}) {
  if (query.isLoading) return <StatoCaricamento />;
  if (query.isError) {
    const riprova = query.refetch;
    return (
      <StatoErrore
        errore={query.error}
        {...(erroreTitolo ? { titolo: erroreTitolo } : {})}
        {...(riprova ? { onRiprova: () => void riprova() } : {})}
      />
    );
  }
  if (vuoto) {
    return <StatoVuoto {...(vuotoTitolo ? { titolo: vuotoTitolo } : {})} {...(vuotoMotivo ? { motivo: vuotoMotivo } : {})} />;
  }
  return <>{children}</>;
}
