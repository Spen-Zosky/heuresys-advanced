/**
 * apps/api/scripts/prova-live-198-t3.mts — prova LIVE di #198 P3/T3 (E17).
 *
 * Mostra i segnaposto che il motore genererebbe OGGI per l'archetipo di
 * riferimento, e li confronta coi nomi propri delle persone reali del database.
 * Un test verde dice che la regola è codificata; questo dice che cosa produce.
 */
import { getArchetype, archetypeUsers } from "../src/modules/tenant-materialization/blueprints.js";
import { pool, closePool } from "../src/db/client.js";

const utenti = archetypeUsers(getArchetype("RETAIL_BANK_REFERENCE")!);
const { rows } = await pool.query<{ nome: string }>(
  `SELECT DISTINCT lower(user_first_name) AS nome FROM sys.sys_users
    WHERE user_first_name IS NOT NULL AND coalesce(user_type,'') <> 'GENERATED_INCUMBENT'`,
);
const veri = new Set(rows.map((r) => r.nome));
console.log(`# prova LIVE #198 T3 (E17) — ${new Date().toISOString()}`);
console.log(`  nomi propri di persone reali nel database: ${veri.size}`);
for (const u of utenti) console.log(`  ${u.positionCode.padEnd(22)} → ${u.displayName}`);
const colpevoli = utenti.filter((u) => veri.has(u.firstName.toLowerCase().replace(/\s+\d+$/, "")));
console.log(`\nVERDETTO: ${colpevoli.length === 0
  ? "nessuno dei " + utenti.length + " segnaposto porta il nome di una persona reale"
  : "FALLITA — " + colpevoli.map((u) => u.displayName).join(", ")}`);
await closePool();
process.exit(colpevoli.length === 0 ? 0 : 1);
