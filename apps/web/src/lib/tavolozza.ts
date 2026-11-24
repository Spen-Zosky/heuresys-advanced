/**
 * apps/web/src/lib/tavolozza.ts
 *
 * La tavolozza è una scelta della singola persona (riquadro «Aspetto» di /me/profile) e vive
 * solo sul server (`sys_user_preferences`, una riga per utente). Questo file tiene fuori dal
 * browser tutto ciò che potrebbe passare da una persona all'altra:
 *   - chi non ha scelto (o sceglie «Equilibrata», che è la tavolozza standard di @heuresys/ui)
 *     non porta nessuna variabile in linea: vale il foglio di stile del design system;
 *   - la copia `heuresys-palette` nel localStorage, che è del browser e non della persona, non si
 *     scrive più e si toglie, così la scelta di uno non diventa quella di chi usa lo stesso browser.
 */

import { applyPalette, type PaletteIdx } from "@heuresys/ui";
import type { MePalette } from "@heuresys/shared";

/** Chiave che @heuresys/ui scrive nel localStorage dal suo selettore (oggi solo nello showcase). */
export const CHIAVE_COPIA_TAVOLOZZA = "heuresys-palette";

/** Slug della scelta → indice in PALETTES di @heuresys/ui (ordine di dichiarazione, 1:1 con il CHECK dell'API). */
export const INDICE_TAVOLOZZA: Record<MePalette, PaletteIdx> = {
  balanced: 0,
  "cool-ocean": 1,
  "warm-sunset": 2,
  "brand-mono": 3,
};

const VARIABILI = ["--palette-1", "--palette-2", "--palette-3", "--palette-4"] as const;

interface StileModificabile {
  setProperty(nome: string, valore: string): void;
  removeProperty(nome: string): string;
}

/** Toglie le variabili in linea: torna in vigore la tavolozza standard del design system. */
export function ripristinaTavolozzaStandard(stile: StileModificabile = document.documentElement.style): void {
  for (const v of VARIABILI) stile.removeProperty(v);
}

/**
 * Applica la tavolozza scelta dalla persona. Senza scelta, o con «Equilibrata», non lascia niente
 * in linea. `applica` serve alle prove.
 */
export function applicaTavolozzaDellaPersona(
  scelta: MePalette | undefined,
  stile: StileModificabile = document.documentElement.style,
  applica: (idx: PaletteIdx) => void = applyPalette,
): void {
  if (!scelta || scelta === "balanced") {
    ripristinaTavolozzaStandard(stile);
    return;
  }
  applica(INDICE_TAVOLOZZA[scelta]);
}

/** Toglie dal browser la copia della scelta: il localStorage è condiviso fra chi usa lo stesso browser. */
export function dimenticaCopiaTavolozza(
  archivio: Pick<Storage, "removeItem"> | null = typeof window === "undefined" ? null : window.localStorage,
): void {
  try {
    archivio?.removeItem(CHIAVE_COPIA_TAVOLOZZA);
  } catch {
    /* archivio non disponibile: non c'è niente da togliere */
  }
}
