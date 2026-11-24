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

import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState, ErrorState, Spinner } from "@heuresys/ui";
import { Inbox, Lock } from "lucide-react";
import { isApiError, NetworkError, SessionExpiredError, testoErrore, testoPerLaPersona } from "@/lib/api/errors";

/**
 * Livello del titolo dello stato (K13, @heuresys/ui 1.7.0). Senza, è l'h3 della libreria: va bene
 * dentro una scheda che ha già il suo h2. Uno stato che sta subito sotto l'h1 della pagina passa
 * "h2", per non saltare un livello (axe heading-order).
 */
export type LivelloTitolo = ComponentProps<typeof EmptyState>["headingLevel"];

export function StatoCaricamento({ etichetta, testId = "stato-caricamento" }: { etichetta?: string; testId?: string }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid={testId}
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
    >
      <Spinner className="h-4 w-4" label={etichetta ?? t("common:loading")} />
      <span>{etichetta ?? t("common:loading")}</span>
    </div>
  );
}

export function StatoVuoto({
  titolo,
  motivo,
  azione,
  icona,
  compatto,
  livelloTitolo,
  testId = "stato-vuoto",
}: {
  titolo?: string;
  motivo?: string;
  azione?: ReactNode;
  icona?: ReactNode;
  /** Una riga sola, per i vuoti dentro una scheda o una tabellina: stesso stato, meno spazio. */
  compatto?: boolean;
  livelloTitolo?: LivelloTitolo;
  testId?: string;
}) {
  const { t } = useTranslation();
  if (compatto) {
    return (
      <p data-testid={testId} data-stato="vuoto" className="text-sm text-muted-foreground">
        {titolo ?? t("common:empty.none")}
        {motivo ? ` ${motivo}` : ""}
      </p>
    );
  }
  return (
    <div data-testid={testId} data-stato="vuoto">
      <EmptyState
        icon={icona ?? <Inbox className="h-6 w-6" aria-hidden="true" />}
        title={titolo ?? t("common:empty.none")}
        {...(motivo ? { description: motivo } : {})}
        {...(azione ? { action: azione } : {})}
        headingLevel={livelloTitolo}
      />
    </div>
  );
}

export function StatoNegato({ motivo, livelloTitolo, testId = "stato-negato" }: { motivo?: string; livelloTitolo?: LivelloTitolo; testId?: string }) {
  const { t } = useTranslation();
  return (
    <div data-testid={testId} data-stato="negato">
      <EmptyState
        icon={<Lock className="h-6 w-6" aria-hidden="true" />}
        title={t("common:stato.negato.titolo")}
        description={motivo ?? t("common:stato.negato.motivo")}
        headingLevel={livelloTitolo}
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
  motivoNegato,
  livelloTitolo,
  testId = "stato-errore",
}: {
  errore?: unknown;
  titolo?: string;
  onRiprova?: () => void;
  /** Il motivo da dire se l'API nega l'accesso (403), quando la pagina lo sa meglio dell'API. */
  motivoNegato?: string;
  livelloTitolo?: LivelloTitolo;
  testId?: string;
}) {
  const { t } = useTranslation();
  if (isApiError(errore) && errore.status === 403) {
    return <StatoNegato motivo={motivoNegato ?? testoErrore(errore.status, errore.code)} livelloTitolo={livelloTitolo} testId={testId} />;
  }
  const codice = codiceErrore(errore);
  // Giro 18/11 (G-RENDER): «non trovato» scriveva UUID e NOT_FOUND nel testo. Il messaggio e' in parole;
  // il riferimento tecnico sta in una riga secondaria, chiusa, e solo per gli errori che l'assistenza
  // deve poter cercare (server, rete): una pagina «non trovata» non ne ha bisogno.
  const api = isApiError(errore) ? errore : null;
  const testo = api ? testoErrore(api.status, api.code) : (testoPerLaPersona(errore) ?? t("common:error.loadHint"));
  const perAssistenza = !api || api.status >= 500;
  const dettagli = [
    api?.requestId ? t("common:apiErrors.reference", { requestId: api.requestId }) : null,
    codice ? t("common:stato.codice", { codice }) : null,
  ].filter((x): x is string => x !== null);
  return (
    <div data-testid={testId} data-stato="errore" {...(codice ? { "data-codice": codice } : {})} role="alert">
      <ErrorState
        title={titolo ?? t("common:error.load")}
        description={testo}
        {...(onRiprova ? { retry: onRiprova } : {})}
        headingLevel={livelloTitolo}
      />
      {perAssistenza && dettagli.length > 0 ? (
        <details className="mx-auto mt-1 max-w-md break-words px-4 text-center text-xs text-muted-foreground">
          <summary className="cursor-pointer">{t("common:stato.perAssistenza")}</summary>
          <p className="mt-1">{dettagli.join(" ")}</p>
        </details>
      ) : null}
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
  livelloTitolo,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; error?: unknown; refetch?: () => unknown };
  vuoto?: boolean;
  vuotoTitolo?: string;
  vuotoMotivo?: string;
  erroreTitolo?: string;
  livelloTitolo?: LivelloTitolo;
  children: ReactNode;
}) {
  if (query.isLoading) return <StatoCaricamento />;
  if (query.isError) {
    const riprova = query.refetch;
    return (
      <StatoErrore
        errore={query.error}
        livelloTitolo={livelloTitolo}
        {...(erroreTitolo ? { titolo: erroreTitolo } : {})}
        {...(riprova ? { onRiprova: () => void riprova() } : {})}
      />
    );
  }
  if (vuoto) {
    return <StatoVuoto livelloTitolo={livelloTitolo} {...(vuotoTitolo ? { titolo: vuotoTitolo } : {})} {...(vuotoMotivo ? { motivo: vuotoMotivo } : {})} />;
  }
  return <>{children}</>;
}
