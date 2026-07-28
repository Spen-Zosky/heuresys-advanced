/**
 * Serializzazione delle colonne **date-only** (RD-09: `date`, non `timestamptz`).
 *
 * Il driver `pg` restituisce una colonna `date` come `Date` costruita a
 * MEZZANOTTE LOCALE del processo. Farla passare per `toISOString()` la riporta a
 * UTC e, per qualunque fuso a est di Greenwich, la sposta al **giorno
 * precedente**: il database dice `2026-07-01` e l'API risponde `2026-06-30`.
 *
 * È un difetto invisibile dove il processo gira a UTC — la VM di produzione — e
 * sistematico ovunque altrove: ogni macchina di sviluppo italiana, e qualunque
 * futuro deploy in un fuso diverso. Per questo era sopravvissuto in 17 punti di
 * 7 moduli con un commento che lo dichiarava («ignoring TZ drift») invece di
 * risolverlo.
 *
 * Una data senza orario è un fatto del CALENDARIO, non un istante: va letta e
 * scritta nel calendario locale, mai convertita in un fuso.
 *
 * Falsificabilità: `test/date-only.test.ts` costruisce il caso a fuso italiano e
 * pretende che la lettura sbagliata e quella giusta DIVERGANO — altrimenti il
 * test passerebbe anche con il difetto in piedi (come accadeva nella CI a UTC).
 */

/** La data di calendario locale di `d`, come `YYYY-MM-DD`. `null` passa. */
export function toDateOnly(d: Date | string | null | undefined): string | null {
  if (d === null || d === undefined) return null;
  if (typeof d === "string") return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${g}`;
}

/**
 * La data di OGGI nel calendario locale. Mai `new Date().toISOString()`: fra
 * mezzanotte e le 02:00 di Roma restituirebbe ieri.
 */
export function todayDateOnly(): string {
  return toDateOnly(new Date())!;
}
