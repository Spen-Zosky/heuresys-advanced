/**
 * apps/api/test/review-cycles-write.integration.test.ts — #92 F4.
 *
 * LA MACCHINA A STATI, PROVATA DOVE VIENE FATTA RISPETTARE.
 *
 * Il programma chiede «un test per OGNI transizione illegale». Sono 7 stati, quindi 42
 * coppie diverse da sé stesse, di cui 9 legali e **33 illegali**: scriverle a mano
 * significherebbe dimenticarne qualcuna e, peggio, non accorgersene mai. Qui si generano
 * dalla dichiarazione — se domani una transizione entra o esce da
 * `REVIEW_CYCLE_TRANSITIONS`, l'insieme dei casi si aggiorna da sé.
 *
 * Le prove girano sul database vero dentro la transazione del file (tx-isolation), su
 * cicli creati qui e rollbackati alla fine. Login reale, permesso reale.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";
import {
  REVIEW_CYCLE_STATUSES,
  REVIEW_CYCLE_TRANSITIONS,
  type ReviewCycleStatus,
} from "@heuresys/shared";

const HR_EMAIL = "federica.marchetti@rtl-bank.org";
const PREFISSO = `IT_F4_${randomUUID().slice(0, 8).toUpperCase()}`;

let t: TestApp;
let cookie = "";
let csrf = "";

/** Tutte le coppie (da → a) che la macchina NON prevede. */
const ILLEGALI: Array<[ReviewCycleStatus, ReviewCycleStatus]> = [];
for (const da of REVIEW_CYCLE_STATUSES) {
  for (const a of REVIEW_CYCLE_STATUSES) {
    if (da !== a && !REVIEW_CYCLE_TRANSITIONS[da].includes(a)) ILLEGALI.push([da, a]);
  }
}

async function creaCiclo(codice: string): Promise<string> {
  const r = await t.app.inject({
    method: "POST",
    url: "/v1/review-cycles",
    headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" },
    payload: {
      code: codice,
      name: `Ciclo di prova ${codice}`,
      type: "ANNUAL",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
    },
  });
  expect(r.statusCode).toBe(201);
  return (r.json() as { reviewCycleId: string }).reviewCycleId;
}

async function porta(id: string, a: ReviewCycleStatus) {
  return t.app.inject({
    method: "POST",
    url: `/v1/review-cycles/${id}/transition`,
    headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" },
    payload: { to: a },
  });
}

/** Porta un ciclo nuovo fino allo stato voluto, passando solo per transizioni legali. */
async function cicloNelloStato(stato: ReviewCycleStatus, codice: string): Promise<string> {
  const id = await creaCiclo(codice);
  if (stato === "DRAFT") return id;
  const percorso: Record<ReviewCycleStatus, ReviewCycleStatus[]> = {
    DRAFT: [],
    SELF_ASSESSMENT: ["SELF_ASSESSMENT"],
    MANAGER_REVIEW: ["SELF_ASSESSMENT", "MANAGER_REVIEW"],
    CALIBRATION: ["SELF_ASSESSMENT", "MANAGER_REVIEW", "CALIBRATION"],
    FINALIZED: ["SELF_ASSESSMENT", "MANAGER_REVIEW", "CALIBRATION", "FINALIZED"],
    SHARED: ["SELF_ASSESSMENT", "MANAGER_REVIEW", "CALIBRATION", "FINALIZED", "SHARED"],
    CANCELLED: ["CANCELLED"],
  };
  for (const passo of percorso[stato]) {
    const r = await porta(id, passo);
    expect(r.statusCode).toBe(200);
  }
  return id;
}

beforeAll(async () => {
  t = await buildTestApp();
  const r = await loginRaw(t.app, HR_EMAIL);
  cookie = r.cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join("; ");
  csrf = (r.json() as { csrfToken: string }).csrfToken;
}, 60_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#92 F4 — cicli di valutazione: scrittura e macchina a stati", () => {
  it("gira su un universo dove PUÒ fallire: ci sono transizioni illegali da provare", () => {
    // 7 stati → 42 coppie diverse da sé, 9 legali dichiarate, 33 illegali.
    expect(ILLEGALI.length).toBe(33);
    expect(Object.values(REVIEW_CYCLE_TRANSITIONS).flat().length).toBe(9);
  });

  it("un ciclo nasce in DRAFT — lo stato iniziale non lo sceglie il client", async () => {
    const r = await t.app.inject({
      method: "POST",
      url: "/v1/review-cycles",
      headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" },
      payload: {
        code: `${PREFISSO}_NASCITA`,
        name: "Ciclo appena nato",
        type: "ANNUAL",
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        // anche dichiarando uno stato, il contratto non lo prevede e il servizio impone DRAFT
        status: "FINALIZED",
      },
    });
    expect(r.statusCode).toBe(201);
    expect((r.json() as { status: string }).status).toBe("DRAFT");
  });

  it("il periodo che finisce prima di cominciare è respinto", async () => {
    const r = await t.app.inject({
      method: "POST",
      url: "/v1/review-cycles",
      headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" },
      payload: {
        code: `${PREFISSO}_ROVESCIO`,
        name: "Periodo rovesciato",
        type: "ANNUAL",
        periodStart: "2026-12-31",
        periodEnd: "2026-01-01",
      },
    });
    expect(r.statusCode).toBe(400);
  });

  it("due cicli con lo stesso codice nello stesso tenant → 409", async () => {
    const codice = `${PREFISSO}_DOPPIO`;
    await creaCiclo(codice);
    const r = await t.app.inject({
      method: "POST",
      url: "/v1/review-cycles",
      headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" },
      payload: {
        code: codice, name: "Doppione", type: "ANNUAL",
        periodStart: "2026-01-01", periodEnd: "2026-12-31",
      },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("REVIEW_CYCLE_CODE_CONFLICT");
  });

  it("la progressione intera è percorribile: DRAFT → … → SHARED", async () => {
    const id = await cicloNelloStato("SHARED", `${PREFISSO}_PERCORSO`);
    const r = await t.app.inject({
      method: "GET",
      url: `/v1/review-cycles/${id}`,
      headers: { cookie },
    });
    expect((r.json() as { status: string }).status).toBe("SHARED");
  });

  it("senza CSRF la scrittura non passa, anche col permesso giusto", async () => {
    const r = await t.app.inject({
      method: "POST",
      url: "/v1/review-cycles",
      headers: { cookie, "content-type": "application/json" },
      payload: {
        code: `${PREFISSO}_NOCSRF`, name: "Senza CSRF", type: "ANNUAL",
        periodStart: "2026-01-01", periodEnd: "2026-12-31",
      },
    });
    expect(r.statusCode).toBe(403);
  });

  /* ─────────────────────────────────────────────────────────────────────────
   * Il cuore: OGNI transizione illegale, generata dalla dichiarazione.
   * ──────────────────────────────────────────────────────────────────────── */
  describe("ogni transizione NON prevista viene rifiutata", () => {
    it.each(ILLEGALI)("%s → %s è rifiutata con 409", async (da, a) => {
      const id = await cicloNelloStato(da, `${PREFISSO}_${da}_${a}`.slice(0, 60));
      const r = await porta(id, a);
      expect(r.statusCode).toBe(409);
      const body = r.json() as { error: { code: string; message: string } };
      expect(body.error.code).toBe("REVIEW_CYCLE_TRANSITION_ILLEGAL");
      // il messaggio dice cosa si POTEVA fare: un rifiuto muto costringe a indovinare
      if (REVIEW_CYCLE_TRANSITIONS[da].length === 0) {
        expect(body.error.message).toContain("terminale");
      } else {
        expect(body.error.message).toContain(REVIEW_CYCLE_TRANSITIONS[da][0]!);
      }
    }, 30_000);
  });

  it("ripetere lo stato in cui si è già → 409 dedicato, non un falso avanzamento", async () => {
    const id = await cicloNelloStato("SELF_ASSESSMENT", `${PREFISSO}_STESSO`);
    const r = await porta(id, "SELF_ASSESSMENT");
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("REVIEW_CYCLE_ALREADY_IN_STATE");
  });
});
