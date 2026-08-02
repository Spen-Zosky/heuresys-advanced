/**
 * apps/api/src/lib/inbox-stream.ts
 * #38 B6 — distribuzione degli avvisi di posta in arrivo agli stream SSE aperti.
 *
 * Un SOLO client PostgreSQL in `LISTEN inbox_changed` per processo, non uno per
 * sessione: il canale è unico e il destinatario viaggia nel payload (vedi migration
 * 000231). Con un canale per utente servirebbe un LISTEN per ogni scheda aperta, e
 * il numero di connessioni al database crescerebbe con gli utenti collegati.
 *
 * Il client è DEDICATO e non viene preso dal pool: una connessione in LISTEN resta
 * occupata per definizione, e restituirla al pool la renderebbe disponibile ad altre
 * query che poi la rilascerebbero, perdendo l'ascolto in silenzio.
 *
 * Avvio pigro: la connessione si apre alla prima sottoscrizione. Un processo che non
 * serve stream (i test di altri moduli, uno script) non apre nulla.
 */
import { Client } from "pg";
import type { FastifyBaseLogger } from "fastify";

export interface InboxEvent {
  userId: string;
  tenantId: string | null;
  op: "INSERT" | "UPDATE" | "DELETE";
}

type Subscriber = (event: InboxEvent) => void;

const CHANNEL = "inbox_changed";

/** Sottoscrittori per utente: più schede dello stesso utente sono più voci qui. */
const subscribers = new Map<string, Set<Subscriber>>();

let client: Client | null = null;
let connecting: Promise<void> | null = null;
let logger: FastifyBaseLogger | null = null;

function connectionString(): string {
  const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } = process.env;
  return `postgresql://${encodeURIComponent(POSTGRES_USER ?? "")}:${encodeURIComponent(
    POSTGRES_PASSWORD ?? "",
  )}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;
}

function dispatch(raw: string): void {
  let event: InboxEvent;
  try {
    event = JSON.parse(raw) as InboxEvent;
  } catch {
    logger?.warn({ raw }, "inbox-stream: payload NOTIFY illeggibile");
    return;
  }
  const targets = subscribers.get(event.userId);
  if (!targets) return;
  for (const fn of targets) {
    try {
      fn(event);
    } catch (err) {
      // Un sottoscrittore rotto (socket già chiuso) non deve impedire agli altri di ricevere.
      logger?.warn({ err }, "inbox-stream: sottoscrittore in errore, ignorato");
    }
  }
}

async function ensureListening(log?: FastifyBaseLogger): Promise<void> {
  logger ??= log ?? null;
  if (client) return;
  connecting ??= (async () => {
    const c = new Client({ connectionString: connectionString() });
    c.on("notification", (msg) => {
      if (msg.channel === CHANNEL && msg.payload) dispatch(msg.payload);
    });
    c.on("error", (err) => {
      // La connessione dedicata può cadere (riavvio del database, rete). Si azzera lo
      // stato così che la prossima sottoscrizione la riapra, invece di restare in
      // ascolto di una connessione morta — che è il modo in cui un push "funziona"
      // in prova e tace in produzione.
      logger?.error({ err }, "inbox-stream: connessione di ascolto caduta, verrà riaperta");
      client = null;
      connecting = null;
      void c.end().catch(() => {});
    });
    await c.connect();
    await c.query(`LISTEN ${CHANNEL}`);
    client = c;
  })();
  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

/** Registra uno stream. Ritorna la funzione di disiscrizione (da chiamare alla chiusura). */
export async function subscribeInbox(
  userId: string,
  fn: Subscriber,
  log?: FastifyBaseLogger,
): Promise<() => void> {
  await ensureListening(log);
  const set = subscribers.get(userId) ?? new Set<Subscriber>();
  set.add(fn);
  subscribers.set(userId, set);
  return () => {
    const current = subscribers.get(userId);
    if (!current) return;
    current.delete(fn);
    if (current.size === 0) subscribers.delete(userId);
  };
}

/** Quanti stream aperti per utente — usato dai test e dalla diagnostica. */
export function subscriberCount(userId?: string): number {
  if (userId) return subscribers.get(userId)?.size ?? 0;
  let n = 0;
  for (const s of subscribers.values()) n += s.size;
  return n;
}

/** Chiude la connessione di ascolto. Da chiamare allo spegnimento del processo. */
export async function closeInboxListener(): Promise<void> {
  subscribers.clear();
  const c = client;
  client = null;
  connecting = null;
  if (c) await c.end().catch(() => {});
}
