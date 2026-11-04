/**
 * apps/web/src/lib/api/session-cache.ts
 *
 * V-12 del piano interfacce (D-24 del giro V4). Il layout autenticato rileggeva l'identità
 * (`/v1/auth/me`), il menu (`/v1/me/interfaces`) e i permessi (`/v1/me/permissions`) a ogni
 * pagina aperta: 110 letture dell'identità e del menu per persona in un giro, 17-19 dei
 * permessi. Sono dati che cambiano all'accesso, all'uscita e quando cambiano i ruoli, non a
 * ogni pagina.
 *
 * Qui le tre letture si tengono nello `sessionStorage` della scheda, con l'ora in cui sono
 * arrivate: una pagina nuova (anche un ricaricamento) parte da lì e non richiede finché la
 * copia è fresca. La copia si butta:
 *   - all'accesso e all'uscita (`svuotaCopiaDiSessione`);
 *   - quando l'API risponde 403: un permesso negato può voler dire che i ruoli sono cambiati,
 *     quindi si rileggono permessi e menu (`segnalaPermessoNegato`, al più una volta ogni 30 s).
 * Il controllo vero resta nell'API (`requirePermission`): la copia decide solo che cosa
 * mostrare, mai che cosa si può fare.
 */

const PREFISSO = "hrx-sessione:";
/** Quanto resta fresca una copia: oltre, la si rilegge alla prima pagina. */
export const FRESCHEZZA_MS = 5 * 60_000;

interface Copia<T> {
  data: T;
  savedAt: number;
}

function archivio(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function leggiCopia<T>(chiave: string): Copia<T> | undefined {
  const s = archivio();
  if (!s) return undefined;
  try {
    const raw = s.getItem(PREFISSO + chiave);
    if (!raw) return undefined;
    const c = JSON.parse(raw) as Copia<T>;
    if (typeof c?.savedAt !== "number" || Date.now() - c.savedAt > FRESCHEZZA_MS) return undefined;
    return c;
  } catch {
    return undefined;
  }
}

export function scriviCopia<T>(chiave: string, data: T): T {
  const s = archivio();
  if (s) {
    try {
      s.setItem(PREFISSO + chiave, JSON.stringify({ data, savedAt: Date.now() } satisfies Copia<T>));
    } catch {
      /* archivio pieno o negato: si legge dall'API, come prima */
    }
  }
  return data;
}

export function svuotaCopiaDiSessione(): void {
  const s = archivio();
  if (!s) return;
  try {
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i);
      if (k?.startsWith(PREFISSO)) s.removeItem(k);
    }
  } catch {
    /* niente da svuotare */
  }
}

type Ascoltatore = () => void;
const ascoltatori = new Set<Ascoltatore>();
let ultimoAvviso = 0;

/** Chi tiene le query (AppProviders) si iscrive per rileggere permessi e menu. */
export function suPermessoNegato(fn: Ascoltatore): () => void {
  ascoltatori.add(fn);
  return () => {
    ascoltatori.delete(fn);
  };
}

/** Chiamata da apiFetch su un 403: i ruoli possono essere cambiati. */
export function segnalaPermessoNegato(): void {
  const ora = Date.now();
  if (ora - ultimoAvviso < 30_000) return;
  ultimoAvviso = ora;
  svuotaCopiaDiSessione();
  for (const fn of ascoltatori) fn();
}
