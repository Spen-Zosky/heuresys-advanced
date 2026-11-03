import { describe, expect, it } from "vitest";
import { pageVerdict, routeContains, type RouteAccess } from "./page-guard";

const ROUTES: RouteAccess[] = [
  { route: "/me", allowed: true },
  { route: "/users", allowed: false },
  { route: "/admin/roles", allowed: false },
  { route: "/admin/mfa-policy", allowed: true },
  { route: "/analytics/skills", allowed: true },
  { route: "/analytics/skills-by-category", allowed: false },
  { route: "/system-health", allowed: false },
  { route: "/system-health", allowed: true },
  { route: "/analytics/compensation", allowed: false },
];
const TABS = [["/analytics/compensation", "/compensation-intelligence"], ["/recruiting", "/recruiting/postings"]];

describe("routeContains", () => {
  it("rispetta il confine di segmento", () => {
    expect(routeContains("/analytics/skills", "/analytics/skills")).toBe(true);
    expect(routeContains("/analytics/skills", "/analytics/skills/x")).toBe(true);
    expect(routeContains("/analytics/skills", "/analytics/skills-by-category")).toBe(false);
    expect(routeContains("/", "/me")).toBe(false);
  });
});

describe("pageVerdict", () => {
  it("apre una pagina del proprio menu e le sue sotto-pagine", () => {
    expect(pageVerdict("/me", ROUTES).kind).toBe("allowed");
    expect(pageVerdict("/me/security", ROUTES).kind).toBe("allowed");
  });

  it("nega una pagina del registro che non spetta, anche nel dettaglio", () => {
    expect(pageVerdict("/users", ROUTES)).toEqual({ kind: "denied", route: "/users" });
    expect(pageVerdict("/users/0000-1111", ROUTES)).toEqual({ kind: "denied", route: "/users" });
  });

  it("vince la rotta più lunga", () => {
    expect(pageVerdict("/analytics/skills-by-category", ROUTES).kind).toBe("denied");
    expect(pageVerdict("/analytics/skills", ROUTES).kind).toBe("allowed");
  });

  it("basta una riga aperta per la stessa rotta", () => {
    expect(pageVerdict("/system-health", ROUTES).kind).toBe("allowed");
  });

  it("tratta la barra finale come la stessa pagina (D-25)", () => {
    expect(pageVerdict("/admin/mfa-policy/", ROUTES).kind).toBe("allowed");
    expect(pageVerdict("/admin/roles/", ROUTES).kind).toBe("denied");
  });

  it("una scheda senza riga segue la pagina principale del gruppo", () => {
    expect(pageVerdict("/compensation-intelligence", ROUTES, TABS)).toEqual({
      kind: "denied",
      route: "/analytics/compensation",
    });
    expect(pageVerdict("/recruiting/postings", ROUTES, TABS)).toEqual({ kind: "allowed", route: null });
  });

  it("lascia aperto ciò che il registro non conosce", () => {
    expect(pageVerdict("/qualcosa-di-nuovo", ROUTES)).toEqual({ kind: "allowed", route: null });
  });
});
