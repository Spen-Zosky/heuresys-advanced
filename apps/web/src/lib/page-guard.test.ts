import { describe, expect, it } from "vitest";
import { chiaviNomePaginaNegata, pageVerdict, permessiGuardiaScheda, routeContains, type RouteAccess } from "./page-guard";

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

// Forense 23/11/2026: K29 (il diniego nomina la pagina sbagliata) e K30 (scheda con permesso suo).
const GRUPPI = [
  ["/provenance", "/admin/gdpr", "/admin/tassonomie", "/admin/dati-di-riferimento"],
  ["/career-succession", "/insights/succession-readiness", "/mentorship"],
];
const SCHEDE = [
  { href: "/provenance", key: "dati.provenance" },
  { href: "/admin/gdpr", key: "dati.gdpr" },
  { href: "/admin/tassonomie", key: "dati.tassonomie" },
  { href: "/admin/dati-di-riferimento", key: "dati.riferimento" },
  { href: "/mentorship", key: "career.mentorship" },
];
const REGISTRO: RouteAccess[] = [
  { route: "/provenance", allowed: false },
  { route: "/career-succession", allowed: true },
];

describe("chiaviNomePaginaNegata (K29)", () => {
  it("una scheda negata insieme alla sua principale si nomina con la propria etichetta, non con la principale", () => {
    for (const [pagina, chiave] of [["/admin/gdpr", "dati.gdpr"], ["/admin/tassonomie", "dati.tassonomie"], ["/admin/dati-di-riferimento", "dati.riferimento"]] as const) {
      const v = pageVerdict(pagina, REGISTRO, GRUPPI);
      expect(v).toEqual({ kind: "denied", route: "/provenance" });
      const chiavi = chiaviNomePaginaNegata(pagina, v, SCHEDE);
      expect(chiavi).toContain(`shell:tabs.${chiave}`);
      expect(chiavi).not.toContain("shell:nav.voci.provenance");
    }
  });

  it("la rotta del verdetto vale ancora quando contiene la pagina richiesta (dettaglio di una pagina negata)", () => {
    const v = pageVerdict("/users/0000-1111", ROUTES);
    expect(chiaviNomePaginaNegata("/users/0000-1111", v, SCHEDE)).toEqual([
      "shell:nav.voci.users_0000-1111",
      "shell:nav.voci.users",
    ]);
  });
});

describe("pageVerdict con il permesso della scheda (K30)", () => {
  it("nega la scheda /mentorship a chi non ha mentorship:read, anche se la principale è aperta", () => {
    expect(pageVerdict("/mentorship", REGISTRO, GRUPPI, { permessi: ["career_succession:read"], permessiDi: permessiGuardiaScheda }))
      .toEqual({ kind: "denied", route: "/mentorship" });
  });

  it("la apre a chi ha il permesso, e non nega niente finché i permessi non sono noti", () => {
    expect(pageVerdict("/mentorship", REGISTRO, GRUPPI, { permessi: ["mentorship:read"], permessiDi: permessiGuardiaScheda }).kind).toBe("allowed");
    expect(pageVerdict("/mentorship", REGISTRO, GRUPPI, { permessi: null, permessiDi: permessiGuardiaScheda }).kind).toBe("allowed");
  });

  it("le schede senza permesso proprio seguono la principale come prima", () => {
    expect(pageVerdict("/insights/succession-readiness", REGISTRO, GRUPPI, { permessi: [], permessiDi: permessiGuardiaScheda }).kind).toBe("allowed");
  });
});

describe("la guardia chiude solo le schede verificate (revisione della #436)", () => {
  const PERMESSI: RouteAccess[] = [{ route: "/admin/roles", allowed: true }, { route: "/provenance", allowed: true }];
  const GRUPPI_ADMIN = [
    ["/admin/roles", "/admin/agent-capabilities", "/admin/agent-requests"],
    ["/provenance", "/admin/gdpr", "/admin/tassonomie", "/admin/dati-di-riferimento"],
  ];

  it("/admin/agent-requests resta aperta a chi ha solo agent_conversation:use:self (le proprie richieste)", () => {
    expect(pageVerdict("/admin/agent-requests", PERMESSI, GRUPPI_ADMIN, {
      permessi: ["agent_conversation:use:self"], permessiDi: permessiGuardiaScheda,
    }).kind).toBe("allowed");
  });

  it("/admin/tassonomie resta aperta con uno qualunque dei permessi della pagina", () => {
    expect(pageVerdict("/admin/tassonomie", PERMESSI, GRUPPI_ADMIN, {
      permessi: ["skill:read"], permessiDi: permessiGuardiaScheda,
    }).kind).toBe("allowed");
  });

  it("le schede con più permessi ammessi si aprono con uno solo di essi", () => {
    const permessiDi = (h: string) => (h === "/admin/gdpr" ? ["gdpr:read", "gdpr:read:self"] : null);
    expect(pageVerdict("/admin/gdpr", PERMESSI, GRUPPI_ADMIN, { permessi: ["gdpr:read:self"], permessiDi }).kind).toBe("allowed");
    expect(pageVerdict("/admin/gdpr", PERMESSI, GRUPPI_ADMIN, { permessi: [], permessiDi })).toEqual({ kind: "denied", route: "/admin/gdpr" });
  });
});
