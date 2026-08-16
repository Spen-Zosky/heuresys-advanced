/**
 * packages/shared/src/schemas/_query-boolean.ts
 * Il booleano che arriva da una QUERYSTRING (#196, S1066).
 *
 * Il difetto che chiude, misurato e non dedotto. `z.coerce.boolean()` applica
 * `Boolean(v)`, e una querystring porta sempre STRINGHE:
 *
 *     "true"  -> true      (giusto per caso)
 *     "false" -> true      ← qualunque stringa non vuota e' truthy
 *     "0"     -> true
 *     ""      -> false
 *
 * Quindi `?isGlobal=false` non filtrava i non-globali: filtrava i globali, cioe'
 * l'esatto contrario di quello che chiedeva. Trovato dalla prova live di #196,
 * che chiedeva quanti indicatori sono dell'azienda e si sentiva rispondere 199 su
 * 199 — un numero che il database smentiva. Un filtro che risponde sempre «tutti»
 * non e' un filtro: e' un'assenza di filtro che si presenta come una scelta.
 *
 * Qui la conversione e' esplicita e ristretta: `true|false|1|0` (piu' `yes|no|on|off`,
 * che compaiono nei form HTML), maiuscole e minuscole indifferenti. Qualunque altra
 * stringa NON viene addomesticata a `true`: passa cosi' com'e' a `z.boolean()`, che
 * la rifiuta con un errore di validazione. Meglio un 400 esplicito di un filtro che
 * fa in silenzio il contrario.
 *
 * Un booleano VERO (da un corpo JSON) attraversa senza essere toccato.
 */
import { z } from "zod";

const VERO = new Set(["true", "1", "yes", "on"]);
const FALSO = new Set(["false", "0", "no", "off"]);

/**
 * Booleano leggibile da una querystring. Da spreadare nei `…ListQuerySchema`
 * al posto di `z.coerce.boolean()`:
 *
 *     isGlobal: queryBoolean().optional(),
 *     withValueOnly: queryBoolean().optional().default(true),
 */
export function queryBoolean() {
  return z.preprocess((v) => {
    if (typeof v !== "string") return v;
    const s = v.trim().toLowerCase();
    if (VERO.has(s)) return true;
    if (FALSO.has(s)) return false;
    return v; // non riconosciuto: lo rifiuta z.boolean(), non lo indovina questo
  }, z.boolean());
}
