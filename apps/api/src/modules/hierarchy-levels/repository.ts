/**
 * apps/api/src/modules/hierarchy-levels/repository.ts
 * SQL di sola lettura per il principio gerarchia-livelli (#265). Due oggetti da controllare: un modello (versione di variante,
 * prima dell'attivazione) e l'organigramma di un tenant. L'ordine dei livelli viene sempre dal contratto collettivo caricato in un
 * modello (`sys_blueprint_content_ccnl_levels`, ordinati per minimo annuo): non è scritto nel codice.
 */
import type { DbConnector } from "../tenant-materialization/build-source.js";
import type { Scala, Unita } from "./logic.js";

/** I livelli dei contratti collettivi di queste versioni di modello, dal più basso (minimo annuo) al più alto. */
export async function scalaDaVersioni(q: DbConnector, versionIds: readonly string[]): Promise<Scala> {
  if (versionIds.length === 0) return { ordine: [] };
  // L'avviso e' accessorio: se la tabella dei livelli del contratto (mig. 000454) non c'e' ancora su questo database, non c'e' un
  // ordine da cui giudicare e si risponde «nessuna scala», senza far fallire l'anteprima di attivazione che lo ospita.
  const presente = await q.query<{ ok: boolean }>(`SELECT to_regclass('sys.sys_blueprint_content_ccnl_levels') IS NOT NULL AS ok`);
  if (!presente.rows[0]?.ok) return { ordine: [] };
  const r = await q.query<{ code: string }>(
    `SELECT blueprint_content_ccnl_level_code AS code
       FROM sys.sys_blueprint_content_ccnl_levels
      WHERE blueprint_content_ccnl_level_version_id = ANY($1::uuid[])
        AND blueprint_content_ccnl_level_annual_minimum_eur IS NOT NULL
      GROUP BY blueprint_content_ccnl_level_code
      ORDER BY max(blueprint_content_ccnl_level_annual_minimum_eur), blueprint_content_ccnl_level_code`,
    [versionIds],
  );
  return { ordine: r.rows.map((x) => x.code) };
}

/** Le versioni pubblicate dei modelli che il tenant ha attivi oggi (stessa regola di `codiciDelProfilo`). */
export async function versioniAttiveDelTenant(q: DbConnector, tenantId: string): Promise<string[]> {
  const r = await q.query<{ id: string }>(
    `SELECT DISTINCT vv.blueprint_variant_version_id AS id
       FROM sys.sys_blueprint_activations a
       JOIN sys.sys_blueprint_variant_versions vv
         ON vv.blueprint_variant_version_variant_id = a.blueprint_activation_variant_id
        AND vv.blueprint_variant_version_status = 'PUBLISHED'
      WHERE a.blueprint_activation_tenant_id = $1
        AND a.blueprint_activation_status = 'ACTIVE'
        AND a.blueprint_activation_effective_from <= current_date
        AND (a.blueprint_activation_effective_to IS NULL OR a.blueprint_activation_effective_to >= current_date)`,
    [tenantId],
  );
  return r.rows.map((x) => x.id);
}

/**
 * Un modello come albero di unità. Il responsabile di un'unità è la posizione marcata `is_unit_head` (più d'una: la prima per codice);
 * le altre posizioni dell'unità sono le sue persone. Il livello è quello contrattuale della posizione, nel vocabolario del contratto.
 */
export async function unitaDelModello(q: DbConnector, versionId: string): Promise<Unita[]> {
  const unita = await q.query<{ code: string; name: string; parent_code: string | null }>(
    `SELECT blueprint_content_unit_code AS code, blueprint_content_unit_name AS name, blueprint_content_unit_parent_code AS parent_code
       FROM sys.sys_blueprint_content_units WHERE blueprint_content_unit_version_id = $1 ORDER BY blueprint_content_unit_code`,
    [versionId],
  );
  const pos = await q.query<{ code: string; title: string; unit_code: string; level: string | null; head: boolean | null }>(
    `SELECT blueprint_content_position_code AS code, blueprint_content_position_title AS title,
            blueprint_content_position_unit_code AS unit_code, blueprint_content_position_ccnl_level_code AS level,
            blueprint_content_position_is_unit_head AS head
       FROM sys.sys_blueprint_content_positions WHERE blueprint_content_position_version_id = $1 ORDER BY blueprint_content_position_code`,
    [versionId],
  );
  return unita.rows.map((u) => {
    const dellUnita = pos.rows.filter((p) => p.unit_code === u.code);
    const capo = dellUnita.find((p) => p.head === true) ?? null;
    return {
      id: u.code,
      nome: u.name,
      padreId: u.parent_code,
      responsabile: capo ? { id: capo.code, posto: capo.title, livello: capo.level } : null,
      persone: dellUnita.filter((p) => p !== capo).map((p) => ({ id: p.code, posto: p.title, livello: p.level })),
    };
  });
}

/**
 * L'organigramma di un tenant. Il responsabile è l'utente indicato dall'unità; le persone sono quelle con un'assegnazione attiva a una
 * posizione dell'unità. Il livello è quello del contratto attivo. Del posto si dice il titolo, mai il nome della persona.
 */
export async function unitaDelTenant(q: DbConnector, tenantId: string): Promise<Unita[]> {
  const unita = await q.query<{ id: string; name: string; parent_id: string | null; manager: string | null }>(
    `SELECT organization_unit_id AS id, organization_unit_name AS name, organization_unit_parent_id AS parent_id,
            organization_unit_manager_user_id AS manager
       FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id = $1 AND organization_unit_is_active = true
      ORDER BY organization_unit_code`,
    [tenantId],
  );
  const persone = await q.query<{ unit_id: string; user_id: string; title: string; level: string | null }>(
    `SELECT p.position_organization_unit_id AS unit_id, a.user_position_assignment_user_id AS user_id, p.position_title AS title,
            (SELECT c.user_contract_ccnl_level FROM sys.sys_user_contracts c
              WHERE c.user_contract_user_id = a.user_position_assignment_user_id AND c.user_contract_status = 'ACTIVE'
              ORDER BY c.user_contract_start_date DESC LIMIT 1) AS level
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
      WHERE a.user_position_assignment_tenant_id = $1 AND a.user_position_assignment_status = 'ACTIVE' AND p.position_is_active = true`,
    [tenantId],
  );
  const livelloUtente = new Map<string, { title: string; level: string | null }>();
  for (const p of persone.rows) if (!livelloUtente.has(p.user_id)) livelloUtente.set(p.user_id, { title: p.title, level: p.level });
  const livelloManager = async (ids: string[]): Promise<Map<string, string | null>> => {
    const r = await q.query<{ user_id: string; level: string | null }>(
      `SELECT u.user_id AS user_id,
              (SELECT c.user_contract_ccnl_level FROM sys.sys_user_contracts c
                WHERE c.user_contract_user_id = u.user_id AND c.user_contract_status = 'ACTIVE'
                ORDER BY c.user_contract_start_date DESC LIMIT 1) AS level
         FROM sys.sys_users u WHERE u.user_id = ANY($1::uuid[])`,
      [ids],
    );
    return new Map(r.rows.map((x) => [x.user_id, x.level]));
  };
  const managers = [...new Set(unita.rows.map((u) => u.manager).filter((m): m is string => m !== null))];
  const livelli = managers.length > 0 ? await livelloManager(managers) : new Map<string, string | null>();
  return unita.rows.map((u) => {
    const capo = u.manager;
    return {
      id: u.id,
      nome: u.name,
      padreId: u.parent_id,
      responsabile: capo
        ? { id: capo, posto: livelloUtente.get(capo)?.title ?? `responsabile di ${u.name}`, livello: livelli.get(capo) ?? null }
        : null,
      persone: persone.rows
        .filter((p) => p.unit_id === u.id && p.user_id !== capo)
        .map((p) => ({ id: p.user_id, posto: p.title, livello: p.level })),
    };
  });
}
