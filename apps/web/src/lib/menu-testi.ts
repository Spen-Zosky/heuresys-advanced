/**
 * apps/web/src/lib/menu-testi.ts — i testi e l'ordine dei gruppi della barra laterale.
 *
 * Regola di Enzo (2026-11-21): i titoli dei gruppi sono in tutto maiuscolo, le voci hanno solo
 * l'iniziale maiuscola. I titoli dei gruppi li mette in maiuscolo lo stile della barra; qui si
 * normalizzano le voci, che arrivano dal registro con maiuscole sparse («Piano Di Carriera»).
 * Le sigle (tutte maiuscole o con cifre) e i nomi propri elencati restano come sono.
 */
const NOMI_PROPRI = new Set(["Heuresys", "Italia", "Europa", "Basilea"]);

export function inizialeMaiuscola(testo: string): string {
  const parole = testo.split(/(\s+)/);
  let prima = true;
  return parole
    .map((p) => {
      if (/^\s*$/.test(p)) return p;
      // K22: il plurale inglese di una sigla («OKRs», «KPIs») resta sigla, non diventa «Okrs».
      const sigla = p.length > 1 && (p === p.toUpperCase() || /\d/.test(p) || /^[A-Z]{2,}s$/.test(p)) && /[A-ZÀ-Ý]/.test(p);
      const quella = prima;
      prima = false;
      if (sigla || NOMI_PROPRI.has(p)) return p;
      const minuscola = p.toLowerCase();
      return quella ? minuscola.charAt(0).toUpperCase() + minuscola.slice(1) : minuscola;
    })
    .join("");
}

/**
 * L'ordine dei gruppi scelto dalla persona, applicato a quelli che il registro oggi dichiara: gli
 * identificativi salvati che non esistono più si scartano, quelli nuovi si accodano nell'ordine
 * del registro.
 */
export function applicaOrdine(predefinito: string[], salvato: string[] | null): string[] {
  if (!salvato) return predefinito;
  const presenti = new Set(predefinito);
  const noti = salvato.filter((id, i) => presenti.has(id) && salvato.indexOf(id) === i);
  const dentro = new Set(noti);
  return [...noti, ...predefinito.filter((id) => !dentro.has(id))];
}

/** Sposta `id` in modo che finisca prima del gruppo `prima` (`null` = in fondo). */
export function spostaPrima(ordine: string[], id: string, prima: string | null): string[] {
  const resto = ordine.filter((x) => x !== id);
  if (prima === null) return [...resto, id];
  const i = resto.indexOf(prima);
  if (i < 0) return ordine;
  return [...resto.slice(0, i), id, ...resto.slice(i)];
}
