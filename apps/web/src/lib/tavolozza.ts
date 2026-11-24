/**
 * apps/web/src/lib/tavolozza.ts
 *
 * Non c'è più una scelta di tavolozza (decisione di Enzo, 24/11/2026): vale solo quella standard
 * di @heuresys/ui, in chiaro e in scuro. Resta una funzione sola, che toglie dal browser la copia
 * `heuresys-palette` lasciata dal vecchio selettore, per non portarsi dietro un residuo.
 */

/** Chiave che il vecchio selettore scriveva nel localStorage. */
export const CHIAVE_COPIA_TAVOLOZZA = "heuresys-palette";

export function dimenticaCopiaTavolozza(
  archivio: Pick<Storage, "removeItem"> | null = typeof window === "undefined" ? null : window.localStorage,
): void {
  try {
    archivio?.removeItem(CHIAVE_COPIA_TAVOLOZZA);
  } catch {
    /* archivio non disponibile: non c'è niente da togliere */
  }
}
