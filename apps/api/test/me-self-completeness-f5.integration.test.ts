/**
 * apps/api/test/me-self-completeness-f5.integration.test.ts
 *
 * #99 F5 — COMPLETEZZA DI `self` (I17 / C4): le quattro superfici costruite in S1061.
 *
 * Il censimento meccanico di `docs/kb/tools/check_completezza_self.py` dava 22 tabelle
 * SCOPERTE: descrivono una persona, sono popolate, e nessuna rotta gliele faceva leggere.
 * Diciotto sono state escluse con motivo; quattro dovevano diventare raggiungibili:
 *
 *   sys_mentorships          i rapporti di mentoring REALI (il portale mostrava solo i
 *                            suggerimenti di abbinamento: chi *potrei* avere, non chi ho)
 *   sys_process_participants i processi a cui partecipo — 845 righe che NESSUN modulo API
 *                            leggeva, non solo il portale personale (#79)
 *   sys_skill_gap_scores     il punteggio algoritmico calcolato su di me
 *   sys_kpi_targets          il bersaglio assegnato: la persona vedeva a che punto era,
 *                            senza vedere dove doveva arrivare
 *
 * ⚠ Le persone NON sono cablate: si derivano dal database con la stessa domanda a cui la
 * rotta risponde. Un'email scritta a mano qui duplicherebbe una fonte di verità e
 * mentirebbe il giorno che i dati cambiano.
 *
 * La prova è contro la PORTA HTTP, non contro il repository: `z.object()` scarta in uscita
 * le chiavi che lo schema non dichiara, in silenzio e senza errori — un test fermo al
 * repository sarebbe verde con la superficie ancora vuota. È la lezione di #99 F4.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";
import { loginRaw } from "./helpers/login.js";

let t: TestApp;

/** Una persona scelta dal dato, con quanti ne deve vedere. */
interface Soggetto { email: string; attesi: number }

let conMentorship: Soggetto | null = null;
/** Chi sta dal lato MENTORE. Serve un soggetto suo: misurato, nessuno è mentore e allievo
 *  insieme, quindi un solo soggetto copre un lato solo — e il filtro dell'altro potrebbe
 *  sparire senza che nulla diventi rosso. È esattamente cosa è successo: il primo
 *  sabotaggio del lato mentore NON fu colto, e la prova che non sa fallire non è una prova. */
let comeMentore: Soggetto | null = null;
let conProcessi: Soggetto | null = null;
let conPunteggio: Soggetto | null = null;
let conBersaglio: Soggetto | null = null;

async function scegli(sql: string): Promise<Soggetto | null> {
  const r = await pool.query<{ email: string; n: string }>(sql);
  const riga = r.rows[0];
  return riga ? { email: riga.email, attesi: Number(riga.n) } : null;
}

async function entra(email: string): Promise<string> {
  const login = await loginRaw(t.app, email);
  return (login.cookies as { name: string; value: string }[])
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

beforeAll(async () => {
  t = await buildTestApp();

  conMentorship = await scegli(
    `SELECT u.user_email AS email, count(*)::text AS n
       FROM sys.sys_users u
       JOIN sys.sys_mentorships m
         ON m.mentorship_mentor_user_id = u.user_id OR m.mentorship_mentee_user_id = u.user_id
      WHERE u.user_status = 'ACTIVE' AND m.mentorship_tenant_id = u.user_tenant_id
      GROUP BY 1 ORDER BY 2 DESC LIMIT 1`,
  );
  comeMentore = await scegli(
    `SELECT u.user_email AS email, count(*)::text AS n
       FROM sys.sys_users u
       JOIN sys.sys_mentorships m ON m.mentorship_mentor_user_id = u.user_id
      WHERE u.user_status = 'ACTIVE' AND m.mentorship_tenant_id = u.user_tenant_id
      GROUP BY 1 ORDER BY 2 DESC LIMIT 1`,
  );
  conProcessi = await scegli(
    `SELECT u.user_email AS email, count(*)::text AS n
       FROM sys.sys_users u
       JOIN sys.sys_process_participants p
         ON p.process_participant_user_id = u.user_id AND p.process_participant_tenant_id = u.user_tenant_id
      WHERE u.user_status = 'ACTIVE'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 1`,
  );
  conPunteggio = await scegli(
    `SELECT u.user_email AS email, count(*)::text AS n
       FROM sys.sys_users u
       JOIN sys.sys_skill_gap_scores s
         ON s.skill_gap_score_user_id = u.user_id AND s.skill_gap_score_tenant_id = u.user_tenant_id
      WHERE u.user_status = 'ACTIVE'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 1`,
  );
  // Il bersaglio esce solo se il KPI e' ANCHE fra i requisiti della posizione occupata:
  // e' la giunzione da cui parte /v1/me/kpis. Sceglierlo senza questa condizione darebbe
  // una persona con dei target e `assignedTarget` null ovunque — un verde che non prova
  // nulla.
  //
  // ⚠ Si contano i KPI DISTINTI, non le righe di `sys_kpi_targets`: la rotta restituisce
  // una riga per requisito di posizione e vi appende UN bersaglio, il periodo piu'
  // recente. Misurato su chi ne ha di piu': 3 righe di target ma 2 KPI distinti — due
  // periodi sullo stesso indicatore. Contare le righe faceva fallire il test su un
  // comportamento corretto, ed e' l'atteso a essere stato corretto, non il codice.
  conBersaglio = await scegli(
    `SELECT u.user_email AS email, count(DISTINCT kt.kpi_target_kpi_id)::text AS n
       FROM sys.sys_users u
       JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = u.user_id
        AND a.user_position_assignment_status = 'ACTIVE'
        AND a.user_position_assignment_kind = 'PRIMARY'
       JOIN sys.sys_position_kpi_requirements pkr
         ON pkr.position_id = a.user_position_assignment_position_id
       JOIN sys.sys_kpi_targets kt
         ON kt.kpi_target_user_id = u.user_id AND kt.kpi_target_kpi_id = pkr.kpi_definition_id
      WHERE u.user_status = 'ACTIVE'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 1`,
  );
}, 60_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#99 F5 — le quattro superfici self che mancavano", () => {
  it("gira su un universo dove PUÒ fallire: le quattro famiglie hanno soggetti reali", () => {
    expect(conMentorship, "nessuno ha rapporti di mentoring: la prova non guarderebbe nulla").not.toBeNull();
    expect(comeMentore, "nessuno è mentore: il lato mentore non sarebbe verificabile").not.toBeNull();
    expect(conProcessi, "nessuno partecipa a processi").not.toBeNull();
    expect(conPunteggio, "nessuno ha un punteggio di divario").not.toBeNull();
    expect(conBersaglio, "nessuno ha un bersaglio KPI sui requisiti della propria posizione").not.toBeNull();
  });

  it("/v1/me/mentorships — i rapporti REALI, dai due lati, quanti il DB ne conta", async () => {
    const s = conMentorship!;
    const r = await t.app.inject({
      method: "GET", url: "/v1/me/mentorships", headers: { cookie: await entra(s.email) },
    });
    expect(r.statusCode, `${r.statusCode} ${r.body.slice(0, 200)}`).toBe(200);

    const body = r.json() as { items: { role: string; counterpartUserId: string | null }[]; total: number };
    expect(body.total, "il portale non mostra tutti i rapporti che il database gli attribuisce").toBe(s.attesi);
    for (const m of body.items) {
      expect(["MENTOR", "MENTEE"]).toContain(m.role);
      // La controparte non è mai la persona stessa: se lo fosse, il CASE che sceglie il
      // lato sarebbe invertito e la superficie mostrerebbe a ognuno se stesso.
      expect(m.counterpartUserId, "la controparte manca: il join sul lato opposto non regge").toBeDefined();
    }
  });

  it("/v1/me/mentorships — anche dal lato MENTORE, non solo da quello dell'allievo", async () => {
    // Il caso che manca a un test scritto su un soggetto solo. Senza questo, togliere
    // `mentorship_mentor_user_id = $1` dalla WHERE resta verde: chi guida qualcuno smette
    // di vederlo e nessuno se ne accorge.
    const s = comeMentore!;
    const r = await t.app.inject({
      method: "GET", url: "/v1/me/mentorships", headers: { cookie: await entra(s.email) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { role: string }[]; total: number };
    expect(body.total, "chi è mentore non vede i rapporti che guida").toBe(s.attesi);
    expect(
      body.items.every((m) => m.role === "MENTOR"),
      "un rapporto guidato esce col ruolo sbagliato: il CASE che sceglie il lato è invertito",
    ).toBe(true);
  });

  it("/v1/me/processes — i processi a cui partecipo, che nessun modulo leggeva", async () => {
    const s = conProcessi!;
    const r = await t.app.inject({
      method: "GET", url: "/v1/me/processes", headers: { cookie: await entra(s.email) },
    });
    expect(r.statusCode, `${r.statusCode} ${r.body.slice(0, 200)}`).toBe(200);

    const body = r.json() as { items: { role: string; processName: string | null }[]; total: number };
    expect(body.total, "le partecipazioni esposte non sono quelle registrate").toBe(s.attesi);
    expect(body.items.every((p) => typeof p.role === "string" && p.role.length > 0),
      "una partecipazione esce senza ruolo").toBe(true);
  });

  it("/v1/me/skill-gap-scores — col MODELLO e la DATA, non il punteggio nudo", async () => {
    const s = conPunteggio!;
    const r = await t.app.inject({
      method: "GET", url: "/v1/me/skill-gap-scores", headers: { cookie: await entra(s.email) },
    });
    expect(r.statusCode, `${r.statusCode} ${r.body.slice(0, 200)}`).toBe(200);

    const body = r.json() as {
      items: { score: string | null; modelVersion: string | null; computedAt: string | null }[];
      total: number;
    };
    expect(body.total).toBe(s.attesi);
    // La prescrizione di Enzo (2026-08-04) per le predizioni, applicata qui: un punteggio
    // senza sapere chi e quando l'ha calcolato non è una spiegazione, è un verdetto.
    for (const p of body.items) {
      expect(p.computedAt, "il punteggio esce senza la data del calcolo").not.toBeNull();
      expect("modelVersion" in p, "il campo `modelVersion` non è arrivato al client").toBe(true);
    }
  });

  it("/v1/me/kpis — ora dice anche DOVE dovevo arrivare, non solo a che punto sono", async () => {
    const s = conBersaglio!;
    const r = await t.app.inject({
      method: "GET", url: "/v1/me/kpis", headers: { cookie: await entra(s.email) },
    });
    expect(r.statusCode, `${r.statusCode} ${r.body.slice(0, 200)}`).toBe(200);

    const body = r.json() as {
      items: { kpiName: string; assignedTarget: { periodEnd: string; targetValue: string | null } | null }[];
    };
    expect(body.items.length, "questa persona non ha KPI di posizione: la prova è cieca").toBeGreaterThan(0);

    const conBers = body.items.filter((k) => k.assignedTarget !== null);
    expect(
      conBers.length,
      "`assignedTarget` è null su ogni riga: il bersaglio assegnato non arriva al client",
    ).toBe(s.attesi);
    for (const k of conBers) {
      expect(k.assignedTarget!.periodEnd, "un bersaglio senza periodo non dice a quando si riferisce").toBeTruthy();
    }
  });

  it("I17 — il pavimento vale per il ruolo BASE, non solo per chi ha mandati", async () => {
    // Una persona senza alcun MANDATO deve raggiungere le quattro superfici: se
    // rispondessero 403 a chi non dirige nessuno, sarebbero costruite e inaccessibili
    // proprio a chi il pavimento ESS esiste per proteggere.
    //
    // ⚠ La prima stesura cercava «il solo ruolo USER» e non trovava nessuno: misurato,
    // tutte e 161 le persone hanno `USER` e 152 hanno ANCHE `TEAM_MEMBER`, che non è un
    // mandato ma un'appartenenza. Cercare un caso che il dato non contiene non è una
    // prova severa: è una prova cieca, e sarebbe rimasta rossa per sempre.
    const r = await pool.query<{ email: string }>(
      `SELECT u.user_email AS email
         FROM sys.sys_users u
        WHERE u.user_status = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM sys.sys_user_auth_roles ur
              JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
             WHERE ur.user_auth_role_user_id = u.user_id
               AND ur.user_auth_role_revoked_at IS NULL
               AND r.auth_role_code NOT IN ('USER', 'TEAM_MEMBER'))
        LIMIT 1`,
    );
    const email = r.rows[0]?.email;
    if (!email) throw new Error("nessuna persona priva di mandati: il pavimento non è verificabile");

    const cookie = await entra(email);
    for (const url of ["/v1/me/mentorships", "/v1/me/processes", "/v1/me/skill-gap-scores", "/v1/me/kpis"]) {
      const res = await t.app.inject({ method: "GET", url, headers: { cookie } });
      expect(res.statusCode, `${url} risponde ${res.statusCode} al ruolo base: I17 non regge`).toBe(200);
    }
  });
});
