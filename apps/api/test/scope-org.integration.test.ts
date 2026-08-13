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
import { unSottopostoOrganizzativo, unEstraneoOrganizzativo } from "./helpers/org-actors.js";
import { attoriDiScena } from "./helpers/attori-di-scena.js";
/**
 * I cinque ruoli di scena, derivati dal dato di oggi invece che scritti a mano (#147).
 * Non sono cinque persone: sono cinque CARATTERISTICHE, e ognuna e' verificata alla
 * risoluzione — se domani non esiste piu' un capo con sottoposti, questo file si ferma
 * dicendo cosa manca, invece di misurare un caso limite in silenzio.
 */
const ATTORI = await attoriDiScena();


async function uid(email: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `SELECT user_id AS id FROM sys.sys_users WHERE user_email = $1`,
    [email],
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error(`fixture user not found: ${email}`);
  return id;
}

describe("scope/org — organizational axis (F0, ADR-0027)", () => {
  let federica: string;
  let paolo: string;
  let tommaso: string;
  let antonio: string;

  beforeAll(async () => {
    [federica, paolo] = await Promise.all([
      uid(ATTORI.hr.email),
      uid(ATTORI.capo.email),
    ]);
    // `tommaso` = un sottoposto vero, `antonio` = un estraneo vero. I nomi delle
    // variabili restano per non riscrivere ogni asserzione, ma le persone non sono
    // piu' scelte a mano: le sceglie l'organigramma di oggi.
    tommaso = (await unSottopostoOrganizzativo(pool, paolo)).userId;
    antonio = (await unEstraneoOrganizzativo(pool, paolo)).userId;
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
