// Z-251 F1 — riprodurre la contesa a comando.
//
// L'IPOTESI CHE IL PIANO NON CONTEMPLA. Il messaggio misurato tre volte in S1052 e'
// `Connection terminated due to connection timeout` dentro `pool.connect()`, cioe' il
// pool non ottiene una connessione entro `connectionTimeoutMillis: 5_000`. Il piano
// attribuisce la causa al carico sul pool e alla lentezza di Argon2id. Ma:
//   · `fileParallelism: false` — i file girano in SEQUENZA, quindi la suite da sola non
//     apre raffiche concorrenti;
//   · il database ha 6 connessioni attive su 100 — non e' saturo;
//   · e il percorso non e' diretto: e' un TUNNEL SSH (`ssh -L 5433`), un processo solo.
// Quindi il sospetto e' che a cedere sia il canale, non il database.
//
// L'esperimento: N connessioni concorrenti attraverso il tunnel, misurando quanto ci
// mette ciascuna a completare `connect()` + `SELECT 1`. Se il tunnel e' il collo, i tempi
// crescono con N e qualcuna supera i 5000 ms.
//
// Lettura pura (`SELECT 1`), niente scritture, tutte le connessioni chiuse a fine giro.
import pg from "pg";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: "D:/heuresys-advanced/.env" });

const N = Number(process.argv[2] ?? 20);
const TIMEOUT = Number(process.argv[3] ?? 5000);

const cfg = {
  host: process.env["POSTGRES_HOST"],
  port: Number(process.env["POSTGRES_PORT"] ?? 5432),
  database: process.env["POSTGRES_DB"],
  user: process.env["POSTGRES_USER"],
  password: process.env["POSTGRES_PASSWORD"],
  connectionTimeoutMillis: TIMEOUT,
};

async function unaConnessione(i) {
  const t0 = Date.now();
  const c = new pg.Client(cfg);
  try {
    await c.connect();
    await c.query("SELECT 1");
    return { i, ms: Date.now() - t0, esito: "ok" };
  } catch (e) {
    return { i, ms: Date.now() - t0, esito: (e && e.message) || String(e) };
  } finally {
    try { await c.end(); } catch { /* gia' chiusa */ }
  }
}

const t0 = Date.now();
const esiti = await Promise.all(Array.from({ length: N }, (_, i) => unaConnessione(i)));
const durata = Date.now() - t0;

const ok = esiti.filter((e) => e.esito === "ok");
const ko = esiti.filter((e) => e.esito !== "ok");
const tempi = ok.map((e) => e.ms).sort((a, b) => a - b);
const p = (q) => (tempi.length ? tempi[Math.min(tempi.length - 1, Math.floor(tempi.length * q))] : -1);

console.log(`N=${N} timeout=${TIMEOUT}ms  durata=${durata}ms`);
console.log(`  riuscite ${ok.length}/${N}  ·  fallite ${ko.length}`);
console.log(`  connect+SELECT: min ${tempi[0] ?? "-"}ms · mediana ${p(0.5)}ms · p90 ${p(0.9)}ms · max ${tempi[tempi.length - 1] ?? "-"}ms`);
for (const e of ko.slice(0, 3)) console.log(`  FALLITA #${e.i} dopo ${e.ms}ms: ${e.esito}`);
process.exit(ko.length ? 1 : 0);
