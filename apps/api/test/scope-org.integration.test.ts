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
 *
 * ⚠ [#99 F3, 2026-08-14] QUEL RAGIONAMENTO SI E' INVERTITO, e va detto invece di
 * lasciarlo invecchiare. Il resolver ora percorre l'albero delle UNITA' (ADR-0036), che
 * e' la stessa fonte da cui questi attori si derivano: le sei asserzioni qui sotto sono
 * diventate CIRCOLARI — chiedono al resolver di concordare con se' stesso, e resterebbero
 * verdi anche se il perimetro fosse sbagliato. Restano perche' pinnano comunque proprieta'
 * vere (transitivita', self, isolamento fra rami), ma non sono piu' la prova di F3.
 *
 * La prova di F3 e' il blocco in fondo al file: si INIETTA una divergenza fra i due
 * alberi dentro la transazione del file e si pretende che il perimetro segua le unita'.
 * Serviva perche' sui dati reali i due alberi COINCIDONO — misurato il 2026-08-14: 161
 * attori su 161 identici, 649 accessi prima e dopo, 0 guadagnati, 0 persi. Senza fabbricare
 * una differenza non esiste alcun dato capace di distinguere un albero dall'altro.
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

  /* ==================================================================================
   * #99 F3 — LA PROVA CHE PUO' FALLIRE.
   *
   * I due alberi oggi coincidono, quindi nessun dato reale distingue l'uno dall'altro.
   * Qui la divergenza si FABBRICA, dentro la transazione del file (rollbackata a fine
   * file da tx-isolation: niente resta sul database).
   * ================================================================================== */

  it("F3 — il perimetro segue le UNITA': spostare il riporto della POSIZIONE non lo muove", async () => {
    const prima = await orgSubtreeUserIds(pool, paolo);
    expect(prima).toContain(tommaso);

    // la posizione del sottoposto viene appesa a un capo di un ALTRO ramo, ma la sua
    // unità organizzativa non si tocca: per l'organigramma non è successo niente.
    const pos = await pool.query<{ pid: string; old: string | null }>(
      `SELECT p.position_id AS pid, p.position_reports_to_position_id AS old
         FROM sys.sys_user_position_assignments a
         JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
        WHERE a.user_position_assignment_user_id = $1
          AND a.user_position_assignment_status = 'ACTIVE'
        LIMIT 1`,
      [tommaso],
    );
    const posizioneDelSottoposto = pos.rows[0]?.pid;
    expect(posizioneDelSottoposto).toBeDefined();

    const altrove = await pool.query<{ pid: string }>(
      `SELECT p.position_id AS pid
         FROM sys.sys_user_position_assignments a
         JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
        WHERE a.user_position_assignment_user_id = $1
          AND a.user_position_assignment_status = 'ACTIVE'
        LIMIT 1`,
      [antonio],
    );
    expect(altrove.rows[0]?.pid).toBeDefined();

    await pool.query(
      `UPDATE sys.sys_positions SET position_reports_to_position_id = $2 WHERE position_id = $1`,
      [posizioneDelSottoposto, altrove.rows[0]!.pid],
    );

    const dopo = await orgSubtreeUserIds(pool, paolo);
    // se il resolver percorresse ancora le posizioni, il sottoposto sarebbe appena uscito
    expect(dopo).toContain(tommaso);
    expect(await isInOrgSubtree(pool, paolo, tommaso)).toBe(true);
  });

  it("F3 — e si muove quando cambia l'UNITA' della persona: è l'organigramma a comandare", async () => {
    expect(await isInOrgSubtree(pool, paolo, tommaso)).toBe(true);

    // Non si sposta l'unità del capo — il sottoposto può stare nell'unità che il capo
    // dirige DIRETTAMENTE, e in quel caso spostarla non lo toglierebbe dal perimetro
    // (il capo la dirigerebbe comunque, ovunque sia appesa). Si sposta la PERSONA:
    // la sua posizione viene incardinata nell'unità dell'estraneo, che per costruzione
    // sta fuori dal ramo del capo. L'organigramma ora dice che non è più sotto di lui.
    const unitaEstranea = await pool.query<{ ou: string }>(
      `SELECT p.position_organization_unit_id AS ou
         FROM sys.sys_user_position_assignments a
         JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
        WHERE a.user_position_assignment_user_id = $1
          AND a.user_position_assignment_status = 'ACTIVE'
          AND p.position_organization_unit_id IS NOT NULL
        LIMIT 1`,
      [antonio],
    );
    expect(unitaEstranea.rows[0]?.ou).toBeDefined();

    const { rowCount } = await pool.query(
      `UPDATE sys.sys_positions
          SET position_organization_unit_id = $2
        WHERE position_id IN (
          SELECT a.user_position_assignment_position_id
            FROM sys.sys_user_position_assignments a
           WHERE a.user_position_assignment_user_id = $1
             AND a.user_position_assignment_status = 'ACTIVE')`,
      [tommaso, unitaEstranea.rows[0]!.ou],
    );
    expect(rowCount).toBeGreaterThan(0);

    expect(await isInOrgSubtree(pool, paolo, tommaso)).toBe(false);
    expect(await orgSubtreeUserIds(pool, paolo)).not.toContain(tommaso);
  });
});
