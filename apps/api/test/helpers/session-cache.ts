/**
 * apps/api/test/helpers/session-cache.ts — Z-251 F2: le sessioni condivise fra file di test.
 *
 * PERCHÉ ESISTE. `vitest.config.ts` dichiara da mesi la causa dei rossi intermittenti:
 * «ogni file rifà i login da zero e Argon2id è lento per costruzione». Misurato il
 * 2026-08-19 con `scripts/profilo-costo-avvio.mts`: un login completo costa **753 ms**
 * (Argon2id due volte — lo step-2 della MFA rimanda la password — più il round-trip del
 * tunnel), e nei test ci sono ~**670 invocazioni** di login su sole **7 email distinte**.
 * Sono ~504 s, il 27% di una corsa integrale, spesi a ri-autenticare sette persone.
 *
 * PERCHÉ SI PUÒ FARE, e non è un trucco. L'access token è un **JWT stateless**: in `src/`
 * non esiste nessuna tabella di sessione — la sola tabella di sessione fra le 14 `sys_auth_*`
 * è `sys_auth_refresh_tokens`, che riguarda il refresh. Quindi un token emesso dentro la
 * transazione di un file (D-52: ogni file gira in UNA transazione, rollbackata a fine file)
 * **resta valido dopo il rollback**: la sua validità sta nella firma, non in una riga.
 *
 * PERCHÉ SU DISCO e non in memoria. `tx-isolation.ts` lo dice: «Vitest isolates the module
 * graph per file». Una `Map` a livello di modulo riparte vuota a ogni file — che è esattamente
 * il motivo per cui i login si ripetono. Il file di cache vive sotto `node_modules/.cache/`:
 * non versionato, non propagato ai cloni, azzerato a ogni corsa dal `globalSetup`.
 *
 * LE TRE GUARDIE (nessuna è teorica — ognuna copre un modo reale di rendere falsi i test):
 *  1. **Scadenza con margine.** Si serve una sessione solo se al suo `exp` mancano più di
 *     `MARGINE_SCADENZA_S`. Un token che scade a metà del file su cui viene usato produrrebbe
 *     401 sparsi — cioè lo stesso genere di rosso-che-non-è-un-difetto che questa voce combatte.
 *  2. **Mai una password esplicita.** I test che verificano il RIFIUTO di una password sbagliata,
 *     o che ne passano una diversa da quella derivata, non toccano la cache né in lettura né in
 *     scrittura.
 *  3. **I file che esercitano l'autenticazione ne stanno fuori**, per dichiarazione esplicita
 *     (`senzaCacheDiSessione()` in testa al file). Sono i 6 che usano il refresh cookie o la
 *     rotazione: riusare lì una sessione condivisa vorrebbe dire testare qualcosa che non è il
 *     flusso reale. Un cancello meccanico (`session-cache-optout.unit.test.ts`) verifica che chi
 *     tocca il refresh l'abbia dichiarato, così un file futuro non può dimenticarsene in silenzio.
 *
 * INTERRUTTORE GLOBALE: `TEST_SESSION_CACHE=0` riporta la suite al comportamento di prima
 * (un login vero a ogni chiamata). Serve a rispondere per misura, non per opinione, alla
 * domanda «è la cache che ha causato questo rosso?».
 */

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Il file di cache: fuori dal repo tracciato, dentro la cache di build di questo package. */
export const PERCORSO_CACHE = resolve(
  __dirname,
  "..",
  "..",
  "node_modules",
  ".cache",
  "heuresys-test-sessions.json",
);

/**
 * Quanto margine deve restare all'`exp` perché una sessione sia riusabile.
 * L'access TTL è 15 min (`ACCESS_JWT_TTL_SECONDS`); i file più lenti della suite hanno
 * hook che sfiorano i 120 s, quindi 120 s di margine coprono l'intero uso di un file.
 */
export const MARGINE_SCADENZA_S = 120;

/** La forma minima di risposta che i test consumano (Fastify inject). */
export interface RispostaSessione {
  statusCode: number;
  body: string;
  cookies: Array<{ name: string; value: string }>;
  headers: Record<string, string | string[] | number | undefined>;
}

interface VoceCache extends RispostaSessione {
  /** Scadenza dell'access JWT, in secondi epoch — letta dal token, non inventata. */
  exp: number;
}

type Contenuto = Record<string, VoceCache>;

/* ------------------------------------------------------------------ *
 * Stato per-file (il module graph è isolato per file: è voluto)
 * ------------------------------------------------------------------ */

let disattivataInQuestoFile = false;

/**
 * Dichiara che QUESTO file di test non usa sessioni condivise: farà login veri e non
 * scriverà nulla in cache. Da chiamare in testa al file, prima dei `describe`.
 *
 * Va usata da ogni file che esercita il flusso di autenticazione stesso — login, MFA,
 * rotazione del refresh, logout — dove una sessione presa da un altro file non
 * proverebbe ciò che il test dichiara di provare.
 */
export function senzaCacheDiSessione(): void {
  disattivataInQuestoFile = true;
}

/**
 * Riaccende la cache nel file corrente. Esiste per UNA ragione sola: le prove di
 * `senzaCacheDiSessione()` devono poter tornare indietro, altrimenti il primo caso che
 * la spegne renderebbe tutti i successivi ciechi — un test verde perché non guarda più.
 * Nei file di test veri non va usata: la dichiarazione di un file è una scelta, non uno stato.
 */
export function ripristinaCacheDiSessione(): void {
  disattivataInQuestoFile = false;
}

/** True se la cache è utilizzabile qui e ora (interruttore globale + dichiarazione del file). */
export function cacheAttiva(): boolean {
  if (disattivataInQuestoFile) return false;
  return process.env.TEST_SESSION_CACHE !== "0";
}

/* ------------------------------------------------------------------ *
 * Lettura dell'exp dal JWT — la scadenza è quella vera, non una stima
 * ------------------------------------------------------------------ */

/**
 * Estrae `exp` (secondi epoch) dal payload di un JWT, senza verificarne la firma:
 * qui non serve autenticare nulla, serve sapere quando il token smette di valere.
 * Ritorna `null` su qualunque forma inattesa — e un `null` significa "non riusabile",
 * mai "riusabile per sempre".
 */
export function scadenzaDaJwt(token: string): number | null {
  const parti = token.split(".");
  if (parti.length !== 3) return null;
  const payload = parti[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown;
    };
    return typeof json.exp === "number" && Number.isFinite(json.exp) ? json.exp : null;
  } catch {
    return null;
  }
}

/** L'access token dai cookie di una risposta di login (`hrx_access`). */
function accessDaCookie(r: RispostaSessione): string | null {
  return r.cookies.find((c) => c.name === "hrx_access")?.value ?? null;
}

/** True se alla scadenza manca più del margine — la sola condizione che autorizza il riuso. */
export function ancoraValida(exp: number, adessoS: number = Date.now() / 1000): boolean {
  return exp - adessoS > MARGINE_SCADENZA_S;
}

/* ------------------------------------------------------------------ *
 * Il file di cache
 * ------------------------------------------------------------------ */

function leggiFile(): Contenuto {
  try {
    return JSON.parse(readFileSync(PERCORSO_CACHE, "utf8")) as Contenuto;
  } catch {
    return {};
  }
}

function scriviFile(c: Contenuto): void {
  mkdirSync(dirname(PERCORSO_CACHE), { recursive: true });
  // Scrittura atomica: la suite è seriale (maxWorkers 1), ma una corsa interrotta a metà
  // scrittura lascerebbe un JSON troncato che il giro dopo leggerebbe come cache vuota —
  // silenzioso e non diagnosticabile.
  const tmp = `${PERCORSO_CACHE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(c), "utf8");
  renameSync(tmp, PERCORSO_CACHE);
}

/**
 * Azzera la cache. La chiama il `globalSetup` a ogni corsa: una sessione della corsa
 * precedente è quasi sempre scaduta, e se il database è cambiato sotto (reset, altro
 * ambiente) sarebbe valida per firma ma sbagliata per contenuto.
 */
export function azzeraCache(): void {
  rmSync(PERCORSO_CACHE, { force: true });
}

/**
 * La sessione salvata per questa email, se c'è ed è ancora valida col margine.
 * `null` in ogni altro caso — cache spenta, assente, senza token leggibile, o troppo
 * vicina alla scadenza.
 */
export function leggiSessione(email: string): RispostaSessione | null {
  if (!cacheAttiva()) return null;
  const voce = leggiFile()[email.toLowerCase()];
  if (!voce) return null;
  if (!ancoraValida(voce.exp)) return null;
  return { statusCode: voce.statusCode, body: voce.body, cookies: voce.cookies, headers: voce.headers };
}

/**
 * Salva la sessione di questa email. Non salva nulla se la cache è spenta, se la risposta
 * non è un login riuscito, o se il token non porta un `exp` leggibile: una voce senza
 * scadenza nota non è riusabile in sicurezza, e scriverla significherebbe deciderlo dopo.
 */
export function salvaSessione(email: string, r: RispostaSessione): void {
  if (!cacheAttiva()) return;
  if (r.statusCode !== 200) return;
  const access = accessDaCookie(r);
  if (!access) return;
  const exp = scadenzaDaJwt(access);
  if (exp === null) return;
  const c = leggiFile();
  c[email.toLowerCase()] = {
    statusCode: r.statusCode,
    body: r.body,
    cookies: r.cookies,
    headers: r.headers,
    exp,
  };
  scriviFile(c);
}

/* ------------------------------------------------------------------ *
 * Contatore dei login veri — è ciò che rende la cura MISURABILE
 * ------------------------------------------------------------------ */

const PERCORSO_CONTATORE = `${PERCORSO_CACHE}.contatore.json`;

/** Registra un login realmente eseguito contro l'API (non servito dalla cache). */
export function contaLoginVero(email: string): void {
  let c: Record<string, number> = {};
  try {
    c = JSON.parse(readFileSync(PERCORSO_CONTATORE, "utf8")) as Record<string, number>;
  } catch {
    c = {};
  }
  const k = email.toLowerCase();
  c[k] = (c[k] ?? 0) + 1;
  mkdirSync(dirname(PERCORSO_CONTATORE), { recursive: true });
  writeFileSync(PERCORSO_CONTATORE, JSON.stringify(c), "utf8");
}

/** Quanti login veri sono stati eseguiti finora nella corsa, per email. */
export function loginVeri(): Record<string, number> {
  try {
    return JSON.parse(readFileSync(PERCORSO_CONTATORE, "utf8")) as Record<string, number>;
  } catch {
    return {};
  }
}

/** Azzera il contatore (globalSetup, insieme alla cache). */
export function azzeraContatore(): void {
  rmSync(PERCORSO_CONTATORE, { force: true });
}
