/**
 * AC-8 — l'applicazione delle decisioni ai dati del tenant. Scrive nei dati di un tenant:
 * gira SOLO su un database di collaudo (il nome dice «prova» o «zz_»), mai sull'originale.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, pool } from "../src/db/client.js";
import { loadRolePermissionCache } from "../src/modules/auth/cache-loader.js";
import type { ActorContext } from "../src/lib/actor.js";
import type { RoleCode } from "../src/config/constants.js";
import { tenantConsolidationService as svc } from "../src/modules/tenant-consolidation/service.js";

const NOME_DB = process.env.POSTGRES_DB ?? "";
const collaudo = /prova|zz_/.test(NOME_DB);

let direttore: ActorContext;
let sessioneId = "";
let variantVersionId = "";

async function creaProposta(outcome: string, pk: string[], tk: string[]): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_tenant_consolidation_proposals
       (tenant_consolidation_proposal_consolidation_id, tenant_consolidation_proposal_group,
        tenant_consolidation_proposal_prototype_keys, tenant_consolidation_proposal_tenant_keys,
        tenant_consolidation_proposal_outcome, tenant_consolidation_proposal_method,
        tenant_consolidation_proposal_confidence, tenant_consolidation_proposal_reason, tenant_consolidation_proposal_round)
     VALUES ($1, 'SKILLS', $2::text[], $3::text[], $4, 'SEMANTICA', 80, 'prova AC-8', 9)
     RETURNING tenant_consolidation_proposal_id AS id`,
    [sessioneId, pk, tk, outcome],
  );
  return r.rows[0]!.id;
}

const competenza = async (id: string) =>
  (await pool.query<{ skill_name: string; skill_code: string }>(`SELECT skill_name, skill_code FROM sys.sys_skills WHERE skill_id = $1`, [id])).rows[0]!;

describe.skipIf(!collaudo)("l'applicazione delle decisioni (AC-8)", () => {
  let tenantSkillId = "";
  let nomePrima = "";
  let codicePrima = "";
  let protoCode = "";
  let protoName = "";
  let lacunaCode = "";

  beforeAll(async () => {
    await loadRolePermissionCache();
    const d = await pool.query<{ user_id: string; user_tenant_id: string }>(
      `SELECT u.user_id, u.user_tenant_id FROM sys.sys_users u
         JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
         JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id AND r.auth_role_code = 'HRMS_MANAGER'
        WHERE u.user_status = 'ACTIVE' AND u.user_tenant_id IS NOT NULL ORDER BY u.user_id LIMIT 1`,
    );
    const dir = d.rows[0]!;
    const ruoli = await pool.query<{ c: string }>(
      `SELECT ro.auth_role_code c FROM sys.sys_user_auth_roles ur JOIN sys.sys_auth_roles ro ON ro.auth_role_id = ur.user_auth_role_role_id
        WHERE ur.user_auth_role_user_id = $1 AND ur.user_auth_role_revoked_at IS NULL`, [dir.user_id]);
    direttore = { userId: dir.user_id, tenantId: dir.user_tenant_id, roles: ruoli.rows.map((x) => x.c) as RoleCode[] };

    const s = await pool.query<{ id: string; v: string }>(
      `SELECT tenant_consolidation_id id, tenant_consolidation_variant_version_id v FROM sys.sys_tenant_consolidations
        WHERE tenant_consolidation_tenant_id = $1 AND tenant_consolidation_status IN ('GIRI','IN_CONFERMA') LIMIT 1`, [direttore.tenantId]);
    sessioneId = s.rows[0]!.id;
    variantVersionId = s.rows[0]!.v;

    // Una competenza del tenant e due del prototipo: una per l'abbinamento, una assente dal tenant (lacuna).
    const t = await pool.query<{ skill_id: string; skill_name: string; skill_code: string }>(
      `SELECT skill_id, skill_name, skill_code FROM sys.sys_skills WHERE skill_tenant_id = $1 ORDER BY skill_code LIMIT 1`, [direttore.tenantId]);
    tenantSkillId = t.rows[0]!.skill_id; nomePrima = t.rows[0]!.skill_name; codicePrima = t.rows[0]!.skill_code;
    const p = await pool.query<{ code: string; name: string }>(
      `SELECT blueprint_content_skill_code code, blueprint_content_skill_name name FROM sys.sys_blueprint_content_skills sk
        WHERE blueprint_content_skill_version_id = $1
          AND NOT EXISTS (SELECT 1 FROM sys.sys_skills x WHERE x.skill_tenant_id = $2 AND (x.skill_code = sk.blueprint_content_skill_code
                OR lower(trim(x.skill_name)) = lower(trim(sk.blueprint_content_skill_name))))
        ORDER BY 1 LIMIT 2`, [variantVersionId, direttore.tenantId]);
    expect(p.rows.length).toBe(2);
    protoCode = p.rows[0]!.code; protoName = p.rows[0]!.name; lacunaCode = p.rows[1]!.code;
  });

  afterAll(async () => { await closePool(); });

  it("nome del prototipo: cambia nome e codice; la stessa riconferma non cambia niente; la forma del tenant rimette tutto com'era", async () => {
    const id = await creaProposta("CORRISPONDENZA", [protoCode], [tenantSkillId]);

    const a = await svc.decide(direttore, id, { decision: "CONFERMATA", form: "NOME_PROTOTIPO" });
    expect(a.application.changed.map((c) => c.column).sort()).toEqual(["skill_code", "skill_name"]);
    expect(await competenza(tenantSkillId)).toEqual({ skill_name: protoName, skill_code: protoCode });

    const b = await svc.decide(direttore, id, { decision: "CONFERMATA", form: "NOME_PROTOTIPO" });
    expect(b.application.changed).toEqual([]);
    expect(b.application.reverted).toBe(0); // niente da ritirare: lo stato voluto è già quello
    expect(await competenza(tenantSkillId)).toEqual({ skill_name: protoName, skill_code: protoCode });

    const c = await svc.decide(direttore, id, { decision: "CONFERMATA", form: "FORMA_TENANT" });
    expect(c.application.changed).toEqual([]);
    expect(await competenza(tenantSkillId)).toEqual({ skill_name: nomePrima, skill_code: codicePrima });

    const l = await pool.query(`SELECT tenant_consolidation_link_adr48_state s FROM sys.sys_tenant_consolidation_links WHERE tenant_consolidation_link_proposal_id = $1`, [id]);
    expect(l.rows).toEqual([{ s: "CONSERVATA" }]);
  });

  it("un valore cambiato da altri dopo la decisione non viene rimesso com'era", async () => {
    const id = await creaProposta("CORRISPONDENZA", [protoCode], [tenantSkillId]);
    await svc.decide(direttore, id, { decision: "CONFERMATA", form: "NOME_PROTOTIPO" });
    await pool.query(`UPDATE sys.sys_skills SET skill_name = skill_name || ' (rivisto)' WHERE skill_id = $1`, [tenantSkillId]);
    const r = await svc.decide(direttore, id, { decision: "CONFERMATA", form: "FORMA_TENANT" });
    expect(r.application.skipped.join(" ")).toMatch(/skill_name/);
    expect((await competenza(tenantSkillId)).skill_name).toBe(`${protoName} (rivisto)`);
    expect((await competenza(tenantSkillId)).skill_code).toBe(codicePrima);
    await pool.query(`UPDATE sys.sys_skills SET skill_name = $2 WHERE skill_id = $1`, [tenantSkillId, nomePrima]);
  });

  it("lacuna adottata: la voce si crea una volta sola, anche riadottando", async () => {
    const id = await creaProposta("LACUNA", [lacunaCode], []);
    const conta = async () => (await pool.query<{ n: number }>(
      `SELECT count(*)::int n FROM sys.sys_skills WHERE skill_tenant_id = $1 AND skill_code = $2`, [direttore.tenantId, lacunaCode])).rows[0]!.n;
    expect(await conta()).toBe(0);
    const a = await svc.decide(direttore, id, { decision: "ADOTTATA" });
    expect(a.application.created.length).toBe(1);
    expect(await conta()).toBe(1);
    const b = await svc.decide(direttore, id, { decision: "ADOTTATA" });
    expect(b.application.created).toEqual([]);
    expect(await conta()).toBe(1);
  });

  it("non tocca persone né utenze", async () => {
    const prima = await pool.query<{ n: number }>(`SELECT (SELECT count(*) FROM sys.sys_users)::int + (SELECT count(*) FROM sys.sys_user_auth_roles)::int n`);
    const id = await creaProposta("CORRISPONDENZA", [protoCode], [tenantSkillId]);
    await svc.decide(direttore, id, { decision: "CONFERMATA", form: "NOME_PROTOTIPO" });
    await svc.decide(direttore, id, { decision: "RIFIUTATA" });
    const dopo = await pool.query<{ n: number }>(`SELECT (SELECT count(*) FROM sys.sys_users)::int + (SELECT count(*) FROM sys.sys_user_auth_roles)::int n`);
    expect(dopo.rows[0]!.n).toBe(prima.rows[0]!.n);
  });
});
