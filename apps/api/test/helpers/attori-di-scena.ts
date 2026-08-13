/**
 * apps/api/test/helpers/attori-di-scena.ts — i cinque ruoli che recitano nelle verifiche di scope.
 *
 * PERCHE' ESISTE (#147, S1056)
 * ----------------------------
 * Le verifiche dell'asse organizzativo mettono in scena sempre le stesse cinque parti:
 * un capo, un suo sottoposto, un estraneo alla sua linea, un mandato HR sul tenant, e
 * un amministratore di piattaforma. Fino a oggi quelle parti erano **138 indirizzi email
 * scritti a mano in 20 file**.
 *
 * Il difetto non e' il nome in se' — e' che la CARATTERISTICA veniva data per scontata e
 * mai verificata. `actors.ts` lo dice gia' con la misura che lo fece nascere: «631
 * occorrenze in 170 file», e quando il dato e' cambiato sotto i test sono usciti 158 file
 * rossi con un messaggio che parlava d'altro. Le verifiche di scope erano il residuo.
 *
 * Che non sia teorico lo dice il dato di oggi: `paolo.caputo`, il capo nominato in
 * quattordici file, possiede **cinque posizioni tutte INATTIVE** (misurato in S1045). Il
 * suo perimetro di squadra e' legittimamente vuoto: quei test misuravano un caso limite
 * senza dirlo.
 *
 * COSA GARANTISCE, UNO PER UNO
 * ----------------------------
 *   capo        MANAGER senza mandato HR/piattaforma, che dirige un'unita' attiva e ha
 *               ALMENO UN sottoposto — la condizione e' verificata, non sperata.
 *   sottoposto  dentro l'albero delle UNITA' del capo, senza mandato proprio.
 *   estraneo    stesso tenant, FUORI da quell'albero, senza mandato proprio.
 *   hr          un TENANT_ADMIN: mandato HR, ampiezza di tenant (I20).
 *   piattaforma un PLATFORM_ADMIN: mandato tecnico, cross-tenant (ADR-0032).
 *
 * Tutti impersonabili (identita' attiva + secondo fattore): i test entrano davvero con
 * queste credenziali, e un attore senza identita' farebbe fallire il login invece della
 * regola che si voleva misurare.
 *
 * MEMOIZZATO, E NON E' UN DETTAGLIO
 * ---------------------------------
 * Una sola risoluzione per processo. Non per velocita': perche' il sottoposto e
 * l'estraneo sono calcolati RISPETTO al capo, e due risoluzioni diverse nello stesso
 * file darebbero una terna incoerente — un test che passa o fallisce per la ragione
 * sbagliata. `svuotaAttoriDiScena()` esiste per le prove che devono vedere la
 * risoluzione rifarsi.
 *
 * UNIVERSO VUOTO = ERRORE, NON VERIFICA CIECA. Ogni funzione sottostante lancia se la
 * caratteristica non esiste piu', con un messaggio che dice cosa manca. Una verifica che
 * non ha niente da guardare non deve poter essere contata fra quelle superate.
 */
import { pool } from "../../src/db/client.js";

import { platformAdmin, tenantAdmin } from "./actors.js";
import {
  unCapoConSottoposti,
  unEstraneoOrganizzativo,
  unSottopostoOrganizzativo,
  type Attore,
} from "./org-actors.js";

export interface AttoriDiScena {
  /** MANAGER con un'unita' attiva e almeno un sottoposto. */
  readonly capo: Attore;
  /** Dentro l'albero delle unita' del capo, senza mandato proprio. */
  readonly sottoposto: Attore;
  /** Stesso tenant, fuori da quell'albero, senza mandato proprio (I19). */
  readonly estraneo: Attore;
  /** TENANT_ADMIN — mandato HR, ampiezza di tenant (I20). */
  readonly hr: Attore;
  /** PLATFORM_ADMIN — mandato tecnico, cross-tenant (ADR-0032). */
  readonly piattaforma: Attore;
}

let cache: Promise<AttoriDiScena> | null = null;

async function risolvi(): Promise<AttoriDiScena> {
  const capo = await unCapoConSottoposti(pool);
  const [sottoposto, estraneo, hr, piattaforma] = await Promise.all([
    unSottopostoOrganizzativo(pool, capo.userId),
    unEstraneoOrganizzativo(pool, capo.userId),
    tenantAdmin(),
    platformAdmin(),
  ]);
  return {
    capo,
    sottoposto,
    estraneo,
    hr: { userId: hr.userId, email: hr.email },
    piattaforma: { userId: piattaforma.userId, email: piattaforma.email },
  };
}

/** I cinque ruoli di scena, derivati dal dato di oggi. Una sola risoluzione per processo. */
export function attoriDiScena(): Promise<AttoriDiScena> {
  cache ??= risolvi();
  return cache;
}

/** Svuota la memoria: serve alle prove che devono vedere la risoluzione rifarsi. */
export function svuotaAttoriDiScena(): void {
  cache = null;
}
