/**
 * apps/api/src/lib/scope/conferma.ts — ADR-0050 D5 (2026-11-05).
 *
 * «Quando la lettura di COMPENSATION o EVALUATION di un'altra persona passa per il mandato
 * (asse hr_mandate) e non per la catena, la sessione deve avere una verifica del secondo
 * fattore recente.» Non vale per i propri dati (I17) né per la catena (I18).
 *
 * Tre pezzi, e ognuno sta in un posto solo:
 *
 *   1. QUALI LETTURE. Le rotte di lettura non-self il cui permesso cade su una resource di
 *      classe COMPENSATION o EVALUATION e che dichiarano `orgGate: "service"` (cioè
 *      restituiscono righe di persona): `registerConfermaD5` le marca all'avvio con
 *      `config.confermaD5`, leggendo la stessa tassonomia di `gate.ts`. Le rotte `catalog` e
 *      `aggregate` non restituiscono persone e restano fuori. Il dossier (`users`) è una
 *      resource PERSONAL che porta dentro la retribuzione e le valutazioni: lì la conferma
 *      mancante MASCHERA le due sezioni invece di negare la pagina (`users/service.ts`).
 *   2. LA SESSIONE. `actorFromRequest` aggiunge all'attore la sessione (famiglia di rinnovo,
 *      claim `fam`) e l'ora dell'ultima verifica del secondo fattore, che viaggia firmata
 *      nell'access token (claim `sua`): la decisione non va al database. Il login con il
 *      secondo fattore la mette, `/v1/auth/mfa/step-up/verify` la rinnova e riemette il token,
 *      il rinnovo del token la porta avanti senza rinnovarla (colonna della mig. 000476).
 *   3. LA DECISIONE. `serveConferma` dice se QUESTA lettura chiede una conferma che la
 *      sessione non ha. Il risolutore la chiama sulle rotte marcate e risponde 403
 *      `STEP_UP_REQUIRED`; la pagina chiede il codice e ripete la richiesta.
 *
 * Spento quando è spento il secondo fattore al login (`MFA_ENFORCEMENT_ENABLED=false`, solo
 * in sviluppo): senza secondo fattore al login non c'è niente da confermare.
 *
 * ⚠ CONFINE DICHIARATO: un attore costruito fuori da una richiesta HTTP (script, lavori
 * pianificati) non porta una sessione e non passa da qui. Un agente agisce con l'identità
 * della persona e attraverso le sue richieste (ADR-0040, D6): la conferma resta della persona.
 */
import type { FastifyInstance } from "fastify";
import { STEP_UP_REQUIRED_CODE, STEP_UP_WINDOW_MINUTES } from "@heuresys/shared";
import type { ActorContext } from "../actor.js";
import { ForbiddenError } from "../../errors/index.js";
import { dataClassOf, type DataClass } from "./data-classes.js";
import { permissionCodesOf } from "./gate.js";
import { isInOrgSubtree, isOrgUnitManager, type DbConnector } from "./org.js";
import { HR_MANDATED_ROLES, MANAGERIAL_ROLES } from "./resolver.js";

/** Le due classi che D5 protegge. */
export const CLASSI_CON_CONFERMA: ReadonlySet<DataClass> = new Set<DataClass>(["COMPENSATION", "EVALUATION"]);

declare module "fastify" {
  interface FastifyContextConfig {
    /** ADR-0050 D5: la classe che questa rotta legge per persona (messa da registerConfermaD5). */
    confermaD5?: DataClass;
  }
}

/** La sessione di chi chiama, vista da D5. */
export interface SessioneD5 {
  familyId: string;
  /** Ultima verifica del secondo fattore (secondi epoch), dal token firmato. */
  stepUpAt: number | null;
  /** Vero se quella verifica è dentro la finestra (STEP_UP_WINDOW_MINUTES). */
  confermaRecente: () => Promise<boolean>;
}

let attiva = false;

/** Vero quando D5 è acceso (lo accende `registerConfermaD5` con il secondo fattore al login). */
export function confermaD5Attiva(): boolean {
  return attiva;
}

/** Vero se `stepUpAt` (secondi epoch) è dentro la finestra rispetto a `adesso` (millisecondi). */
export function confermaDentroFinestra(stepUpAt: number | null, adesso: number = Date.now()): boolean {
  if (stepUpAt === null) return false;
  const eta = adesso / 1000 - stepUpAt;
  // un'ora nel futuro non è una conferma: un token con `sua` avanti è un token sbagliato
  return eta >= -60 && eta < STEP_UP_WINDOW_MINUTES * 60;
}

/** La sessione D5 di una richiesta, o undefined se D5 è spento o la richiesta non ha famiglia. */
export function sessioneD5(familyId: string | undefined, stepUpAt: number | undefined): SessioneD5 | undefined {
  if (!attiva || !familyId) return undefined;
  const ora = stepUpAt ?? null;
  return {
    familyId,
    stepUpAt: ora,
    confermaRecente: async () => confermaDentroFinestra(ora),
  };
}

/**
 * Vero se la lettura della classe `classe` su `soggetto` (null = un elenco del tenant) chiede
 * una conferma che la sessione non ha. Falso per i propri dati, per chi non porta un mandato
 * HR, per la catena, e quando D5 è spento.
 */
export async function serveConferma(
  q: DbConnector,
  actor: ActorContext,
  classe: DataClass | undefined,
  soggetto: string | null,
): Promise<boolean> {
  if (!classe || !CLASSI_CON_CONFERMA.has(classe)) return false;
  const sessione = actor.sessioneD5;
  if (!sessione) {
    // D5 acceso e richiesta autenticata senza famiglia: non c'è una sessione da confermare,
    // e la lettura per mandato non passa. Un attore senza richiesta (attiva=false nel suo
    // processo, o costruito a mano) non arriva qui con `attiva` vero e senza sessione.
    return attiva && actor.roles.some((r) => HR_MANDATED_ROLES.has(r)) && soggetto !== actor.userId;
  }
  if (soggetto === actor.userId) return false; // I17
  if (!actor.roles.some((r) => HR_MANDATED_ROLES.has(r))) return false; // non passa per il mandato
  if (await sessione.confermaRecente()) return false;
  // I18: per la catena la lettura non passa dal mandato.
  if (soggetto !== null && (await perCatena(q, actor, soggetto))) return false;
  return true;
}

async function perCatena(q: DbConnector, actor: ActorContext, soggetto: string): Promise<boolean> {
  const manageriale =
    actor.roles.some((r) => MANAGERIAL_ROLES.has(r)) || (await isOrgUnitManager(q, actor.userId));
  return manageriale && (await isInOrgSubtree(q, actor.userId, soggetto));
}

/** L'errore che la pagina riconosce: chiede il codice e ripete la richiesta. */
export function confermaRichiesta(classe: DataClass): ForbiddenError {
  return new ForbiddenError(
    `A recent second-factor confirmation is required to read ${classe} through the HR mandate (ADR-0050 D5)`,
    STEP_UP_REQUIRED_CODE,
  );
}

/** Le rotte marcate all'avvio, per le prove. */
export interface ConfermaD5Stats {
  rotte: Array<{ method: string; url: string; permissionCode: string; classe: DataClass }>;
}

declare module "fastify" {
  interface FastifyInstance {
    confermaD5Stats: ConfermaD5Stats;
  }
}

/**
 * Accende D5 e marca le rotte. Va chiamata PRIMA di registrare le rotte dei moduli (onRoute
 * vede solo quelle registrate dopo), come `registerOrgGateAssertion`.
 */
export function registerConfermaD5(app: FastifyInstance, accesa: boolean): ConfermaD5Stats {
  attiva = accesa;
  const stats: ConfermaD5Stats = { rotte: [] };
  app.decorate("confermaD5Stats", stats);
  if (!accesa) return stats;
  app.addHook("onRoute", (route) => {
    if (route.config?.orgGate !== "service") return;
    for (const permissionCode of permissionCodesOf(route)) {
      const [resource, verb, ...resto] = permissionCode.split(":");
      if (!resource || !verb || resto.includes("self")) continue;
      if (!["read", "view", "list"].includes(verb)) continue;
      const classe = dataClassOf(resource);
      if (!classe || !CLASSI_CON_CONFERMA.has(classe)) continue;
      route.config = { ...route.config, confermaD5: classe };
      stats.rotte.push({
        method: Array.isArray(route.method) ? route.method.join(",") : route.method,
        url: route.url,
        permissionCode,
        classe,
      });
      break;
    }
  });
  return stats;
}
