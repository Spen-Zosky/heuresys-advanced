/**
 * apps/api/src/modules/agent-weekly-summary/summary-cli.ts — ADR-0063 D3, piano voce F0c (E5).
 *
 *   pnpm --filter @heuresys/api agents:weekly-summary [YYYY-MM-DD]
 *
 * Ogni lunedì (heuresys-advanced-agent-weekly-summary.timer) calcola il riepilogo dell'ultima
 * settimana conclusa per tutti i tenant e lo mette nella casella della piattaforma di ogni persona
 * con il mandato di piattaforma: un avviso interno con il link alla pagina, niente posta (E6).
 * Rieseguito, non duplica: l'avviso porta un identificativo ricavato dalla settimana.
 * Il riepilogo si invia anche quando la settimana non ha scritture: «zero» è un'informazione.
 */
import { pool } from "../../db/client.js";
import { emitNotification } from "../../lib/notifications/emit.js";
import { testoRiepilogoAgente } from "../../lib/notifications/messaggi.js";
import * as repo from "./repository.js";
import { riepilogo } from "./service.js";

/** Un uuid fisso per settimana, così l'avviso non si ripete (dedupe di `emitNotification`). */
async function idSettimana(start: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `SELECT (substr(m, 1, 8) || '-' || substr(m, 9, 4) || '-4' || substr(m, 14, 3) || '-8' || substr(m, 18, 3) || '-' || substr(m, 21, 12)) AS id
       FROM (SELECT md5('agent-weekly-summary:' || $1::text) AS m) x`,
    [start],
  );
  return r.rows[0]!.id;
}

export async function runWeeklySummaryCli(giorno: string | null): Promise<{ week: string; recipients: number; sent: number }> {
  const s = await riepilogo(giorno, null);
  const resourceId = await idSettimana(s.weekStart);
  const testo = testoRiepilogoAgente(s.weekStart, s.weekEnd, s.totals.confirmed, s.totals.denied, s.totals.autonomous);
  let sent = 0;
  const persone = await repo.destinatari(pool);
  for (const p of persone) {
    // già consegnato (letto o no): non si ripete
    const gia = await pool.query(
      `SELECT 1 FROM sys.sys_inbox_notifications
        WHERE notification_user_id = $1 AND notification_type = 'SYSTEM' AND notification_resource_id = $2 LIMIT 1`,
      [p.user_id, resourceId],
    );
    if (gia.rows.length > 0) continue;
    const id = await emitNotification(pool, {
      tenantId: p.tenant_id,
      userId: p.user_id,
      type: "SYSTEM",
      subject: testo.subject,
      body: testo.body,
      priority: s.totals.autonomous > 0 ? "HIGH" : "INFO",
      resourceId,
      actionUrl: `/admin/agent-weekly-summary?week=${s.weekStart}`,
      dedupe: true,
    });
    if (id) sent += 1;
  }
  const esito = { cli: "agent-weekly-summary", week: s.weekStart, totals: s.totals, recipients: persone.length, sent };
  console.log(JSON.stringify(esito));
  return { week: s.weekStart, recipients: persone.length, sent };
}

const invoked = process.argv[1] ?? "";
if (invoked.endsWith("summary-cli.ts") || invoked.endsWith("summary-cli.js")) {
  const giorno = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : null;
  runWeeklySummaryCli(giorno)
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error("agent-weekly-summary CLI FAILED:", err);
      void pool.end().finally(() => process.exit(1));
    });
}
