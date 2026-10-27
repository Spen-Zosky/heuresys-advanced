// O2-09/O2-10 — prova DAL VIVO in produzione (ADR-0026), dopo il deploy di 3a323bde.
//
// Due parti, perche' le persone reali hanno un secondo fattore loro (#169: nessuna chiave
// permette di entrare al loro posto, ed e' voluto):
//   A. login HTTP reale con l'utenza di collaudo persona@collaudo.invalid (RTL Bank, USER) e
//      GET /v1/me/processes sull'API di produzione: la rotta risponde con lo schema nuovo;
//   B. il CODICE DEPLOYATO (le stesse funzioni) sui dati di produzione, per tre persone reali
//      scelte dal dato: un process owner per D-P3-1, un ex-owner, un partecipante semplice.
// Stampa ruoli e conteggi, non dati personali.
//
//   (da apps/api) npx tsx scripts/o209-prova-live.mts http://127.0.0.1:8013
import { readCollaudoKey, deriveCollaudoPassword } from "../../../../apps/api/scripts/collaudo-access.mjs";
import { pool, closePool } from "../../../../apps/api/src/db/client.js";
import { functionalScopeUserIds } from "../../../../apps/api/src/lib/scope/functional.js";
import { activeDomainsOf } from "../../../../apps/api/src/lib/scope/domains.js";
import { listMyProcessParticipations } from "../../../../apps/api/src/modules/me/repository.js";

const BASE = process.argv[2] ?? "http://127.0.0.1:8013";

// A. HTTP
const email = "persona@collaudo.invalid";
const password = deriveCollaudoPassword(readCollaudoKey(), email);
const r = await fetch(`${BASE}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }) });
const lb = (await r.json()) as { status?: string };
if (r.status !== 200 || lb.status === "mfa_required") throw new Error(`login collaudo: ${r.status} ${lb.status ?? ""}`);
const cookie = (r.headers as unknown as { getSetCookie(): string[] }).getSetCookie().map((c) => c.split(";")[0]).join("; ");
const mp = await fetch(`${BASE}/v1/me/processes`, { headers: { cookie } });
const mpb = (await mp.json()) as { items: unknown[]; total: number };
console.log(`A. login HTTP ${email}: ${r.status} · GET /v1/me/processes ${mp.status} · total ${mpb.total} (utenza SERVICE senza posizione: zero e' l'atteso)`);

// B. codice deployato sui dati di produzione
const scegli = async (sql: string) => (await pool.query<{ id: string; tid: string }>(sql)).rows[0];
const soggetti: [string, { id: string; tid: string } | undefined][] = [
  ["process owner (D-P3-1)", await scegli(`
    SELECT a.user_position_assignment_user_id AS id, a.user_position_assignment_tenant_id AS tid
      FROM sys.sys_process_participants pp
      JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_position_id = pp.process_participant_position_id
       AND a.user_position_assignment_status = 'ACTIVE'
     WHERE pp.process_participant_is_active AND pp.process_participant_role = 'OWNER'
       AND pp.process_participant_metadata->>'derived' = 'RULE-OWNER-UNITA-GOVERNO'
     ORDER BY 1 LIMIT 1`)],
  ["ex-owner (righe OWNER disattivate)", await scegli(`
    SELECT u.user_id AS id, u.user_tenant_id AS tid FROM sys.sys_process_participants pp
      JOIN sys.sys_users u ON u.user_id = pp.process_participant_user_id AND u.user_status = 'ACTIVE'
     WHERE pp.process_participant_role = 'OWNER' AND NOT pp.process_participant_is_active
       AND NOT EXISTS (SELECT 1 FROM sys.sys_organization_units o
                        WHERE o.organization_unit_manager_user_id = u.user_id AND o.organization_unit_is_active)
     ORDER BY 1 LIMIT 1`)],
  ["partecipante CONTRIBUTOR", await scegli(`
    SELECT a.user_position_assignment_user_id AS id, a.user_position_assignment_tenant_id AS tid
      FROM sys.sys_process_participants pp
      JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_position_id = pp.process_participant_position_id
       AND a.user_position_assignment_status = 'ACTIVE'
     WHERE pp.process_participant_is_active AND pp.process_participant_role = 'CONTRIBUTOR'
       AND NOT EXISTS (SELECT 1 FROM sys.sys_organization_units o
                        WHERE o.organization_unit_manager_user_id = a.user_position_assignment_user_id
                          AND o.organization_unit_is_active)
     ORDER BY 1 LIMIT 1`)],
];
for (const [chi, s] of soggetti) {
  if (!s) throw new Error(`${chi}: nessun soggetto nel dato`);
  const scope = await functionalScopeUserIds(pool, s.id);
  const dom = await activeDomainsOf(pool, { userId: s.id, tenantId: s.tid, roles: [] });
  const mie = await listMyProcessParticipations(pool, s.id, s.tid);
  const attive = mie.items.filter((i) => i.isActive);
  const ruoli = attive.reduce<Record<string, number>>((m, i) => ((m[i.role] = (m[i.role] ?? 0) + 1), m), {});
  console.log(`B. ${chi}: process_owner ${dom.has("process_owner")} · perimetro funzionale ${scope.length} · i miei processi attivi ${attive.length} ${JSON.stringify(ruoli)} · senza posizione ${attive.filter((i) => !i.positionId).length}`);
}
const sent = await pool.query<{ n: string }>("SELECT count(*) AS n FROM sys.v_process_participants_active_without_position");
console.log(`sentinella sys.v_process_participants_active_without_position: ${sent.rows[0]?.n} righe`);
await closePool();
