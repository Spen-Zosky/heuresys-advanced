import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";

/** A single read-only label/value pair inside a profile section. Empty -> em-dash. */
export function Field({ label, value, testId }: { label: string; value: ReactNode; testId?: string }) {
  const empty = value == null || value === "";
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground" data-testid={testId}>
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
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
        {footer ? <div className="pt-2">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

/** ISO `YYYY-MM-DD` -> `DD/MM/YYYY` (locale-neutral, display only). */
export function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Number + ISO currency -> grouped amount, e.g. 368734.11 EUR -> "368.734,11 €". */
export function fmtMoney(amount: number | null, currency: string | null): string | null {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: currency ?? "EUR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency ?? ""}`.trim();
  }
}
