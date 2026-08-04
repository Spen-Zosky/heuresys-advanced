/**
 * apps/api/test/scope-org.integration.test.ts — F0 of ADR-0027 (organizational axis).
 *
 * Verifies the recursive org-chart helpers against the REAL RTL hierarchy (no mocks, no
 * hardcoded counts — only invariants derived from real reporting edges).
 *
 * [S1043] I TRE PROTAGONISTI NON SONO PIU' NOMINATI. La stesura precedente fissava
 * `paolo.caputo` come capo, `tommaso.fiore` come suo sottoposto e `antonio.parisi`
 * come estraneo. La ricostruzione dell'organigramma ha INVERTITO due di quei ruoli:
 * tommaso oggi dirige la Filiale di Varese (ramo Retail) e non e' piu' sotto paolo,
 * mentre antonio e' Analista Crediti nell'Ufficio Crediti Retail — che sta DENTRO la
 * Divisione Crediti che paolo dirige. Nessuno dei due era un difetto: erano ruoli
 * scritti a mano che l'azienda ha cambiato.
 *
 * Ora il sottoposto e l'estraneo si DERIVANO dall'albero delle UNITA' organizzative,
 * che e' una struttura INDIPENDENTE da quella che il resolver percorre (l'albero
 * delle posizioni). Il test non e' tautologico proprio per questo: non chiede al
 * resolver di confermare se stesso, gli chiede di concordare con l'organigramma. E'
 * un confronto che puo' fallire — e falliva, prima che la mig 000258 riconnettesse
 * l'albero delle posizioni.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { pool } from "../src/db/client.js";
import { orgSubtreeUserIds, orgAncestorUserIds, isInOrgSubtree } from "../src/lib/scope/org.js";

async function uid(email: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `SELECT user_id AS id FROM sys.sys_users WHERE user_email = $1`,
    [email],
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error(`fixture user not found: ${email}`);
  return id;
}

/** Una persona che, SECONDO L'ALBERO DELLE UNITA', lavora dentro l'unita diretta da
 *  `manager` (o in una sua discendente) — e non e' il manager stesso. Derivata dal
 *  vivo: e' l'atteso indipendente contro cui si misura il resolver. */
async function unSottopostoOrganizzativo(manager: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `WITH RECURSIVE sue(unita) AS (
       SELECT organization_unit_id FROM sys.sys_organization_units
        WHERE organization_unit_manager_user_id = $1 AND organization_unit_is_active
       UNION
       SELECT o.organization_unit_id FROM sys.sys_organization_units o
         JOIN sue ON o.organization_unit_parent_id = sue.unita
        WHERE o.organization_unit_is_active)
     SELECT a.user_position_assignment_user_id AS id
       FROM sue
       JOIN sys.sys_positions p ON p.position_organization_unit_id = sue.unita
       JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_position_id = p.position_id
        AND a.user_position_assignment_status = 'ACTIVE'
      WHERE a.user_position_assignment_user_id <> $1
      ORDER BY a.user_position_assignment_user_id LIMIT 1`,
    [manager],
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error("nessun sottoposto organizzativo: verifica cieca");
  return id;
}

/** Una persona che, secondo l'albero delle UNITA', NON lavora sotto `manager`. */
async function unEstraneoOrganizzativo(manager: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `WITH RECURSIVE sue(unita) AS (
       SELECT organization_unit_id FROM sys.sys_organization_units
        WHERE organization_unit_manager_user_id = $1 AND organization_unit_is_active
       UNION
       SELECT o.organization_unit_id FROM sys.sys_organization_units o
         JOIN sue ON o.organization_unit_parent_id = sue.unita
        WHERE o.organization_unit_is_active)
     SELECT a.user_position_assignment_user_id AS id
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
      WHERE a.user_position_assignment_status = 'ACTIVE'
        AND a.user_position_assignment_user_id <> $1
        AND p.position_organization_unit_id NOT IN (SELECT unita FROM sue)
      ORDER BY a.user_position_assignment_user_id LIMIT 1`,
    [manager],
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error("nessun estraneo organizzativo: verifica cieca");
  return id;
}

describe("scope/org — organizational axis (F0, ADR-0027)", () => {
  let federica: string;
  let paolo: string;
  let tommaso: string;
  let antonio: string;

  beforeAll(async () => {
    [federica, paolo] = await Promise.all([
      uid("federica.marchetti@rtl-bank.org"),
      uid("paolo.caputo@rtl-bank.org"),
    ]);
    // `tommaso` = un sottoposto vero, `antonio` = un estraneo vero. I nomi delle
    // variabili restano per non riscrivere ogni asserzione, ma le persone non sono
    // piu' scelte a mano: le sceglie l'organigramma di oggi.
    tommaso = await unSottopostoOrganizzativo(paolo);
    antonio = await unEstraneoOrganizzativo(paolo);
    expect(tommaso).not.toBe(antonio);
  });

  it("sub-tree includes self + a direct report, excludes an outsider", async () => {
    const sub = await orgSubtreeUserIds(pool, paolo);
    expect(sub).toContain(paolo); // self always present
    expect(sub).toContain(tommaso); // real direct report
    expect(sub).not.toContain(antonio); // different org branch
  });

  it("sub-tree is TRANSITIVE — federica → paolo → tommaso (2 hops)", async () => {
    const sub = await orgSubtreeUserIds(pool, federica);
    expect(sub).toContain(paolo); // 1 hop
    expect(sub).toContain(tommaso); // 2 hops — the old one-hop walk would MISS this
  });

  it("ancestors are transitive — tommaso's managers include paolo AND federica, not self", async () => {
    const anc = await orgAncestorUserIds(pool, tommaso);
    expect(anc).toContain(paolo); // direct manager
    expect(anc).toContain(federica); // 2-hop manager
    expect(anc).not.toContain(tommaso); // ancestors exclude self
  });

  it("peer isolation — an outsider's ancestors exclude paolo (different tree)", async () => {
    const anc = await orgAncestorUserIds(pool, antonio);
    expect(anc).not.toContain(paolo);
  });

  it("isInOrgSubtree — report yes, outsider no, self yes (the cardinal-rule predicate)", async () => {
    expect(await isInOrgSubtree(pool, paolo, tommaso)).toBe(true);
    expect(await isInOrgSubtree(pool, paolo, antonio)).toBe(false);
    expect(await isInOrgSubtree(pool, paolo, paolo)).toBe(true);
  });

  it("integrity — no position reports to itself (recursion cycle-guard precondition)", async () => {
    const r = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM sys.sys_positions WHERE position_reports_to_position_id = position_id`,
    );
    expect(Number(r.rows[0]?.n ?? 0)).toBe(0);
  });
});
