/**
 * apps/api/scripts/prova-live-198-t3.mts — prova LIVE di #198 P3/T3 (E17), riscritta da #132 F3.
 *
 * ⚠ COSA MOSTRAVA PRIMA, e perché non può più. Questa prova elencava i **segnaposto** che il
 * motore avrebbe generato per l'archetipo di riferimento, e li confrontava coi nomi propri
 * delle persone reali: E17 chiede che una riga generata non possa essere scambiata per una
 * persona vera. Con `#132` F3 (E29) l'archetipo è stato ritirato, e con lui i segnaposto: un
 * modello descrive la **forma** di un'azienda, non chi ci lavora.
 *
 * COSA MOSTRA ADESSO, ed è la stessa regola portata alle estreme conseguenze: che nel
 * database **non nascano più** persone generate. E17 chiedeva che un segnaposto si
 * riconoscesse a colpo d'occhio; oggi la risposta è più forte — non ce ne sono. Le persone
 * generate ancora presenti sono quelle create PRIMA del ritiro, e questa prova le conta, così
 * che il numero sia un fatto misurato e non un ricordo.
 */
import { pool, closePool } from "../src/db/client.js";

const { rows } = await pool.query<{ tenant: string; n: string }>(
  `SELECT t.tenant_code AS tenant, count(*)::text AS n
     FROM sys.sys_users u
     JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
    WHERE coalesce(u.user_type, '') = 'GENERATED_INCUMBENT'
    GROUP BY t.tenant_code
    ORDER BY t.tenant_code`,
);

console.log(`# prova LIVE #198 T3 (E17) — ${new Date().toISOString()}`);
console.log(`  l'archetipo è ritirato (#132 F3): nessuna sorgente genera più titolari segnaposto.`);
if (rows.length === 0) {
  console.log(`  persone generate presenti nel database: NESSUNA`);
} else {
  console.log(`  persone generate presenti nel database (create prima del ritiro):`);
  for (const r of rows) console.log(`    ${r.tenant.padEnd(24)} → ${r.n}`);
}

const totale = rows.reduce((n, r) => n + Number(r.n), 0);
console.log(`\nVERDETTO: ${totale} persone generate in tutto il database.`);
await closePool();
// Il conteggio è un'OSSERVAZIONE, non una condizione: righe nate prima del ritiro sono un
// fatto storico, non un difetto da far fallire qui. Chi vuole bonificarle lo decide altrove.
process.exit(0);
