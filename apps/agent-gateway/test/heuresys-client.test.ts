/**
 * Mock-first unit tests for the /v1 client (#9 WI-B). SDK-free + no live heuresys:
 * a mock fetch asserts CSRF double-submit on writes, no CSRF on reads, tenant never
 * in a header, and single-flight refresh on 401 (M-5).
 */
import { describe, it, expect } from "vitest";
import { HeuresysClient, type FetchLike, type Session } from "../src/heuresys-client.js";

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
