/**
 * apps/api/test/semantic-matching-self-only.integration.test.ts
 *
 * Z-203 — «confermare il role-set self-only per il peer occupation-fit» (assorbe backlog:OQ-4).
 *
 * Risposta verificata: **non esiste un set di ruoli locale**, e non deve esistere. Chi puo' leggere
 * il dato sensibile di un altro lo decide `canReadOrgTarget` e nient'altro — self (I17), mandato HR
 * (I20), ruolo manageriale OPPURE responsabile di unita' organizzativa + sotto-albero (I18), stesso
 * tenant (I5). Il service teneva una lista scritta a mano che duplicava quella decisione e la
 * contraddiceva: la managerialita', per F1, e' anche un fatto di DATO (`isOrgUnitManager`), non solo
 * di ruolo RBAC.
 *
 * L'INVARIANTE SOTTO TEST, in una riga: per ogni coppia (attore, bersaglio), l'esito dei metodi
 * per-bersaglio deve coincidere con la decisione del resolver. Se un modulo reintroduce una scala
 * di ruoli locale, i due divergono e questi test diventano rossi.
 *
 * Tre difetti della prima stesura, trovati dai revisori adversarial e corretti qui:
 *   1. il fixture sceglieva l'attore col predicato del RESOLVER (5 ruoli) invece che con la LISTA
 *      RIMOSSA (3 ruoli + il caso «nessun ruolo»), e senza ordinamento: poteva pescare un attore
 *      che il codice pre-fix lasciava gia' passare, e passare cosi' anche contro il bug;
 *   2. il test sull'insieme dei ruoli era una tautologia — costruiva atteso e osservato dalle stesse
 *      costanti, quindi non poteva fallire;
 *   3. il fix tocca TRE metodi ma il test ne esercitava UNO: gli altri due erano senza rete.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { pool } from "../src/db/client.js";
import { semanticMatchingService } from "../src/modules/semantic-matching/service.js";
import { canReadOrgTarget } from "../src/lib/scope/resolver.js";
import type { ActorContext } from "../src/lib/actor.js";
import type { RoleCode } from "../src/config/constants.js";
import { NotFoundError } from "../src/errors/index.js";

/**
 * La lista RIMOSSA dal service, replicata qui di proposito: e' il predicato del BUG, non quello del
 * modello. Serve a selezionare esattamente gli attori che il codice pre-Z-203 bloccava — inclusi
 * quelli SENZA alcun ruolo, perche' `[].some(...)` valeva `false` e quindi erano self-only anche loro.
 */
const LISTA_RIMOSSA: ReadonlySet<string> = new Set(["USER", "TEAM_MEMBER", "READ_ONLY"]);
const bloccatoDallaListaRimossa = (roles: string[]): boolean => !roles.some((r) => !LISTA_RIMOSSA.has(r));

/** I tre metodi per-bersaglio da cui il fast-path e' stato rimosso: vanno coperti tutti. */
const METODI = [
  { nome: "userOccupations", fn: semanticMatchingService.userOccupations.bind(semanticMatchingService) },
  { nome: "userPositions", fn: semanticMatchingService.userPositions.bind(semanticMatchingService) },
  { nome: "userJobRoles", fn: semanticMatchingService.userJobRoles.bind(semanticMatchingService) },
] as const;

interface Caso {
  attore: ActorContext;
  email: string;
  bersaglio: string;
}

/** Responsabile di OU che la lista rimossa bloccava, con almeno un riporto reale. */
let casoDivergente: Caso | null = null;
/** Attore senza managerialita' alcuna: self-only anche per il resolver. */
let casoSelfOnly: Caso | null = null;

async function ruoliDi(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ code: string }>(
    `SELECT r.auth_role_code AS code
       FROM sys.sys_user_auth_roles uar
       JOIN sys.sys_auth_roles r ON r.auth_role_id = uar.user_auth_role_role_id
      WHERE uar.user_auth_role_user_id = $1 AND uar.user_auth_role_revoked_at IS NULL
      ORDER BY 1`,
    [userId],
  );
  return rows.map((r) => r.code);
}

/** Un riporto nel sotto-albero, derivato dalla STESSA relazione del resolver (catena reports-to). */
async function unRiporto(userId: string): Promise<string | null> {
  const { rows } = await pool.query<{ uid: string }>(
    `SELECT a2.user_position_assignment_user_id AS uid
       FROM sys.sys_positions p
       JOIN sys.sys_user_position_assignments a2
         ON a2.user_position_assignment_position_id = p.position_id
        AND a2.user_position_assignment_status = 'ACTIVE'
      WHERE p.position_reports_to_position_id IN (
              SELECT upa.user_position_assignment_position_id
                FROM sys.sys_user_position_assignments upa
               WHERE upa.user_position_assignment_user_id = $1
                 AND upa.user_position_assignment_status = 'ACTIVE')
        AND a2.user_position_assignment_user_id <> $1
      ORDER BY 1
      LIMIT 1`,
    [userId],
  );
  return rows[0]?.uid ?? null;
}

beforeAll(async () => {
  // ORDER BY esplicito: il caso scelto non deve dipendere dal planner.
  const { rows: responsabili } = await pool.query<{ uid: string; email: string; tenant: string | null }>(
    `SELECT DISTINCT ou.organization_unit_manager_user_id AS uid, u.user_email AS email, u.user_tenant_id AS tenant
       FROM sys.sys_organization_units ou
       JOIN sys.sys_users u ON u.user_id = ou.organization_unit_manager_user_id
      WHERE ou.organization_unit_manager_user_id IS NOT NULL
      ORDER BY u.user_email`,
  );
  for (const r of responsabili) {
    const roles = await ruoliDi(r.uid);
    if (!bloccatoDallaListaRimossa(roles)) continue; // il pre-fix lo lasciava gia' passare: non prova nulla
    const rip = await unRiporto(r.uid);
    if (!rip) continue; // senza riporti il diniego era inerte: non osservabile
    casoDivergente = { attore: { userId: r.uid, tenantId: r.tenant, roles: roles as RoleCode[] }, email: r.email, bersaglio: rip };
    break;
  }

  const { rows: altri } = await pool.query<{ uid: string; email: string; tenant: string | null }>(
    `SELECT u.user_id AS uid, u.user_email AS email, u.user_tenant_id AS tenant
       FROM sys.sys_users u
      WHERE NOT EXISTS (SELECT 1 FROM sys.sys_organization_units ou
                         WHERE ou.organization_unit_manager_user_id = u.user_id)
      ORDER BY u.user_email
      LIMIT 300`,
  );
  for (const c of altri) {
    const roles = await ruoliDi(c.uid);
    if (roles.length === 0 || !bloccatoDallaListaRimossa(roles)) continue;
    const bersaglio = casoDivergente?.attore.userId;
    if (!bersaglio || bersaglio === c.uid) continue;
    casoSelfOnly = { attore: { userId: c.uid, tenantId: c.tenant, roles: roles as RoleCode[] }, email: c.email, bersaglio };
    break;
  }
});

describe("Z-203 — l'accesso al peer lo decide il resolver, non una lista di ruoli nel modulo", () => {
  it("il caso divergente esiste sul dato reale ed e' quello giusto", () => {
    expect(casoDivergente, "nessun responsabile di OU bloccato dalla lista rimossa e con riporti").not.toBeNull();
    // il predicato del BUG, non quello del modello: e' cio' che rende il caso probante
    expect(bloccatoDallaListaRimossa(casoDivergente!.attore.roles)).toBe(true);
    expect(casoDivergente!.bersaglio).not.toEqual(casoDivergente!.attore.userId);
  });

  it("il resolver gli concede il riporto: managerialita' per DATO, non per ruolo", async () => {
    const a = casoDivergente!.attore;
    await expect(canReadOrgTarget(pool, a, casoDivergente!.bersaglio, a.tenantId)).resolves.toBe(true);
  });

  // Copre TUTTI E TRE i metodi: reintrodurre il fast-path in uno qualsiasi rende rosso questo test.
  it.each(METODI.map((m) => [m.nome, m.fn] as const))(
    "%s concorda col resolver sul riporto (prima: 404)",
    async (_nome, fn) => {
      const a = casoDivergente!.attore;
      await expect(fn(a, casoDivergente!.bersaglio, { limit: 5 })).resolves.toBeDefined();
    },
  );

  it.each(METODI.map((m) => [m.nome, m.fn] as const))(
    "%s resta chiuso per un attore senza managerialita' (404 sul peer, 200 su se stesso)",
    async (_nome, fn) => {
      expect(casoSelfOnly, "nessun attore self-only trovato").not.toBeNull();
      const a = casoSelfOnly!.attore;
      await expect(fn(a, casoSelfOnly!.bersaglio, { limit: 5 })).rejects.toBeInstanceOf(NotFoundError);
      await expect(fn(a, a.userId, { limit: 5 })).resolves.toBeDefined();
    },
  );

  // L'invariante vero, e falsificabile: service e resolver devono dare lo STESSO esito. Se un modulo
  // reintroduce una scala di ruoli locale, i due divergono e questo diventa rosso.
  it("per ogni attore campionato, l'esito del service coincide con la decisione del resolver", async () => {
    const casi = [casoDivergente!, casoSelfOnly!].filter(Boolean);
    expect(casi.length).toBeGreaterThan(0);
    for (const c of casi) {
      for (const bersaglio of [c.bersaglio, c.attore.userId]) {
        const concesso = await canReadOrgTarget(pool, c.attore, bersaglio, c.attore.tenantId);
        for (const m of METODI) {
          const esito = await m.fn(c.attore, bersaglio, { limit: 5 }).then(() => true).catch(() => false);
          expect(esito, `${m.nome}: ${c.email} → ${bersaglio} (resolver=${concesso})`).toBe(concesso);
        }
      }
    }
  });
});
