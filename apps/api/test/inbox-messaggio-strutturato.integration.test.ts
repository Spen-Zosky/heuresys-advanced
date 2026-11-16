/**
 * Giudizio qa-web 16/11, T-LINGUA (API-NOTIF): sui dati reali, ogni avviso di approvazione e di gap di competenze
 * gia' salvato esce dall'inbox con un messaggio strutturato (codice e parametri), senza che il dato sia riscritto.
 * Chiama il repository sul database vivo, senza login; l'atteso viene dalle righe di sys_inbox_notifications.
 */
import { describe, it, expect, afterAll } from "vitest";
import { closePool, pool } from "../src/db/client.js";
import { listInbox } from "../src/modules/me/repository.js";

afterAll(async () => {
  await closePool();
});

describe("inbox: il messaggio strutturato degli avvisi esistenti", () => {
  it("per ogni destinatario, gli avvisi dei tre tipi portano codice e parametri coerenti con il testo salvato", async () => {
    const utenti = await pool.query<{ uid: string }>(
      `SELECT DISTINCT notification_user_id AS uid FROM sys.sys_inbox_notifications
        WHERE notification_type IN ('APPROVAL_REMINDER', 'APPROVAL_OVERDUE', 'GAP_CLOSURE_DUE') LIMIT 40`,
    );
    expect(utenti.rows.length).toBeGreaterThan(0);
    const visti = new Set<string>();
    for (const { uid } of utenti.rows) {
      const inbox = await listInbox(pool, uid, { limit: 200, offset: 0 } as Parameters<typeof listInbox>[2]);
      for (const n of inbox.items) {
        if (!["APPROVAL_REMINDER", "APPROVAL_OVERDUE", "GAP_CLOSURE_DUE"].includes(n.type)) continue;
        visti.add(n.type);
        expect(n.message, `${n.type}: ${n.subject}`).not.toBeNull();
        expect(n.message!.code).toBe(n.type);
        if (n.type === "APPROVAL_REMINDER") expect(n.subject).toBe(`Approvazione in attesa: ${n.message!.params["title"]}`);
        if (n.type === "APPROVAL_OVERDUE") {
          expect(n.subject).toBe(`Approvazione scaduta: ${n.message!.params["title"]}`);
          expect(n.body).toContain(`da ${n.message!.params["cycles"]} cicli`);
        }
        if (n.type === "GAP_CLOSURE_DUE") expect(n.message!.params["segment"]).toMatch(/^(MAJOR_GAP|MODERATE_GAP|MINOR_GAP|ALIGNED|UNKNOWN)$/);
      }
    }
    expect([...visti].sort()).toEqual(["APPROVAL_OVERDUE", "APPROVAL_REMINDER", "GAP_CLOSURE_DUE"]);
  });
});
