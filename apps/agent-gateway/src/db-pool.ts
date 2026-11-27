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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

let pool: pg.Pool | undefined;

/** Le sole chiavi che il diario prende dal `.env` della copia rilasciata (R8). */
export const CHIAVI_DIARIO = [
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_DB",
  "POSTGRES_SSL",
  "POSTGRES_APP_USER",
  "POSTGRES_APP_PASSWORD",
] as const;
type ChiaveDiario = (typeof CHIAVI_DIARIO)[number];
export type AmbienteDiario = Partial<Record<ChiaveDiario, string>>;

/**
 * R8 (nota del 2026-11-05, misurato dal vivo il 2026-11-26): in produzione l'unità del gateway non
 * riceve `POSTGRES_*`, quindi il diario andava su file e il registro delle capacità non si leggeva.
 * L'API prende la connessione dal `.env` della copia rilasciata (`HEURESYS_REPO_ROOT`); il gateway
 * ne prende lo stesso, ma SOLO le chiavi di `CHIAVI_DIARIO`: il resto del file (chiavi di firma,
 * password del proprietario) non entra nel processo, e quindi nemmeno nel processo del modello.
 * Ciò che è già nell'ambiente vince sul file.
 */
export function ambienteDiario(env: NodeJS.ProcessEnv = process.env, leggi: (p: string) => string = (p) => readFileSync(p, "utf8")): AmbienteDiario {
  const out: AmbienteDiario = {};
  const root = env.HEURESYS_REPO_ROOT;
  if (root) {
    let testo = "";
    try {
      testo = leggi(resolve(root, ".env"));
    } catch {
      testo = "";
    }
    for (const riga of testo.split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*)$/.exec(riga);
      if (!m) continue;
      const chiave = m[1] as ChiaveDiario;
      if (!(CHIAVI_DIARIO as readonly string[]).includes(chiave)) continue;
      let v = (m[2] ?? "").trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[chiave] = v;
    }
  }
  for (const k of CHIAVI_DIARIO) {
    const v = env[k];
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

export function auditPool(): pg.Pool | undefined {
  if (pool) return pool;
  const amb = ambienteDiario();
  const host = amb.POSTGRES_HOST;
  if (!host) return undefined;

  const appUser = amb.POSTGRES_APP_USER;
  // Dal file si entra solo con l'identità dell'applicazione: senza, il diario resta su file.
  const user = appUser ?? process.env.POSTGRES_USER;
  const password = appUser ? (amb.POSTGRES_APP_PASSWORD ?? "") : process.env.POSTGRES_PASSWORD;
  if (!user) return undefined;

  pool = new pg.Pool({
    host,
    port: Number(amb.POSTGRES_PORT ?? 5432),
    database: amb.POSTGRES_DB ?? "heuresys_advanced",
    user,
    password,
    ssl: amb.POSTGRES_SSL === "require" ? { rejectUnauthorized: true } : undefined,
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
