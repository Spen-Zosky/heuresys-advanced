/**
 * apps/api/src/modules/tenants/contracts.ts
 * Scheda «Contratti» del tenant: i contratti collettivi dei modelli che il tenant ha attivi, con livelli, minimi
 * e lacune (livelli senza minimo), e quante persone del tenant stanno su ciascun livello. Sola lettura.
 * Il contratto è quello del modello attivo, quindi coerente col tenant per costruzione (RTL: credito).
 */
import type { TenantContract, TenantContractsResponse } from "@heuresys/shared";
import { versioniAttiveDelTenant } from "../hierarchy-levels/repository.js";
import { livelloNormale } from "../tenant-consolidation/distanza.js";
import type { DbConnector } from "./repository.js";

interface RigaCcnl {
  code: string; name: string; scope: string | null; parties: string | null; effective: string | null;
}
interface RigaLivello {
  ccnl_code: string; code: string; name: string; category: string | null;
  minimo: string | null; note: string | null; duties: string | null;
}

export async function contrattiDelTenant(q: DbConnector, tenantId: string): Promise<TenantContractsResponse | null> {
  const t = await q.query<{ industry_code: string; industry_name: string | null }>(
    `SELECT t.tenant_industry_code AS industry_code, i.industry_name
       FROM sys.sys_tenancies t
       LEFT JOIN sys.sys_industry_codes i ON i.industry_code = t.tenant_industry_code
      WHERE t.tenant_id = $1`,
    [tenantId],
  );
  const tenant = t.rows[0];
  if (!tenant) return null;

  const versioni = await versioniAttiveDelTenant(q, tenantId);
  // Come per la scala dei livelli: se le tabelle del contratto non ci sono su questo database, la scheda è vuota, non rotta.
  const presente = await q.query<{ ok: boolean }>(`SELECT to_regclass('sys.sys_blueprint_content_ccnl_levels') IS NOT NULL AS ok`);
  let ccnl: RigaCcnl[] = [];
  let livelli: RigaLivello[] = [];
  if (presente.rows[0]?.ok && versioni.length > 0) {
    ccnl = (await q.query<RigaCcnl>(
      `SELECT DISTINCT ON (blueprint_content_ccnl_code)
              blueprint_content_ccnl_code AS code, blueprint_content_ccnl_name AS name,
              blueprint_content_ccnl_scope AS scope, blueprint_content_ccnl_parties AS parties,
              blueprint_content_ccnl_effective AS effective
         FROM sys.sys_blueprint_content_ccnl
        WHERE blueprint_content_ccnl_version_id = ANY($1::uuid[])
        ORDER BY blueprint_content_ccnl_code, blueprint_content_ccnl_name`,
      [versioni],
    )).rows;
    livelli = (await q.query<RigaLivello>(
      `SELECT DISTINCT ON (blueprint_content_ccnl_level_ccnl_code, blueprint_content_ccnl_level_code)
              blueprint_content_ccnl_level_ccnl_code AS ccnl_code, blueprint_content_ccnl_level_code AS code,
              blueprint_content_ccnl_level_name AS name, blueprint_content_ccnl_level_category AS category,
              blueprint_content_ccnl_level_annual_minimum_eur::text AS minimo,
              blueprint_content_ccnl_level_minimum_note AS note, blueprint_content_ccnl_level_duties AS duties
         FROM sys.sys_blueprint_content_ccnl_levels
        WHERE blueprint_content_ccnl_level_version_id = ANY($1::uuid[])
        ORDER BY blueprint_content_ccnl_level_ccnl_code, blueprint_content_ccnl_level_code,
                 blueprint_content_ccnl_level_annual_minimum_eur DESC NULLS LAST`,
      [versioni],
    )).rows;
  }

  // Persone con contratto in vigore, per livello nella forma normale (3A3L, QD2, Dirigente...).
  const persone = await q.query<{ livello: string | null; n: string }>(
    `SELECT c.user_contract_ccnl_level AS livello, count(DISTINCT c.user_contract_user_id)::text AS n
       FROM sys.sys_user_contracts c
      WHERE c.user_contract_tenant_id = $1 AND c.user_contract_status = 'ACTIVE'
        AND (c.user_contract_end_date IS NULL OR c.user_contract_end_date >= current_date)
      GROUP BY 1`,
    [tenantId],
  );
  const perLivello = new Map<string, number>();
  let conContratto = 0;
  for (const r of persone.rows) {
    const n = Number(r.n);
    conContratto += n;
    const k = livelloNormale(r.livello);
    if (k) perLivello.set(k, (perLivello.get(k) ?? 0) + n);
  }
  const normaliDelModello = new Set(livelli.map((l) => livelloNormale(l.code)).filter((x): x is string => !!x));

  const contracts: TenantContract[] = ccnl.map((c) => {
    const lv = livelli
      .filter((l) => l.ccnl_code === c.code)
      .map((l) => ({
        code: l.code, name: l.name, category: l.category, annualMinimumEur: l.minimo,
        minimumNote: l.note, duties: l.duties,
        people: perLivello.get(livelloNormale(l.code) ?? "") ?? 0,
      }))
      .sort((a, b) => (Number(a.annualMinimumEur ?? Infinity) - Number(b.annualMinimumEur ?? Infinity)) || a.code.localeCompare(b.code));
    return {
      code: c.code, name: c.name, scope: c.scope, parties: c.parties, effective: c.effective,
      levels: lv, gapLevelCodes: lv.filter((l) => l.annualMinimumEur === null).map((l) => l.code),
    };
  });

  let fuori = 0;
  for (const [k, n] of perLivello) if (!normaliDelModello.has(k)) fuori += n;

  return {
    tenantId,
    industryCode: tenant.industry_code,
    industryName: tenant.industry_name,
    contracts,
    summary: {
      contracts: contracts.length,
      levels: contracts.reduce((s, c) => s + c.levels.length, 0),
      levelsWithoutMinimum: contracts.reduce((s, c) => s + c.gapLevelCodes.length, 0),
      peopleWithContract: conContratto,
      peopleOutsideModelLevels: fuori,
    },
  };
}
