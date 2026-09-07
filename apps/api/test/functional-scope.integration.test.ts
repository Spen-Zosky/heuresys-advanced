/**
 * apps/api/test/functional-scope.integration.test.ts — #143 F3, primo passo.
 *
 * ⚠ PERCHE' QUESTO FILE ESISTE. `lib/scope/functional.ts` e' **codice morto**: misurato il
 * 2026-09-07, `functionalScopeUserIds`, `isFunctionalLeader` e `isInFunctionalScope` non
 * hanno **nessun consumatore** fuori dal file che le definisce. Il piano di `#143` lo dice
 * senza giri di parole: *«prima di costruirci sopra, verificare che facciano cio' che
 * dicono: nessuno le ha mai esercitate, quindi non c'e' prova che funzionino»*.
 *
 * F3 dara' loro consumatori reali. Questo file viene **prima**, ed e' il passo che rende
 * onesto tutto il resto: costruire l'asse funzionale su tre funzioni mai eseguite
 * significherebbe scoprirne i difetti attraverso il comportamento di una API, cioe' nel
 * posto piu' caro possibile.
 *
 * ⭐ L'ASSERZIONE CHE CONTA E' LA SECONDA, non la prima. «Il capo vede i suoi» lo
 * soddisfarebbe anche un'implementazione che restituisce TUTTI: e' «il capo NON vede chi
 * non e' suo» a poter fallire, ed e' quella che pesa. Lo stesso vale per
 * `isFunctionalLeader`: senza il caso negativo, una funzione che risponde sempre `true`
 * passerebbe.
 *
 * Gli attori non sono scritti a mano: si derivano dal dato di oggi con gli helper di
 * `org-actors`, che si FERMANO dicendo cosa manca se il dataset non contiene piu' il caso
 * («verifica cieca»). Un test che cabla un'email invecchia col dataset e un giorno
 * fallisce senza che nulla sia rotto.
 *
 * Nessuna scrittura: le tre funzioni sono di sola lettura, e i dati esercitati sono quelli
 * di produzione (26 squadre attive, 174 membri attivi, misurati lo stesso giorno).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { pool } from "../src/db/client.js";
import {
  functionalScopeUserIds,
  isFunctionalLeader,
  isInFunctionalScope,
} from "../src/lib/scope/functional.js";
import { unMembroDiSquadra, unFuoriSquadra } from "./helpers/org-actors.js";

interface Scena {
  capo: string;
  membro: string;
  estraneo: string;
}

/**
 * Il capo di squadra si sceglie dal dato: quello che guida la squadra con piu' membri
 * attivi, cosi' il caso e' il piu' ricco disponibile invece del primo che capita.
 */
async function scena(): Promise<Scena> {
  const r = await pool.query<{ lead: string }>(
    `SELECT t.team_lead_user_id AS lead
       FROM sys.sys_teams t
       JOIN sys.sys_team_members m
         ON m.team_member_team_id = t.team_id AND m.team_member_is_active
      WHERE t.team_is_active AND t.team_lead_user_id IS NOT NULL
      GROUP BY t.team_lead_user_id
      ORDER BY count(*) DESC
      LIMIT 1`,
  );
  const capo = r.rows[0]?.lead;
  if (!capo) throw new Error("nessuna squadra attiva con un capo: verifica cieca, non verde");
  const membro = await unMembroDiSquadra(pool, capo);
  const estraneo = await unFuoriSquadra(pool, capo);
  return { capo, membro: membro.userId, estraneo: estraneo.userId };
}

describe("#143 F3 — l'asse funzionale fa cio' che dichiara", () => {
  let s: Scena;

  beforeAll(async () => {
    s = await scena();
  });

  it("il capo di squadra ha nel proprio perimetro i membri della squadra che guida", async () => {
    const ids = await functionalScopeUserIds(pool, s.capo);
    expect(ids).toContain(s.membro);
  });

  it("⭐ e NON ha nel perimetro chi non e' in nessuna sua squadra", async () => {
    // L'asserzione che puo' fallire: senza questa, una funzione che restituisse l'intera
    // popolazione passerebbe comunque il caso positivo qui sopra.
    const ids = await functionalScopeUserIds(pool, s.capo);
    expect(ids).not.toContain(s.estraneo);
  });

  it("il perimetro comprende SEMPRE se stessi, anche per chi non guida niente (I17)", async () => {
    const ids = await functionalScopeUserIds(pool, s.capo);
    expect(ids).toContain(s.capo);

    // e vale anche per chi non e' capo di nulla: il pavimento self non dipende dai mandati
    const soloSe = await functionalScopeUserIds(pool, s.estraneo);
    expect(soloSe).toContain(s.estraneo);
  });

  it("isInFunctionalScope concorda con l'elenco, nei due versi", async () => {
    await expect(isInFunctionalScope(pool, s.capo, s.membro)).resolves.toBe(true);
    await expect(isInFunctionalScope(pool, s.capo, s.estraneo)).resolves.toBe(false);
    // se stessi: vero senza nemmeno interrogare il database (scorciatoia dichiarata nel codice)
    await expect(isInFunctionalScope(pool, s.estraneo, s.estraneo)).resolves.toBe(true);
  });

  it("isFunctionalLeader distingue chi guida da chi non guida", async () => {
    await expect(isFunctionalLeader(pool, s.capo)).resolves.toBe(true);
    // Il caso negativo e' obbligatorio: senza, una funzione che risponde sempre `true`
    // passerebbe. Si sceglie una persona che non guida NESSUNA squadra e non possiede
    // NESSUN processo — se non ne esiste una, il test lo dice invece di fingere.
    const r = await pool.query<{ user_id: string }>(
      `SELECT u.user_id
         FROM sys.sys_users u
        WHERE u.user_status = 'ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM sys.sys_teams t
                           WHERE t.team_is_active AND t.team_lead_user_id = u.user_id)
          AND NOT EXISTS (SELECT 1 FROM sys.sys_team_members m
                           WHERE m.team_member_user_id = u.user_id
                             AND m.team_member_role = 'LEAD' AND m.team_member_is_active)
          AND NOT EXISTS (SELECT 1 FROM sys.sys_process_participants p
                           WHERE p.process_participant_user_id = u.user_id
                             AND p.process_participant_role = 'OWNER'
                             AND p.process_participant_is_active)
        ORDER BY u.user_email
        LIMIT 1`,
    );
    const nonCapo = r.rows[0]?.user_id;
    if (!nonCapo) throw new Error("nessuna persona senza mandati funzionali: verifica cieca");
    await expect(isFunctionalLeader(pool, nonCapo)).resolves.toBe(false);
  });

  it("⚠ le due fonti del «capo funzionale» danno lo stesso perimetro, o sono due verita'", async () => {
    // Il piano di #143 lo nomina come nodo aperto: la nozione ha DUE fonti —
    // `sys_teams.team_lead_user_id` oppure un membro con ruolo 'LEAD' — e F2 doveva
    // decidere quale sopravvive. Finche' convivono, chi le usa deve sapere se
    // concordano. Questo controllo lo MISURA invece di supporlo, e il suo esito e'
    // un'informazione per F3, non un divieto.
    const r = await pool.query<{ solo_lead_row: string }>(
      `SELECT DISTINCT m.team_member_user_id AS solo_lead_row
         FROM sys.sys_team_members m
         JOIN sys.sys_teams t ON t.team_id = m.team_member_team_id AND t.team_is_active
        WHERE m.team_member_role = 'LEAD' AND m.team_member_is_active
          AND (t.team_lead_user_id IS NULL OR t.team_lead_user_id <> m.team_member_user_id)`,
    );
    // Non si pretende zero: si pretende che, per chiunque sia capo per UNA delle due
    // fonti, `isFunctionalLeader` risponda `true`. Se una delle due fosse ignorata, qui
    // comparirebbe un `false` — ed e' il difetto che nessuno avrebbe visto.
    for (const riga of r.rows) {
      await expect(isFunctionalLeader(pool, riga.solo_lead_row)).resolves.toBe(true);
    }
  });
});
