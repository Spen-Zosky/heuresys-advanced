# ADR-0026 — Single production-grade environment: RTL Bank & Heuresys are the current production tenants

**Status**: ACCEPTED
**Date**: 2026-06-22
**Author**: CLI session (S1004, DBMS health-check + recovery-plan brainstorm)
**Decision authority**: Enzo Spenuso
**Amends**: the "Definition of Done" clause of `CLAUDE.md` (retires the "tenant di TEST, mai produzione" framing); reaffirms and builds on **ADR-0023** (no-PII data-source doctrine) and **ADR-0010** (PostgreSQL runtime location)
**Related**: I5 (tenant isolation), I12/I13, ADR-0004 (no-Docker runtime), ADR-0023 (data treated as real, no-PII global), ADR-0011 (ESS scope)
**Triggered by**: Enzo's clarification (2026-06-22): there is no "test vs production" dichotomy — the platform runs as production, RTL Bank and Heuresys are the two tenants currently in production, and although no data belongs to real clients it is treated as real. The prior DoD framing ("scritture dimostrative su tenant di TEST, mai produzione") implied a separate test environment that does not exist.

---

## §1 — Context

The `CLAUDE.md` Definition of Done (recepita 2026-06-15) and several SoT docs framed live demonstrations as happening on a "tenant di TEST, mai produzione". This wording implied a *test environment* distinct from *production*, and a per-tenant test/prod split. Neither exists:

- The platform runs in **production mode** on the OCI VM (ADR-0010 Option B): API tsup bundle (`node dist/server.js`), web `next start`, native PostgreSQL 16, behind nginx TLS at `www.heuresys.com`. There is no separate "test" deployment.
- The two tenants present today — **RTL Bank** and **Heuresys System** — are simply the only two tenants currently in production, not a "test fixture".
- The data is synthetic case-study data (legacy `heuresys-evo` + synthetic seeds), so **there is never a real-client PII concern** (ADR-0023, no-PII global). But its *provenance* being synthetic does not make its *treatment* non-production.

This ADR locks the doctrine so no future session re-introduces a non-existent test/prod dichotomy.

## §2 — Decision

### §2.1 — One environment, and it is production
There is a single operating environment and it is **production-grade**: real runtime (prod build, TLS, native DB), real behaviour, real governance. "Test" is not a deployment that exists here. Any work is performed *in production*, on the current production data.

### §2.2 — RTL Bank & Heuresys System are the current production tenants
The two tenants are production tenants with **distinct roles** (this is a role distinction, *not* a test/prod split):

| Tenant | tenant_code | Role | Size | Notes |
|---|---|---|---|---|
| **RTL Bank** | `RTL_BANK` (`86ba7a65…`) | **Customer-example tenant** — models a real customer company | M / FIN_BANKING | 162 users, 162 positions, 26 OU, the populated business dataset |
| **Heuresys System** | `HEURESYS` (`8bc5bc59…`) | **Platform / system tenant** — the platform owner | S | small, not a company-with-employees |

Business-data writes (users, positions, assignments, learning, KPI, …) land on **RTL Bank** because it is the tenant that models a customer company; Heuresys is the platform/system tenant and is not populated like a 158-employee firm. The earlier rule "scritture dati SOLO su RTL_BANK, mai HEURESYS" (`SOT_BACKLOG §0.5`) is **preserved on these role grounds** — it is a modelling choice between two production tenants, never a "write to test, not prod" rule. Tenant isolation remains FK + middleware (I5), never RLS.

### §2.3 — Data is treated as real (provenance synthetic, treatment production)
Per ADR-0023 the data is synthetic case-study by design → **no PII, ever, unconditionally**. This ADR adds the operational corollary: **the data is treated as real production data** at every operational level — quality, referential coherence, governance, accountability, idempotent/reversible writes. *"Not real" qualifies only provenance, never treatment.* There is no sloppy "it's just test data" license.

### §2.4 — Two access paths (the user-facing model)
1. **Public / prospect path (unauthenticated)** — launching the platform lands on the **landing page**. A visitor who only wants to understand the product / see a demo is routed into the **demo-request flow** (the GTM front door: landing → `/demo` · `/investors` → lead capture). No login. This is the showcase surface.
2. **Authenticated production path (registered user)** — a registered user **logs in** and uses the platform **as in production, according to their profile** (RBAC + perspective + scope). These are the real users of RTL Bank / Heuresys; each sees and does exactly what their profile permits.

### §2.5 — Definition of Done (reformulated, canonical)
A work-item closes **only** with a **LIVE demonstration on real data**, performed on the **current production tenants** (RTL Bank / Heuresys, treated as real), with evidence attached (command + output + absolute path + timestamp, R5). For authenticated pages, the LIVE demonstration means **logging in as a real person** (e.g. `federica.marchetti@rtl-bank.org` TENANT_ADMIN, `paolo.caputo@rtl-bank.org` MANAGER) and exercising the page per profile. No step closes on mock / placeholder / green-test. The **only** admissible wait is an input that only Enzo can provide (secret/credential, human approval) → state `blocked-on-Enzo: <what, why>`, never "done". The phrases "tenant di TEST" and "mai produzione" are **retired**: there is no other environment.

## §3 — Consequences

**Positive**
- No future session re-imagines a separate test environment or a test/prod write split.
- The DoD is unambiguous and matches the running system (one prod environment, two prod tenants).
- The two-path user model (public showcase vs authenticated prod app) is documented once.

**Bounded**
- Writes are production writes: they must be governed (idempotent migrations, referential coherence, reversibility where it matters) — not throwaway. This is a discipline, not a constraint that blocks work.
- If a genuinely separate non-prod environment is ever introduced (e.g. a staging box), this ADR must be revisited to define the boundary explicitly.

**Neutral**
- No code/schema change. Documentary doctrine. ADR-0023 (no-PII) and ADR-0010 (runtime) are unchanged and reinforced; `CLAUDE.md` DoD + invariant set are amended to point here (new invariant **I15**).

## §4 — Scope boundary

This ADR fixes the *doctrine and vocabulary*. It does not itself mandate any data population or refactor; recovery work (e.g. populating empty tables to make pages LIVE) is governed by its own greenlit plan, executed against the production tenants under this doctrine.

## §5 — References
- `CLAUDE.md` §"Definition of Done" + §"MVP-2a/2b LIVE DATA E2E ONLY" + invariant **I15**
- ADR-0023 (no-PII data-source doctrine — the provenance side of "treated as real")
- ADR-0010 (PostgreSQL runtime location — the production runtime), ADR-0004 (no-Docker)
- I5 (tenant isolation FK + middleware), ADR-0011 (ESS scope)
- `memory/feedback_data_treatment_no_privacy_concerns.md` (+ new `project_production_grade_two_tenants`)

---

*End ADR-0026*
