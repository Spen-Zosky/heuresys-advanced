/**
 * apps/api/test/inbox-stream.integration.test.ts
 * #38 B6 — la posta in arrivo arriva da sola, senza sondaggio.
 *
 * La prova che conta non è «l'endpoint risponde 200»: è che una notifica scritta ORA
 * raggiunga una scheda già aperta in pochi secondi, senza che il client chieda nulla.
 * Con il sondaggio a 30s questo test fallirebbe per timeout.
 *
 * Due vincoli hanno dettato la forma del test, entrambi verificati e non presunti:
 *
 *  1. `app.inject()` non serve: simula la richiesta senza socket reale, e un flusso SSE
 *     vive proprio sul socket. L'app viene quindi messa in ascolto su una porta effimera.
 *  2. `NOTIFY` viene consegnato al COMMIT. La suite gira dentro una transazione
 *     rollbackata per file (D-52), quindi una scrittura fatta col pool dei test non
 *     uscirebbe MAI dalla sua transazione e nessun evento arriverebbe. La notifica di
 *     prova si scrive perciò da una connessione dedicata, e si rimuove alla fine.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { closeInboxListener, subscriberCount } from "../src/lib/inbox-stream.js";

const PERSONA = "federica.marchetti@rtl-bank.org";
const SUBJECT = `IT_SSE_${Date.now().toString(36).toUpperCase()}`;

let suite: TestApp;
let baseUrl: string;
let cookie: string;
let userId: string;
let tenantId: string;
/** Connessione fuori dalla transazione del file: senza, NOTIFY non uscirebbe mai. */
let writer: Client;
/** Tipo e priorità derivati dai dati reali, non scritti a mano: il CHECK sulla priorità
 *  ammette INFO/MEDIUM/HIGH/CRITICAL, e un valore inventato fa fallire l'inserimento in
 *  modo che somiglia a un difetto del flusso. */
let priority: string;
let notifType: string;

function conn(): string {
  const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } = process.env;
  return `postgresql://${encodeURIComponent(POSTGRES_USER ?? "")}:${encodeURIComponent(
    POSTGRES_PASSWORD ?? "",
  )}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;
}

/** Apre il flusso e risolve al primo evento `inbox`, o rifiuta allo scadere del tempo. */
async function waitForEvent(timeoutMs: number): Promise<{ opened: number; event: string }> {
  const ac = new AbortController();
  const res = await fetch(`${baseUrl}/v1/me/inbox/stream`, {
    headers: { cookie },
    signal: ac.signal,
  });
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  // Il proxy non deve accumulare: senza questo, in produzione il flusso arriva a blocchi.
  expect(res.headers.get("x-accel-buffering")).toBe("no");

  const opened = Date.now();
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error("flusso chiuso senza evento");
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes("event: inbox")) {
        return { opened, event: buffer };
      }
    }
  } finally {
    clearTimeout(timer);
    // `cancel()` prima di `abort()`: interrompere il fetch mentre una `read()` è in
    // volo la fa RIGETTARE con AbortError, e quella rejection non ha nessuno che la
    // attenda. Vitest la vede come errore non gestito e fa fallire il RUN anche con
    // tutti i test verdi — è esattamente ciò che è successo in CI (1613 passati,
    // job rosso). `cancel()` chiude il lettore in modo ordinato; `catch` copre il
    // caso in cui la corsa sia già persa.
    await reader.cancel().catch(() => {});
    ac.abort();
  }
}

beforeAll(async () => {
  suite = await buildTestApp();
  await suite.app.listen({ port: 0, host: "127.0.0.1" });
  const addr = suite.app.server.address();
  if (!addr || typeof addr === "string") throw new Error("indirizzo di ascolto non disponibile");
  baseUrl = `http://127.0.0.1:${addr.port}`;

  const r = await loginRaw(suite.app, PERSONA, TEST_PERSONA_PASSWORD);
  cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  userId = (r.json() as { user: { userId: string } }).user.userId;

  const t = await pool.query<{ tenant_id: string }>(
    `SELECT user_tenant_id AS tenant_id FROM sys.sys_users WHERE user_email = $1`, [PERSONA],
  );
  tenantId = t.rows[0]!.tenant_id;

  const shape = await pool.query<{ p: string; t: string }>(
    `SELECT notification_priority AS p, notification_type AS t
       FROM sys.sys_inbox_notifications
      GROUP BY 1, 2 ORDER BY count(*) DESC LIMIT 1`,
  );
  priority = shape.rows[0]!.p;
  notifType = shape.rows[0]!.t;

  writer = new Client({ connectionString: conn() });
  await writer.connect();
});

afterAll(async () => {
  // Le righe di prova nascono fuori dalla transazione del file: vanno rimosse a mano,
  // il rollback non le tocca.
  await writer.query(`DELETE FROM sys.sys_inbox_notifications WHERE notification_subject LIKE $1`, [`${SUBJECT}%`]);
  await writer.end();
  await closeInboxListener();
  await suite.app.close();
  await closePool();
});

describe("#38 B6 — la posta in arrivo arriva da sola", () => {
  it("una notifica scritta ora raggiunge una scheda già aperta in pochi secondi", async () => {
    const waiting = waitForEvent(15_000);
    // Lascia aprire il flusso e registrare la sottoscrizione prima di scrivere.
    await new Promise((r) => setTimeout(r, 500));
    expect(subscriberCount(userId)).toBeGreaterThan(0);

    const t0 = Date.now();
    await writer.query(
      `INSERT INTO sys.sys_inbox_notifications
         (notification_tenant_id, notification_user_id, notification_type,
          notification_subject, notification_body, notification_priority, notification_status)
       VALUES ($1, $2, $4, $3, 'prova del flusso in tempo reale', $5, 'UNREAD')`,
      [tenantId, userId, `${SUBJECT}_A`, notifType, priority],
    );

    const { event } = await waiting;
    const elapsed = Date.now() - t0;

    expect(event).toContain("event: inbox");
    expect(event).toContain('"op":"INSERT"');
    // Il punto dell'intera voce: molto prima dei 30 secondi del vecchio sondaggio.
    expect(elapsed).toBeLessThan(5_000);
  }, 30_000);

  it("anche la lettura di una notifica sveglia la scheda (il non-letto non resta indietro)", async () => {
    const ins = await writer.query<{ id: string }>(
      `INSERT INTO sys.sys_inbox_notifications
         (notification_tenant_id, notification_user_id, notification_type,
          notification_subject, notification_body, notification_priority, notification_status)
       VALUES ($1, $2, $4, $3, 'prova aggiornamento', $5, 'UNREAD')
       RETURNING notification_id AS id`,
      [tenantId, userId, `${SUBJECT}_B`, notifType, priority],
    );
    const id = ins.rows[0]!.id;

    const waiting = waitForEvent(15_000);
    await new Promise((r) => setTimeout(r, 500));
    await writer.query(
      `UPDATE sys.sys_inbox_notifications
          SET notification_status = 'READ', notification_read_at = now()
        WHERE notification_id = $1`,
      [id],
    );

    const { event } = await waiting;
    expect(event).toContain('"op":"UPDATE"');
  }, 30_000);

  it("il flusso di un utente non riceve gli eventi di un altro", async () => {
    // Un altro utente dello stesso tenant: se il filtro per destinatario non tenesse,
    // ogni scheda aperta vedrebbe passare il traffico di tutti.
    const other = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE user_tenant_id = $1 AND user_id <> $2 LIMIT 1`,
      [tenantId, userId],
    );
    const otherId = other.rows[0]!.user_id;

    const ac = new AbortController();
    const res = await fetch(`${baseUrl}/v1/me/inbox/stream`, { headers: { cookie }, signal: ac.signal });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    await new Promise((r) => setTimeout(r, 500));

    await writer.query(
      `INSERT INTO sys.sys_inbox_notifications
         (notification_tenant_id, notification_user_id, notification_type,
          notification_subject, notification_body, notification_priority, notification_status)
       VALUES ($1, $2, $4, $3, 'destinata ad altri', $5, 'UNREAD')`,
      [tenantId, otherId, `${SUBJECT}_C`, notifType, priority],
    );

    let buffer = "";
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      const chunk = await Promise.race([
        // `catch` sulla read: quando il ciclo esce e si chiude il lettore, la read
        // rimasta in volo rigetta e nessuno la attende più.
        reader.read().catch(() => ({ value: undefined, done: false as const })),
        new Promise<{ value: undefined; done: false }>((r) => setTimeout(() => r({ value: undefined, done: false }), 500)),
      ]);
      if (chunk.value) buffer += decoder.decode(chunk.value, { stream: true });
      if (buffer.includes("event: inbox")) break;
    }
    await reader.cancel().catch(() => {});
    ac.abort();
    expect(buffer).not.toContain("event: inbox");
  }, 30_000);

  it("alla chiusura del flusso la sottoscrizione viene rilasciata", async () => {
    // Attesa ATTIVA, non istantanea: la chiusura dei flussi aperti dai test precedenti
    // arriva in modo asincrono, e un confronto secco fra due letture istantanee misura
    // l'istante sbagliato — il test fallisce a intermittenza senza che nulla sia rotto.
    const settle = async (pred: () => boolean, ms = 5_000): Promise<boolean> => {
      const deadline = Date.now() + ms;
      while (Date.now() < deadline) {
        if (pred()) return true;
        await new Promise((r) => setTimeout(r, 100));
      }
      return pred();
    };

    await settle(() => subscriberCount(userId) === 0);
    const before = subscriberCount(userId);

    const ac = new AbortController();
    const res = await fetch(`${baseUrl}/v1/me/inbox/stream`, { headers: { cookie }, signal: ac.signal });
    const reader = res.body!.getReader();
    // `void read()` non basta: la promise resta e rigetta all'abort, senza nessuno
    // che la attenda. Il `catch` la assorbe.
    void reader.read().catch(() => {});
    expect(await settle(() => subscriberCount(userId) > before)).toBe(true);

    await reader.cancel().catch(() => {});
    ac.abort();
    // Senza il rilascio, ogni scheda chiusa lascerebbe un sottoscrittore morto: la
    // perdita cresce con l'uso e si vede solo dopo giorni.
    expect(await settle(() => subscriberCount(userId) <= before)).toBe(true);
  }, 30_000);

  it("chi non è autenticato non apre il flusso", async () => {
    const res = await fetch(`${baseUrl}/v1/me/inbox/stream`);
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });
});
