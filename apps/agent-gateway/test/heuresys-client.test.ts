/**
 * Mock-first unit tests for the /v1 client (#9 WI-B). SDK-free + no live heuresys:
 * a mock fetch asserts CSRF double-submit on writes, no CSRF on reads, tenant never
 * in a header, and single-flight refresh on 401 (M-5).
 */
import { describe, it, expect } from "vitest";
import { HeuresysClient, INTESTAZIONE_ORIGINE, chiSei, chiediGettoneAgente, type FetchLike, type Session } from "../src/heuresys-client.js";

const session: Session = {
  cookieAccess: "ACCESS",
  cookieCsrf: "CT",
  csrf: "CT",
  cookieRefresh: "REFRESH",
};

function recordingFetch(handler: (url: string, init: { method: string; headers: Record<string, string> }) => { ok: boolean; status: number; body?: unknown }) {
  const calls: Array<{ url: string; method: string; headers: Record<string, string> }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers });
    const r = handler(url, init);
    return {
      ok: r.ok,
      status: r.status,
      json: async () => r.body ?? {},
      text: async () => JSON.stringify(r.body ?? {}),
    };
  };
  return { fetchImpl, calls };
}

describe("HeuresysClient auth/CSRF", () => {
  it("sends the session cookie and NO csrf header on reads, never a tenant header", async () => {
    const { fetchImpl, calls } = recordingFetch(() => ({ ok: true, status: 200, body: { items: [] } }));
    const c = new HeuresysClient({ baseUrl: "http://api", session, fetchImpl });
    await c.call("GET", "/organization-units");
    expect(calls[0]!.headers["cookie"]).toContain("hrx_access=ACCESS");
    expect(calls[0]!.headers["x-csrf-token"]).toBeUndefined();
    expect(Object.keys(calls[0]!.headers).some((h) => /tenant/i.test(h))).toBe(false);
  });

  it("sends the CSRF double-submit on writes", async () => {
    const { fetchImpl, calls } = recordingFetch(() => ({ ok: true, status: 201, body: { id: "1" } }));
    const c = new HeuresysClient({ baseUrl: "http://api", session, fetchImpl });
    await c.call("POST", "/skills", { name: "x" });
    expect(calls[0]!.headers["x-csrf-token"]).toBe("CT");
    expect(calls[0]!.headers["cookie"]).toContain("hrx_csrf=CT");
  });

  it("F0-3: dichiara la superficie agente su ogni chiamata, così l'API la conta come agente", async () => {
    const { fetchImpl, calls } = recordingFetch(() => ({ ok: true, status: 200, body: {} }));
    const c = new HeuresysClient({ baseUrl: "http://api", session, fetchImpl });
    await c.call("GET", "/positions");
    await c.call("POST", "/goals", { title: "x" });
    expect(calls.map((x) => x.headers["x-heuresys-superficie"])).toEqual(["agente:assistente-hr", "agente:assistente-hr"]);

    const altro = recordingFetch(() => ({ ok: true, status: 200, body: {} }));
    const c2 = new HeuresysClient({ baseUrl: "http://api", session, fetchImpl: altro.fetchImpl, agente: "consolidamento" });
    await c2.call("GET", "/positions");
    expect(altro.calls[0]!.headers["x-heuresys-superficie"]).toBe("agente:consolidamento");
  });

  it("refreshes once on 401 then retries (single-flight, M-5)", async () => {
    let first = true;
    const { fetchImpl, calls } = recordingFetch((url) => {
      if (url.endsWith("/v1/auth/refresh")) return { ok: true, status: 200, body: {} };
      if (first) {
        first = false;
        return { ok: false, status: 401, body: {} };
      }
      return { ok: true, status: 200, body: { ok: true } };
    });
    const c = new HeuresysClient({ baseUrl: "http://api", session, fetchImpl });
    const out = await c.call<{ ok: boolean }>("GET", "/positions");
    expect(out).toEqual({ ok: true });
    const refreshCalls = calls.filter((x) => x.url.endsWith("/v1/auth/refresh"));
    expect(refreshCalls.length).toBe(1); // exactly one refresh
  });

  it("throws on a non-401 error status", async () => {
    const { fetchImpl } = recordingFetch(() => ({ ok: false, status: 403, body: {} }));
    const c = new HeuresysClient({ baseUrl: "http://api", session, fetchImpl });
    await expect(c.call("GET", "/positions")).rejects.toThrow(/403/);
  });
});

describe("L9 A-1/A-3 — il gettone dell'agente", () => {
  it("lo chiede con i cookie e il CSRF della persona, e la sessione che ne esce non si rinnova", async () => {
    const { fetchImpl, calls } = recordingFetch(() => ({
      ok: true,
      status: 201,
      body: {
        token: "GETTONE",
        expiresAt: "2026-11-05T10:00:00.000Z",
        userId: "11111111-1111-4111-8111-111111111111",
        tenantCode: "RTL_BANK",
      },
    }));
    const esito = await chiediGettoneAgente(
      "http://api/",
      { cookieAccess: "PERSONA", cookieCsrf: "CT" },
      { agentCode: "assistente-hr", task: "prova", permissions: ["approval:read"] },
      fetchImpl,
    );
    expect(calls[0]!.url).toBe("http://api/v1/auth/agent-tokens");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.headers["cookie"]).toContain("hrx_access=PERSONA");
    expect(calls[0]!.headers["x-csrf-token"]).toBe("CT");
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.session.cookieAccess).toBe("GETTONE");
    expect(esito.session.cookieRefresh).toBeUndefined();
    // A-12: il diario saprà per conto di chi e in quale tenant.
    expect(esito.persona).toEqual({ userId: "11111111-1111-4111-8111-111111111111", tenantCode: "RTL_BANK" });

    // A-3: scaduto il gettone, il client non rinnova: un 401 resta un 401, con una sola chiamata.
    const dopo = recordingFetch(() => ({ ok: false, status: 401 }));
    const c = new HeuresysClient({ baseUrl: "http://api", session: esito.session, fetchImpl: dopo.fetchImpl });
    await expect(c.call("GET", "/approvals")).rejects.toThrow(/401/);
    expect(dopo.calls.map((x) => x.url)).toEqual(["http://api/v1/approvals"]);
  });

  it("restituisce il rifiuto dell'API invece di proseguire con i cookie della persona", async () => {
    const { fetchImpl } = recordingFetch(() => ({ ok: false, status: 403, body: { code: "AGENT_NO_ROLES" } }));
    const esito = await chiediGettoneAgente("http://api", { cookieAccess: "P", cookieCsrf: "CT" }, { agentCode: "a", task: "prova" }, fetchImpl);
    expect(esito).toEqual({ ok: false, status: 403, corpo: { code: "AGENT_NO_ROLES" } });
  });
});

describe("A-14 — l'origine del dato dichiarata dall'API", () => {
  it("resta legata alla risposta: origineDi la ritrova, e senza intestazione non c'è", async () => {
    let n = 0;
    const fetchImpl: FetchLike = async () => {
      n += 1;
      const conOrigine = n === 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [n] }),
        text: async () => "",
        headers: { get: (h: string) => (conOrigine && h === INTESTAZIONE_ORIGINE ? "importato" : null) },
      };
    };
    const c = new HeuresysClient({ baseUrl: "http://api", session, fetchImpl });
    const prima = await c.call("GET", "/me/pay-slips");
    const seconda = await c.call("GET", "/me/profile");
    expect(c.origineDi(prima)).toBe("importato");
    expect(c.origineDi(seconda)).toBeUndefined();
    expect(c.origineDi(null)).toBeUndefined();
  });
});


describe("chiSei: chi decide un'approvazione lo dice l'API (ADR-0056 T3)", () => {
  it("chiede /v1/auth/me con i cookie di chi ha premuto e restituisce la persona", async () => {
    const { fetchImpl, calls } = recordingFetch(() => ({ ok: true, status: 200, body: { userId: "u-1" } }));
    await expect(chiSei("http://api/", { cookieAccess: "PERSONA" }, fetchImpl)).resolves.toBe("u-1");
    expect(calls[0]!.url).toBe("http://api/v1/auth/me");
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.headers["cookie"]).toBe("hrx_access=PERSONA");
  });

  it("una sessione rifiutata, una risposta senza persona o un'API che non risponde non sono nessuno", async () => {
    const rifiuto = recordingFetch(() => ({ ok: false, status: 401 }));
    await expect(chiSei("http://api", { cookieAccess: "X" }, rifiuto.fetchImpl)).resolves.toBeUndefined();
    const vuota = recordingFetch(() => ({ ok: true, status: 200, body: {} }));
    await expect(chiSei("http://api", { cookieAccess: "X" }, vuota.fetchImpl)).resolves.toBeUndefined();
    const guasto: FetchLike = async () => { throw new Error("ECONNREFUSED"); };
    await expect(chiSei("http://api", { cookieAccess: "X" }, guasto)).resolves.toBeUndefined();
  });
});
