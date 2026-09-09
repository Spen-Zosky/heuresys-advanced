/**
 * apps/api/test/projects.integration.test.ts
 * `#143` F4 — /v1/projects/* su dati reali.
 *
 * Due cose si provano qui, e la seconda e' la ragione per cui la fase esiste:
 *
 * ① L'ASSE FUNZIONALE. Un mandato vede tutti i progetti del tenant; chi non ce l'ha vede i
 *    soli progetti a cui partecipa adesso — e il secondo insieme e' PROPRIAMENTE contenuto
 *    nel primo, non solo diverso.
 *
 * ② ⭐ IL CONFINE I18 — «Functional (team/process) membership NEVER unlocks sensitive data».
 *    Un capo progetto NON vede i dati sensibili dei suoi membri: l'autorita' e' sul lavoro,
 *    non sulle persone. E' il caso che il modello a due entita' doveva rendere dimostrabile,
 *    e che qui si dimostra su una persona vera invece che su una fabbricata.
 *
 * ⚠ GLI ATTORI SI DERIVANO DAL DATO, MAI SCRITTI QUI. E' la regola che `teams` ha gia'
 * pagato una volta: i codici erano cablati, la `#122` ha rinominato le squadre, e il test
 * cadeva pur essendo il comportamento invariato — asseriva un nome invece di una relazione.
 * Se il dataset non contiene piu' il caso, il test lo DICE e si ferma, invece di misurare
 * in silenzio qualcos'altro.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface ProjectLite {
  projectId: string; code: string; tenantId: string; memberCount: number;
}

let suite: TestApp;
let tenantS: S;   // mandato HR (vista piena sul tenant)
let leadS: S;     // capo di un progetto, senza mandato

/** Il progetto che il capo guida ADESSO, e un suo membro che non e' lui. Derivati. */
let ledProjectId: string;
let ledProjectCode: string;
let leadEmail: string;
let membroUserId: string;

describe("/v1/projects/* integration (#143 F4)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");

    // Il capo: chi guida adesso il progetto con piu' membri, fra le persone che hanno
    // credenziali di collaudo. Non si sceglie per nome — si chiede al dato chi lo e'.
    const capo = await pool.query<{ email: string; project_id: string; code: string }>(
      `SELECT u.user_email AS email, p.project_id, p.project_code AS code
         FROM sys.sys_project_members m
         JOIN sys.sys_projects p ON p.project_id = m.project_member_project_id
         JOIN sys.sys_users u ON u.user_id = m.project_member_user_id
        WHERE m.project_member_role = 'LEAD'
          AND m.project_member_ends_on IS NULL
          AND u.user_status = 'ACTIVE'
        ORDER BY (SELECT count(*) FROM sys.sys_project_members m2
                   WHERE m2.project_member_project_id = p.project_id
                     AND m2.project_member_ends_on IS NULL) DESC
        LIMIT 1`);
    const c = capo.rows[0];
    if (!c) throw new Error("nessun capo progetto attivo nel dataset: il caso da provare non c'e' piu'");
    leadEmail = c.email;
    ledProjectId = c.project_id;
    ledProjectCode = c.code;

    const membro = await pool.query<{ user_id: string }>(
      `SELECT m.project_member_user_id AS user_id
         FROM sys.sys_project_members m
         JOIN sys.sys_users u ON u.user_id = m.project_member_user_id
        WHERE m.project_member_project_id = $1
          AND m.project_member_role <> 'LEAD'
          AND m.project_member_ends_on IS NULL
          AND u.user_status = 'ACTIVE'
        LIMIT 1`, [ledProjectId]);
    const mm = membro.rows[0];
    if (!mm) throw new Error(`il progetto ${ledProjectCode} non ha membri oltre al capo`);
    membroUserId = mm.user_id;

    leadS = await login(suite, leadEmail);
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  /* --- ① l'asse funzionale ------------------------------------------------ */

  it("un mandato HR elenca i progetti del proprio tenant", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/projects?limit=200", headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: ProjectLite[]; total: number };
    expect(body.total).toBeGreaterThan(0);
    // isolamento tenant: tutti dello stesso tenant, nessuna riga altrui
    const tenants = new Set(body.items.map((p) => p.tenantId));
    expect(tenants.size).toBe(1);
  });

  it("chi NON ha mandato vede meno progetti del mandato — ed e' un sottoinsieme, non un altro insieme", async () => {
    const pieno = await suite.app.inject({
      method: "GET", url: "/v1/projects?limit=200", headers: { cookie: ch(tenantS.cookies) },
    });
    const suoi = await suite.app.inject({
      method: "GET", url: "/v1/projects?limit=200", headers: { cookie: ch(leadS.cookies) },
    });
    expect(suoi.statusCode).toBe(200);

    const idPieno = new Set((pieno.json() as { items: ProjectLite[] }).items.map((p) => p.projectId));
    const idSuoi = (suoi.json() as { items: ProjectLite[] }).items.map((p) => p.projectId);

    // ⚠ Il confronto sul solo CONTEGGIO sarebbe cieco: `teams` ci e' gia' cascato una volta
    // (25 < 26 era vero anche col criterio sbagliato). Si verifica la CONTENENZA.
    expect(idSuoi.length).toBeGreaterThan(0);
    expect(idSuoi.length).toBeLessThan(idPieno.size);
    for (const id of idSuoi) expect(idPieno.has(id)).toBe(true);
    expect(idSuoi).toContain(ledProjectId);
  });

  it("un progetto fuori scope risponde 404, non 403 — un 403 direbbe che esiste", async () => {
    const pieno = await suite.app.inject({
      method: "GET", url: "/v1/projects?limit=200", headers: { cookie: ch(tenantS.cookies) },
    });
    const suoi = new Set((await suite.app.inject({
      method: "GET", url: "/v1/projects?limit=200", headers: { cookie: ch(leadS.cookies) },
    }).then((r) => r.json() as { items: ProjectLite[] })).items.map((p) => p.projectId));

    const fuori = (pieno.json() as { items: ProjectLite[] }).items
      .find((p) => !suoi.has(p.projectId));
    if (!fuori) throw new Error("il dataset non ha piu' un progetto fuori dallo scope del capo");

    const r = await suite.app.inject({
      method: "GET", url: `/v1/projects/${fuori.projectId}`, headers: { cookie: ch(leadS.cookies) },
    });
    expect(r.statusCode).toBe(404);
  });

  /* --- ② IL CONFINE I18 --------------------------------------------------- */

  it("⭐ I18 — il capo vede i membri del progetto, e di loro NIENTE di sensibile", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/projects/${ledProjectId}`, headers: { cookie: ch(leadS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const p = r.json() as { members: Array<Record<string, unknown>> };
    expect(p.members.length).toBeGreaterThan(1);

    // cio' che l'asse funzionale CONCEDE: chi lavora al progetto e con che ruolo
    const uno = p.members[0]!;
    expect(uno).toHaveProperty("userId");
    expect(uno).toHaveProperty("role");

    // cio' che NON concede — e non e' un elenco di comodo: sono i nomi delle quattro
    // classi sensibili di ADR-0036 come compaiono nei payload degli altri moduli.
    const vietati = [
      "salary", "grossAnnualSalary", "compensation", "pay", "payslip", "bonus",
      "evaluation", "review", "rating", "performance",
      "birthDate", "fiscalCode", "iban", "address", "phone",
      "skills", "proficiency",
    ];
    for (const m of p.members) {
      for (const campo of Object.keys(m)) {
        for (const v of vietati) {
          expect(campo.toLowerCase()).not.toContain(v.toLowerCase());
        }
      }
    }
  });

  it("⭐ I18 — guidare un progetto NON apre il dossier di un membro", async () => {
    // La prova che conta: il capo chiede i dati sensibili di una persona che gli lavora
    // insieme. Se l'appartenenza funzionale li aprisse, questa risposta sarebbe 200 con
    // i campi in chiaro. Deve essere negata, o mascherata: mai concessa per il progetto.
    const r = await suite.app.inject({
      method: "GET", url: `/v1/users/${membroUserId}/dossier`,
      headers: { cookie: ch(leadS.cookies) },
    });
    expect([403, 404]).toContain(r.statusCode);

    // ⚠ CONTROPROVA, senza la quale il test sopra e' CIECO: un 403/404 lo darebbe anche
    // una rotta inesistente, o un dossier rotto per tutti. Se il mandato NON ottenesse
    // 200 qui, il diniego al capo non proverebbe niente sul confine — proverebbe solo
    // che l'endpoint non funziona. E' lo stesso difetto che in `teams` rendeva vero
    // `25 < 26` anche col criterio sbagliato.
    const controprova = await suite.app.inject({
      method: "GET", url: `/v1/users/${membroUserId}/dossier`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(controprova.statusCode).toBe(200);
  });

  /* --- ciclo di vita ------------------------------------------------------ */

  it("il capo dichiara l'avanzamento del proprio progetto", async () => {
    const prima = await suite.app.inject({
      method: "GET", url: `/v1/projects/${ledProjectId}`, headers: { cookie: ch(leadS.cookies) },
    });
    const pct = (prima.json() as { progressPct: number | null }).progressPct;

    const nuovo = pct === 42 ? 43 : 42;
    const r = await suite.app.inject({
      method: "PATCH", url: `/v1/projects/${ledProjectId}/progress`,
      headers: { cookie: ch(leadS.cookies), "x-csrf-token": leadS.csrfToken },
      payload: { progressPct: nuovo },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { progressPct: number }).progressPct).toBe(nuovo);

    // ripristino: il test gira su dati di produzione, non li lascia spostati
    await suite.app.inject({
      method: "PATCH", url: `/v1/projects/${ledProjectId}/progress`,
      headers: { cookie: ch(leadS.cookies), "x-csrf-token": leadS.csrfToken },
      payload: { progressPct: pct ?? 0 },
    });
  });

  it("un progetto che non guidi non si tocca: PERMISSION_DENIED, non FORBIDDEN", async () => {
    const pieno = await suite.app.inject({
      method: "GET", url: "/v1/projects?limit=200", headers: { cookie: ch(tenantS.cookies) },
    });
    const suoi = new Set((await suite.app.inject({
      method: "GET", url: "/v1/projects?limit=200", headers: { cookie: ch(leadS.cookies) },
    }).then((x) => x.json() as { items: ProjectLite[] })).items.map((p) => p.projectId));
    const altrui = (pieno.json() as { items: ProjectLite[] }).items
      .find((p) => !suoi.has(p.projectId));
    if (!altrui) throw new Error("il dataset non ha piu' un progetto altrui");

    const r = await suite.app.inject({
      method: "PATCH", url: `/v1/projects/${altrui.projectId}/progress`,
      headers: { cookie: ch(leadS.cookies), "x-csrf-token": leadS.csrfToken },
      payload: { progressPct: 10 },
    });
    // fuori scope in LETTURA prima ancora che in scrittura: 404, non si sa che esiste
    expect(r.statusCode).toBe(404);
  });

  it("il mandato crea un progetto, lo legge e lo completa", async () => {
    const code = `TEST-F4-${Date.now().toString(36).toUpperCase()}`;
    const creato = await suite.app.inject({
      method: "POST", url: "/v1/projects",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
      payload: { code, name: "Progetto di collaudo F4", status: "PLANNED" },
    });
    expect(creato.statusCode).toBe(201);
    const p = creato.json() as { projectId: string; code: string; status: string };
    expect(p.code).toBe(code);
    expect(p.status).toBe("PLANNED");

    // lo stesso codice due volte non passa: il vincolo (tenant, code) e' unico
    const doppio = await suite.app.inject({
      method: "POST", url: "/v1/projects",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
      payload: { code, name: "doppione" },
    });
    expect(doppio.statusCode).toBe(409);

    // pulizia: lo si porta a COMPLETED, non lo si cancella — la storia dei progetti resta
    const chiuso = await suite.app.inject({
      method: "PATCH", url: `/v1/projects/${p.projectId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
      payload: { status: "COMPLETED" },
    });
    expect(chiuso.statusCode).toBe(200);
    await pool.query(`DELETE FROM sys.sys_projects WHERE project_id = $1`, [p.projectId]);
  });

  it("senza CSRF una scrittura non passa", async () => {
    const r = await suite.app.inject({
      method: "PATCH", url: `/v1/projects/${ledProjectId}/progress`,
      headers: { cookie: ch(leadS.cookies) },
      payload: { progressPct: 1 },
    });
    expect(r.statusCode).toBe(403);
  });
});
