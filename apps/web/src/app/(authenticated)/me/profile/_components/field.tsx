import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { i18n } from "@/lib/i18n";
import { formati, VUOTO } from "@/lib/format";

/** A single read-only label/value pair inside a profile section. Empty -> em-dash. */
export function Field({ label, value, testId, emailAmmessa }: { label: string; value: ReactNode; testId?: string; emailAmmessa?: boolean }) {
  const empty = value == null || value === "";
  return (
    <div className="min-w-0 space-y-0.5" {...(emailAmmessa ? { "data-giro-email-ammessa": "" } : {})}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      {/* Un testo del profilo (CAP, matricola, IBAN, telefono) è un identificativo: la rete di
          leggibilità non lo tocca, altrimenti «24122» diventerebbe «24.122». I numeri veri
          arrivano già in forma dalla pagina. */}
      {/* K20 (forense 23/11): un valore senza spazi (IBAN) va a capo nella sua colonna invece di
          coprire quella accanto; `min-w-0` lascia restringere la casella nella griglia. */}
      <dd className="wrap-anywhere text-sm font-medium text-foreground" data-testid={testId} {...(typeof value === "string" && !/^-?\d+[.,]\d+$/.test(value) ? { "data-grezzo": "" } : {})}>
        {empty ? <span className="text-muted-foreground">—</span> : value}
      </dd>
    </div>
  );
}

/** A titled card wrapping a 2-column definition list of Fields. Interactive
 *  extras (buttons, links) go in `footer` — rendered OUTSIDE the <dl>, whose
 *  direct children must be dt/dd groups (axe `definition-list`, serious). */
export function ProfileSection({
  title,
  children,
  footer,
  testId,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader><CardTitle as="h2">{title}</CardTitle></CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
        {footer ? <div className="pt-2">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

/**
 * F-1 (piano interfacce, 2026-11-04): le due funzioni restano per le schede del profilo, ma
 * delegano alla forma comune (`@/lib/format`) nella lingua del portale. Restituiscono `null`
 * quando il valore manca, cosi' `Field` mostra il suo trattino.
 */
export function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const v = formati(i18n.language).data(iso);
  return v === VUOTO ? iso : v;
}

/** Data e ora (per gli istanti, come l'ultimo accesso). */
export function fmtDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const v = formati(i18n.language).dataOra(iso);
  return v === VUOTO ? iso : v;
}

/** Importo nella valuta del dato; senza valuta, il solo numero (non si inventa l'euro). */
export function fmtMoney(amount: number | null | undefined, currency: string | null | undefined): string | null {
  if (amount == null) return null;
  return formati(i18n.language).importo(amount, currency ?? null);
}

/** Nome del paese nella lingua del portale a partire dal codice ISO (IT diventa Italia); un codice sconosciuto resta com'e'. */
export function fmtPaese(codice: string | null | undefined): string | null {
  if (!codice) return null;
  try {
    return new Intl.DisplayNames([i18n.language], { type: "region" }).of(codice.toUpperCase()) ?? codice;
  } catch {
    return codice;
  }
}
