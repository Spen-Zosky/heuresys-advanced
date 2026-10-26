/**
 * apps/api/test/process-participation-position.integration.test.ts
 *
 * ADR-0044 passo 3a — la partecipazione ai processi segue il POSTO, non la persona.
 *
 * Il caso che l'ADR mette come prova («come si verifica che sia fatto», punto 2): una
 * persona cambia posto; senza nessuna scrittura sulla tabella delle partecipazioni, non
 * compare più fra i partecipanti dei processi della vecchia unità e compare in quelli
 * della nuova. Con le letture sulla persona (prima del passo 3a) questo test è rosso:
 * la riga resta attaccata a chi c'era quando fu scritta.
 *
 * Il cambio di posto si fa come lo fa il dato: l'assegnazione vecchia finisce IERI per
 * data (resta ACTIVE, come una chiusura programmata che nessun lavoro ha ancora girato),
 * la nuova comincia OGGI. È la data di fine che deve bastare a togliere il posto vecchio:
 * per questo la mutazione «frammento senza la data di fine» rende rosso il test.
 *
 * Nessuna posizione attiva di RTL Bank è vacante (misurato il 2026-10-26), quindi la
 * persona va sul posto di un'altra che, lo stesso giorno, esce. Tutto vive nella
 * transazione del file (D-52).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { pool } from "../src/db/client.js";
import { isInFunctionalScope } from "../src/lib/scope/functional.js";
import { listMyProcessParticipations } from "../src/modules/me/repository.js";

interface Occupante {
  user_id: string;
  assignment_id: string;
  position_id: string;
  unit_id: string;
  tenant_id: string;
}

/** Chi occupa oggi un solo posto attivo, da prima di oggi (così la fine «ieri» è valida). */
const OCCUPANTI = `
  SELECT a.user_position_assignment_user_id      AS user_id,
         a.user_position_assignment_id           AS assignment_id,
         a.user_position_assignment_position_id  AS position_id,
         p.position_organization_unit_id         AS unit_id,
         a.user_position_assignment_tenant_id    AS tenant_id
    FROM sys.sys_user_position_assignments a
    JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
    JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
   WHERE a.user_position_assignment_status = 'ACTIVE'
     AND a.user_position_assignment_start_date < current_date
     AND a.user_position_assignment_end_date IS NULL
     AND p.position_is_active
     AND u.user_status = 'ACTIVE'
     AND (SELECT count(*) FROM sys.sys_user_position_assignments a2
           WHERE a2.user_position_assignment_user_id = a.user_position_assignment_user_id
             AND a2.user_position_assignment_status = 'ACTIVE') = 1
     AND (SELECT count(*) FROM sys.sys_user_position_assignments a3
           WHERE a3.user_position_assignment_position_id = a.user_position_assignment_position_id
             AND a3.user_position_assignment_status = 'ACTIVE') = 1
     -- un'unita' che ha almeno un processo
     AND EXISTS (SELECT 1 FROM sys.sys_organization_unit_processes oup
                  WHERE oup.org_unit_process_org_unit_id = p.position_organization_unit_id)
   ORDER BY a.user_position_assignment_user_id`;

let chiParte: Occupante; // X: lascia il posto P1 (unita' A) e va su P2
let chiEsce: Occupante; // Y: occupava P2 (unita' B) ed esce lo stesso giorno
let owner: { user_id: string; position_id: string } | undefined;
let processoVecchio: string; // un processo di A, con la partecipazione del posto P1
let processoNuovo: string; // un processo di B, con la partecipazione del posto P2

/**
 * Un processo dell'unita' a cui il posto partecipa (riga ATTIVA gia' presente), oppure, se
 * non ce n'e', uno su cui la riga del posto si puo' scrivere senza urtare l'indice unico
 * (processo, posto). Ritorna anche se la riga va scritta.
 */
async function processoDelPosto(
  unitId: string,
  positionId: string,
): Promise<{ id: string; daScrivere: boolean }> {
  const r = await pool.query<{ id: string; ha_riga: boolean }>(
    `SELECT oup.organization_unit_process_id AS id,
            EXISTS (SELECT 1 FROM sys.sys_process_participants pp
                     WHERE pp.process_participant_org_unit_process_id = oup.organization_unit_process_id
                       AND pp.process_participant_position_id = $2
                       AND pp.process_participant_is_active) AS ha_riga
       FROM sys.sys_organization_unit_processes oup
      WHERE oup.org_unit_process_org_unit_id = $1
        AND (EXISTS (SELECT 1 FROM sys.sys_process_participants pp
                      WHERE pp.process_participant_org_unit_process_id = oup.organization_unit_process_id
                        AND pp.process_participant_position_id = $2
                        AND pp.process_participant_is_active)
             OR NOT EXISTS (SELECT 1 FROM sys.sys_process_participants pp
                             WHERE pp.process_participant_org_unit_process_id = oup.organization_unit_process_id
                               AND pp.process_participant_position_id = $2))
      ORDER BY 2 DESC, 1
      LIMIT 1`,
    [unitId, positionId],
  );
  const row = r.rows[0];
  if (!row) throw new Error(`nessun processo dell'unita' ${unitId} utilizzabile per il posto ${positionId}: fixture impossibile`);
  return { id: row.id, daScrivere: !row.ha_riga };
}

/** Dal passo 3b una partecipazione si scrive col solo posto: la persona e' chi lo occupa. */
async function scriviRiga(tenantId: string, processId: string, o: { position_id: string }, role: string) {
  await pool.query(
    `INSERT INTO sys.sys_process_participants
       (process_participant_tenant_id, process_participant_org_unit_process_id,
        process_participant_position_id, process_participant_role)
     VALUES ($1, $2, $3, $4)`,
    [tenantId, processId, o.position_id, role],
  );
}

async function processiDi(userId: string, tenantId: string): Promise<string[]> {
  const { items } = await listMyProcessParticipations(pool, userId, tenantId);
  return items.filter((i) => i.isActive).map((i) => i.organizationUnitProcessId);
}

describe("ADR-0044 passo 3a — la partecipazione segue il posto", () => {
  beforeAll(async () => {
    const occ = (await pool.query<Occupante>(OCCUPANTI)).rows;
    const x = occ[0];
    const y = occ.find((o) => x && o.tenant_id === x.tenant_id && o.unit_id !== x.unit_id);
    if (!x || !y) throw new Error("servono due occupanti unici di posti unici in due unita' diverse: fixture impossibile");
    chiParte = x;
    chiEsce = y;
    const vecchio = await processoDelPosto(x.unit_id, x.position_id);
    const nuovo = await processoDelPosto(y.unit_id, y.position_id);
    processoVecchio = vecchio.id;
    processoNuovo = nuovo.id;
    // Le partecipazioni si scrivono UNA volta, prima del cambio di posto, solo se mancano.
    if (vecchio.daScrivere) await scriviRiga(x.tenant_id, processoVecchio, x, "CONTRIBUTOR");
    if (nuovo.daScrivere) await scriviRiga(y.tenant_id, processoNuovo, y, "CONTRIBUTOR");

    // Il process owner del processo nuovo: un terzo, in una terza unita', che oggi non
    // partecipa a quel processo e non ha gia' X nel suo perimetro funzionale (altrimenti
    // il «dopo» sarebbe vero anche prima, e il test non misurerebbe niente).
    for (const c of occ) {
      if (c.tenant_id !== x.tenant_id || c.unit_id === x.unit_id || c.unit_id === y.unit_id) continue;
      const libero = await pool.query(
        `SELECT 1 FROM sys.sys_process_participants
          WHERE process_participant_org_unit_process_id = $1
            AND process_participant_position_id = $2`,
        [processoNuovo, c.position_id],
      );
      if (libero.rowCount) continue;
      if (await isInFunctionalScope(pool, c.user_id, x.user_id)) continue;
      owner = { user_id: c.user_id, position_id: c.position_id };
      break;
    }
    if (!owner) throw new Error("nessun terzo occupante utilizzabile come owner: fixture impossibile");
    await scriviRiga(x.tenant_id, processoNuovo, owner, "OWNER");
  });

  it("prima del cambio: la persona partecipa dal posto che occupa", async () => {
    const mie = await processiDi(chiParte.user_id, chiParte.tenant_id);
    expect(mie).toContain(processoVecchio);
    expect(mie).not.toContain(processoNuovo);
    expect(await isInFunctionalScope(pool, owner!.user_id, chiParte.user_id)).toBe(false);
  });

  it("dopo il cambio di posto, senza toccare le partecipazioni, segue il posto nuovo", async () => {
    const impronta = async () =>
      (await pool.query<{ h: string }>(
        `SELECT md5(string_agg(to_jsonb(t)::text, '|' ORDER BY t.process_participant_id)) AS h
           FROM sys.sys_process_participants t`,
      )).rows[0]?.h;
    const prima = await impronta();

    // X e Y finiscono IERI per data; X comincia OGGI sul posto di Y.
    await pool.query(
      `UPDATE sys.sys_user_position_assignments
          SET user_position_assignment_end_date = current_date - 1
        WHERE user_position_assignment_id = ANY($1::uuid[])`,
      [[chiParte.assignment_id, chiEsce.assignment_id]],
    );
    await pool.query(
      `INSERT INTO sys.sys_user_position_assignments
         (user_position_assignment_tenant_id, user_position_assignment_user_id,
          user_position_assignment_position_id, user_position_assignment_kind,
          user_position_assignment_start_date, user_position_assignment_status)
       VALUES ($1, $2, $3, 'ACTING', current_date, 'ACTIVE')`,
      [chiParte.tenant_id, chiParte.user_id, chiEsce.position_id],
    );

    const mie = await processiDi(chiParte.user_id, chiParte.tenant_id);
    expect(mie, "il processo dell'unita' nuova").toContain(processoNuovo);
    expect(mie, "il processo dell'unita' vecchia").not.toContain(processoVecchio);
    // chi esce non partecipa piu' da nessun posto
    expect(await processiDi(chiEsce.user_id, chiEsce.tenant_id)).not.toContain(processoNuovo);
    // l'owner del processo nuovo vede ora le attivita' di chi e' arrivato
    expect(await isInFunctionalScope(pool, owner!.user_id, chiParte.user_id)).toBe(true);
    // e la tabella delle partecipazioni non e' stata toccata
    expect(await impronta()).toBe(prima);
  });
});
