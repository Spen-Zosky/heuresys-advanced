/**
 * #253 — pool pg per il SOLO diario del gate (`DbAuditSink`). Il gateway non ha
 * nessun'altra dipendenza dal database: tutto il resto passa da `HeuresysClient`
 * sopra `/v1` (ADR-0011/I5, isolamento tenant nel middleware dell'API). Il diario
 * e' l'eccezione dichiarata (#253, `audit.*` e' schema ausiliario I3/I4, non dato
 * di dominio) e riusa le stesse variabili d'ambiente di `apps/api/src/db/client.ts`
 * — stesso cluster, stessa identita' meno potente quando c'e' (#223 F3).
 *
 * `auditPool()` torna `undefined` quando `POSTGRES_HOST` non e' impostata: il
 * chiamante (`server.ts`) ricade su `FileAuditSink` (decisione gia' presa, #253).
 */
import pg from "pg";

let pool: pg.Pool | undefined;

export function auditPool(): pg.Pool | undefined {
  if (pool) return pool;
  const host = process.env.POSTGRES_HOST;
  if (!host) return undefined;

  const appUser = process.env.POSTGRES_APP_USER;
  const user = appUser ?? process.env.POSTGRES_USER;
  const password = appUser ? (process.env.POSTGRES_APP_PASSWORD ?? "") : process.env.POSTGRES_PASSWORD;

  pool = new pg.Pool({
    host,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? "heuresys_advanced",
    user,
    password,
    ssl: process.env.POSTGRES_SSL === "require" ? { rejectUnauthorized: true } : undefined,
    max: 5, // il diario e' l'unico consumatore: nessun bisogno del pool da 20 dell'API
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // Stessa ragione di apps/api/src/db/client.ts: senza un listener, un client IDLE
  // la cui connessione cade (riavvio, blip di rete) fa crashare il processo con un
  // 'error' non gestito. Qui non deve mai poter abbattere il gateway.
  pool.on("error", (err) => {
    console.error(
      JSON.stringify({
        level: "error",
        phase: "agent-gateway-audit-pool",
        msg: "idle client error (connessione caduta); il pool si riconnette al prossimo uso",
        error_name: (err as Error).name,
        error_message: (err as Error).message,
      }),
    );
  });

  return pool;
}

export async function closeAuditPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
