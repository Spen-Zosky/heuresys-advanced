/**
 * apps/api/src/lib/scope/mandati.ts — mandato K, R-1 (passo 33/0).
 *
 * ADR-0027/ADR-0036 già dicono "nessuna lista di ruoli locale decide una vista": qui in
 * `lib/scope/` è la fonte, non un'eccezione. Ma `resolver.ts` copre solo l'asse
 * ORGANIZZATIVO (chi vede i dati sensibili di chi). I 93 siti misurati da `I-C` sono
 * domande diverse — «posso concedere un ruolo», «ho il mandato GDPR», «vedo solo i clienti
 * che mi sono stati assegnati» — che finora ogni modulo si riscriveva a mano
 * (`isPlatformAdmin(actor)`, `actor.roles.includes("PLATFORM_ADMIN")`…): 93 copie che
 * potevano divergere senza che nessuna delle altre lo sapesse.
 *
 * Questo file espone quei mandati come PREDICATI, ciascuno definito da UN insieme di ruoli
 * in UN posto. Un ruolo nuovo entra nell'insieme qui e SOLO qui (mandato K, sezione, passo
 * 33): il sito che lo usa non cambia mai quando nasce un ruolo, cambia solo questo file.
 *
 * `haMandatoPiattaformaAssegnato` e `haMandatoGdpr` nascono con l'insieme di OGGI (misurato,
 * non indovinato): il primo vuoto perché il ruolo che lo popola non esiste ancora
 * (D9=B — lo riempiono R-9, R-8, R-5); il secondo con `PLATFORM_ADMIN`, perché è quello che
 * `gdpr/service.ts:43` controlla oggi con `isPlatform(actor)` — `DPO` (R-2) vi entra dopo.
 */

import type { ActorContext } from "../actor.js";
import type { RoleCode } from "../../config/constants.js";
import { HR_MANDATED_ROLES } from "./resolver.js";

/** Il mandato tecnico di piattaforma (ADR-0032): apre la superficie, non i dati sensibili. */
export const PLATFORM_MANDATE_ROLES: ReadonlySet<RoleCode> = new Set<RoleCode>(["PLATFORM_ADMIN"]);

/**
 * I ruoli di piattaforma che vedono/scrivono solo sui clienti a cui sono stati assegnati
 * (D9=B, mandato K — R-0 costruisce la tabella di assegnazione, questo insieme resta VUOTO
 * finché nessun ruolo lo popola). Lo riempiono, in ordine di nascita: R-9
 * (`PLATFORM_OPERATOR`, `SALES`), R-8 (`IMPLEMENTATION_CONSULTANT`), R-5
 * (`BLUEPRINT_MANAGER`). `SECURITY_ADMIN` (R-7) NON entra qui: è un ruolo di cliente
 * (mandato, sezione 2, conseguenza c).
 */
export const PLATFORM_ASSIGNED_MANDATE_ROLES: ReadonlySet<RoleCode> = new Set<RoleCode>([
  "PLATFORM_OPERATOR",
  "SALES",
]);

/**
 * Chi può concedere o revocare un ruolo a un'altra persona (`users/service.ts` `grantRole` /
 * `revokeRole`). Oggi identico a `TENANT_WIDE_MANDATE_ROLES` meno `PLATFORM_ADMIN`... non:
 * è il suo proprio insieme, perché `SECURITY_ADMIN` (R-7) vi entrerà con un vincolo di
 * tenant che `TENANT_ADMIN` già ha e `PLATFORM_ADMIN` no (mandato, passo 54).
 */
export const CAN_GRANT_ROLES: ReadonlySet<RoleCode> = new Set<RoleCode>([
  "PLATFORM_ADMIN",
  "TENANT_ADMIN",
]);

/**
 * Il mandato GDPR (`gdpr/service.ts`). Oggi = ciò che `isPlatform(actor)` già copriva
 * (misurato: `gdpr/service.ts:43,157`); `DPO` (R-2) vi entra quando nasce, e la stessa
 * migrazione toglie `gdpr:erase` a `HRMS_MANAGER` (D3=A, guardia G-D2).
 */
export const GDPR_MANDATE_ROLES: ReadonlySet<RoleCode> = new Set<RoleCode>(["PLATFORM_ADMIN"]);

/** Il mandato HR tenant-wide: alias leggibile di `HR_MANDATED_ROLES` (fonte in resolver.ts —
 *  non si duplica l'insieme, si duplica solo il nome per chi legge da qui). */
export function haMandatoHr(actor: ActorContext): boolean {
  return actor.roles.some((r) => HR_MANDATED_ROLES.has(r));
}

export function haMandatoPiattaforma(actor: ActorContext): boolean {
  return actor.roles.some((r) => PLATFORM_MANDATE_ROLES.has(r));
}

/**
 * Variante di `haMandatoPiattaforma` per i siti che non hanno un `ActorContext` completo
 * (es. `auth/service.ts`, che riceve solo `actorRoles: RoleCode[]` nel suo input tipizzato).
 */
export function ruoliHannoMandatoPiattaforma(roles: readonly RoleCode[]): boolean {
  return roles.some((r) => PLATFORM_MANDATE_ROLES.has(r));
}

export function haMandatoPiattaformaAssegnato(actor: ActorContext): boolean {
  return actor.roles.some((r) => PLATFORM_ASSIGNED_MANDATE_ROLES.has(r));
}

export function puoConcedereRuoli(actor: ActorContext): boolean {
  return actor.roles.some((r) => CAN_GRANT_ROLES.has(r));
}

export function haMandatoGdpr(actor: ActorContext): boolean {
  return actor.roles.some((r) => GDPR_MANDATE_ROLES.has(r));
}
