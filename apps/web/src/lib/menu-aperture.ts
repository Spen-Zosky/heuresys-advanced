/**
 * apps/web/src/lib/menu-aperture.ts — quali gruppi e rami della barra laterale sono aperti.
 *
 * Rilievo di Enzo (2026-11-28): «non tutti i gruppi e sottogruppi rispondono ai comandi di
 * collassamento; non riesco mai ad avere tutti i gruppi principali chiusi; non sempre collassa un
 * sottogruppo». Tre cause, trattate come una classe sola:
 *   1. il gruppo principale nascondeva il contenuto con una regola CSS del guscio
 *      (`.sidebar-group-toggle[aria-expanded="false"] + .sidebar-group-content`) che vale solo se
 *      il pulsante e l'elenco sono fratelli adiacenti; dal riordino dei gruppi (21/11) il pulsante
 *      sta in una testata con la maniglia, e il gruppo non si chiudeva mai (cambiava solo la freccia);
 *   2. il ramo che contiene la pagina attiva era aperto per forza (`aperto || dentro`): il clic
 *      scriveva in memoria ma non cambiava niente sullo schermo;
 *   3. gruppi e rami tenevano lo stato in due memorie lette in modi diversi, senza un comando
 *      che li chiudesse tutti.
 *
 * Qui lo stato è uno solo, nella memoria del browser, con due chiavi (gruppi e rami: le stesse di
 * prima, così le scelte già fatte restano). Un id assente vale «aperto». La pagina attiva apre il
 * suo gruppo e la sua catena di rami una volta sola, quando si arriva su una pagina nuova; dopo,
 * vale la scelta della persona, anche se ricarica la pagina.
 *
 * Funzioni pure in testa (provate in `menu-aperture.test.ts`), accesso alla memoria in coda.
 */
import type { Ramo } from "./menu-albero";

export const CHIAVE_GRUPPI = "heuresys-sidebar-groups";
export const CHIAVE_RAMI = "hrx-menu-rami";
/** Nella sessione del browser: l'ultima pagina per cui si è aperto il ramo da sé. */
export const CHIAVE_ULTIMA_PAGINA = "hrx-menu-ultima-pagina";

export type Memoria = Record<string, boolean>;

export function leggiMemoria(testo: string | null): Memoria {
  try {
    const v = JSON.parse(testo || "{}") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Memoria) : {};
  } catch {
    return {};
  }
}

export function eAperto(m: Memoria, id: string): boolean {
  return m[id] !== false;
}

/** La memoria con gli id dati tutti aperti (`true`) o tutti chiusi (`false`). */
export function impostaTutti(m: Memoria, ids: readonly string[], aperto: boolean): Memoria {
  const n = { ...m };
  for (const id of ids) n[id] = aperto;
  return n;
}

/**
 * Gli id dei rami da aprire per vedere la voce `attiva` dentro il gruppo `idGruppo`, dal più
 * esterno al più interno: `[]` se la voce sta direttamente sotto il gruppo, `null` se il gruppo non
 * la contiene. Gli id seguono `RamoMenu`: `<idGruppo>/<chiave>/<chiave>…`.
 */
export function catenaVersoPagina(albero: Ramo, idGruppo: string, attiva: string | null): string[] | null {
  if (!attiva) return null;
  if (albero.voci.some((v) => v.href === attiva)) return [];
  for (const r of albero.rami) {
    const id = `${idGruppo}/${r.chiave}`;
    const sotto = catenaVersoPagina(r, id, attiva);
    if (sotto) return [id, ...sotto];
  }
  return null;
}

/* ---------- accesso alla memoria del browser ---------- */

const ascoltatori = new Set<() => void>();

/** Per `useSyncExternalStore`: avvisa anche quando la memoria cambia da un'altra scheda. */
export function iscrivi(f: () => void): () => void {
  ascoltatori.add(f);
  const daAltraScheda = (e: StorageEvent) => {
    if (e.key === CHIAVE_GRUPPI || e.key === CHIAVE_RAMI) f();
  };
  window.addEventListener("storage", daAltraScheda);
  return () => {
    ascoltatori.delete(f);
    window.removeEventListener("storage", daAltraScheda);
  };
}

export function istantanea(chiave: string): string {
  try {
    return window.localStorage.getItem(chiave) || "{}";
  } catch {
    return "{}";
  }
}

export function scrivi(chiave: string, cambia: (m: Memoria) => Memoria): void {
  try {
    const m = leggiMemoria(window.localStorage.getItem(chiave));
    window.localStorage.setItem(chiave, JSON.stringify(cambia(m)));
  } catch {
    /* il browser può negare la memoria: si resta col comportamento predefinito */
  }
  ascoltatori.forEach((f) => f());
}

/**
 * Apre gruppo e rami che portano alla pagina attiva, ma solo la prima volta che si arriva su
 * quella pagina in questa scheda: un ricaricamento o un secondo disegno della barra non riaprono
 * ciò che la persona ha chiuso.
 */
export function apriVersoPagina(idGruppo: string, catena: readonly string[], attiva: string): void {
  try {
    if (window.sessionStorage.getItem(CHIAVE_ULTIMA_PAGINA) === attiva) return;
    window.sessionStorage.setItem(CHIAVE_ULTIMA_PAGINA, attiva);
  } catch {
    /* senza memoria di sessione si apre comunque: è il comportamento più sicuro */
  }
  scrivi(CHIAVE_GRUPPI, (m) => impostaTutti(m, [idGruppo], true));
  if (catena.length > 0) scrivi(CHIAVE_RAMI, (m) => impostaTutti(m, catena, true));
}
