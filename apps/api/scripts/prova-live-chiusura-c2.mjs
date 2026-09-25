/**
 * apps/api/scripts/prova-live-chiusura-c2.mjs
 * CHIUSURA-C2 (2026-09-25) — la prova SUL VIVO, in PRODUZIONE, delle due cose che il
 * rilascio di stanotte doveva rendere vere. Definition of Done del progetto (ADR-0026):
 * uno step non si chiude su un test verde, si chiude su una dimostrazione live.
 *
 *   (a) D11 — il DPO apre `GET /v1/users/:userId/dossier` di una persona del suo tenant
 *       fuori dalla propria catena: 200, con COMPENSATION ed EVALUATION assenti e
 *       DICHIARATE in `masked` (I20, quarto stato di autorizzazione).
 *   (b) registro #30 — PLATFORM_OPERATOR e SALES hanno permessi EFFETTIVI in produzione:
 *       ciascuno entra nei propri moduli (200) e resta fuori da quelli dell'altro (403).
 *       Senza la controprova a 403 staremmo provando «sono entrato», non «il perimetro c'è».
 *
 * SOLA LETTURA: nessuna rotta di scrittura viene chiamata. Il soggetto si DERIVA dai dati
 * vivi con la stessa query del test di D11, mai per nome: se l'organigramma cambia, la
 * prova sceglie un'altra persona invece di misurare il caso sbagliato.
 *
 *   node apps/api/scripts/prova-live-chiusura-c2.mjs [baseUrl]
 *   (default https://www.heuresys.com/api — il database si legge dal .env di apps/api)
 */
import { readCollaudoKey, deriveCollaudoPassword } from "./collaudo-access.mjs";
import pg from "pg";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] ?? "https://www.heuresys.com/api";
const key = readCollaudoKey();

/* Il file d'ambiente di radice dichiara la topologia per-macchina: da Windows è il tunnel :5433. */
function envApi() {
  const out = {};
  for (const riga of readFileSync(join(QUI, "..", "..", "..", ".env"), "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(riga.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function login(email) {
  const r = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: deriveCollaudoPassword(key, email) }),
  });
  const corpo = await r.json().catch(() => ({}));
  const biscotti = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  return { status: r.status, cookie: biscotti, mfa: corpo.status === "mfa_required" };
}

const get = async (cookie, url) => {
  const r = await fetch(`${base}${url}`, { headers: { cookie } });
  return { status: r.status, corpo: await r.json().catch(() => ({})) };
};

let rosso = 0;
const esito = (ok, testo) => {
  if (!ok) rosso++;
  console.log(`  ${ok ? "ok  " : "ROSSO"}  ${testo}`);
};

console.log(`CHIUSURA-C2 — prova live su ${base}   (${new Date().toISOString()})`);

/* ── (a) D11: il DPO e il dossier mascherato ───────────────────────────────── */
console.log("\n(a) D11 — il DPO apre il dossier, con gli importi trattenuti e dichiarati");

const dpo = await login("dpo@collaudo.invalid");
esito(dpo.status === 200 && !dpo.mfa && dpo.cookie.length > 0,
      `login dpo@collaudo.invalid → ${dpo.status}${dpo.mfa ? " (mfa_required)" : ""}`);

const cfg = envApi();
const client = new pg.Client({
  host: cfg.POSTGRES_HOST, port: Number(cfg.POSTGRES_PORT ?? 5432),
  user: cfg.POSTGRES_USER, password: cfg.POSTGRES_PASSWORD, database: cfg.POSTGRES_DB,
});
await client.connect();
const { rows } = await client.query(
  `WITH RECURSIVE albero AS (
     SELECT organization_unit_id AS ou, 1 AS livello FROM sys.sys_organization_units
      WHERE organization_unit_parent_id IS NULL AND organization_unit_is_active
     UNION ALL
     SELECT o.organization_unit_id, a.livello + 1 FROM sys.sys_organization_units o
       JOIN albero a ON o.organization_unit_parent_id = a.ou WHERE o.organization_unit_is_active
   ),
   livelli AS (
     SELECT upa.user_position_assignment_user_id AS uid, min(a.livello) AS livello
       FROM albero a
       JOIN sys.sys_positions p ON p.position_organization_unit_id = a.ou
       JOIN sys.sys_user_position_assignments upa
            ON upa.user_position_assignment_position_id = p.position_id
           AND upa.user_position_assignment_status = 'ACTIVE'
      GROUP BY 1
   )
   SELECT u.user_id AS id, u.user_email AS email, l.livello,
          (SELECT count(*) FROM sys.sys_user_pay_slips ps WHERE ps.user_pay_slip_user_id = u.user_id) AS buste,
          (SELECT count(*) FROM sys.sys_performance_reviews pr WHERE pr.review_subject_user_id = u.user_id) AS valutazioni
     FROM sys.sys_users u
     LEFT JOIN livelli l ON l.uid = u.user_id
    WHERE u.user_status = 'ACTIVE'
      AND u.user_tenant_id = (SELECT user_tenant_id FROM sys.sys_users WHERE user_email = 'dpo@collaudo.invalid')
      AND u.user_email <> 'dpo@collaudo.invalid'
      AND l.livello > 2
      AND (SELECT count(*) FROM sys.sys_user_pay_slips ps WHERE ps.user_pay_slip_user_id = u.user_id) > 0
      AND (SELECT count(*) FROM sys.sys_performance_reviews pr WHERE pr.review_subject_user_id = u.user_id) > 0
    ORDER BY u.user_id LIMIT 1`,
);
await client.end();

esito(rows.length === 1, `un soggetto con buste e valutazioni, fuori dalla catena del DPO: ${rows.length === 1 ? `${rows[0].email} (buste ${rows[0].buste}, valutazioni ${rows[0].valutazioni}, livello ${rows[0].livello})` : "NESSUNO — la prova non guarda niente"}`);

if (rows.length === 1 && dpo.cookie) {
  const d = await get(dpo.cookie, `/v1/users/${rows[0].id}/dossier`);
  esito(d.status === 200, `GET /v1/users/${rows[0].id}/dossier → ${d.status}`);
  const buste = d.corpo.paySlips ?? [];
  const valutazioni = d.corpo.performanceReviews ?? d.corpo.evaluations ?? [];
  esito(buste.length > 0, `le buste arrivano come RIGHE: ${buste.length}`);
  const b0 = buste[0] ?? {};
  esito((b0.masked ?? []).includes("grossPay"),
        `la busta dichiara cosa e' stato trattenuto: masked=[${(b0.masked ?? []).join(", ")}]`);
  esito((b0.masked ?? []).every((c) => b0[c] === undefined),
        "ogni campo dichiarato in masked e' davvero ASSENTE dalla riga");
  const v0 = valutazioni[0] ?? {};
  esito(valutazioni.length === 0 || (v0.masked ?? []).length > 0,
        `la valutazione dichiara cosa e' stato trattenuto: masked=[${(v0.masked ?? []).join(", ")}]`);
}

/* ── (b) registro #30: i ruoli hanno permessi EFFETTIVI in produzione ──────── */
console.log("\n(b) registro #30 — PLATFORM_OPERATOR e SALES, permessi effettivi e perimetro");

const op = await login("platform-operator@collaudo.invalid");
esito(op.status === 200 && op.cookie.length > 0, `login platform-operator@collaudo.invalid → ${op.status}`);
if (op.cookie) {
  const h = await get(op.cookie, "/v1/observability/system-health");
  esito(h.status === 200, `PLATFORM_OPERATOR GET /v1/observability/system-health → ${h.status} (atteso 200)`);
  const l = await get(op.cookie, "/v1/leads");
  esito(l.status === 403, `PLATFORM_OPERATOR GET /v1/leads → ${l.status} (atteso 403 — la controprova)`);
}

const sales = await login("sales@collaudo.invalid");
esito(sales.status === 200 && sales.cookie.length > 0, `login sales@collaudo.invalid → ${sales.status}`);
if (sales.cookie) {
  const l = await get(sales.cookie, "/v1/leads");
  esito(l.status === 200, `SALES GET /v1/leads → ${l.status} (atteso 200)`);
  const h = await get(sales.cookie, "/v1/observability/system-health");
  esito(h.status === 403, `SALES GET /v1/observability/system-health → ${h.status} (atteso 403 — la controprova)`);
}

console.log(`\nVERDETTO: ${rosso === 0 ? "VERDE — tutte le asserzioni reggono" : `ROSSO — ${rosso} asserzioni fallite`}`);
process.exitCode = rosso === 0 ? 0 : 1;
