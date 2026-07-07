WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on Sonnet/Opus, working on the heuresys-advanced repo) runs the brief below later. Your job is the route it will follow.

Recon first, read-only: docs/kb/SOT_BACKLOG.md (item #4) + docs/superpowers/specs/2026-06-22-gtm-investor-onepager-and-guided-demo-design.md + the shipped GTM surfaces: landing `/` (S1002), `/investors` + `/demo` (S1003), `LeadForm` + `lead_source` enum (WEBSITE/INVESTOR/DEMO) + `GET /v1/public/platform-stats`.

Then fight the mission on paper, move by move, and write it to wargames/15-heuresys-pricing.md:

- every move states its expected observation, exactly what you should see if it worked
- every move carries its most likely failure, the cause it signals, and the counter-move
- every fork gets a trigger, if you observe X, take route B
- assumptions recon could not settle get marked RECON NEEDED with the exact check that settles it
- end with abort conditions, and the verification runs the executor must perform with what pass looks like for each

Write it so the executor can run the brief end to end without asking a single question.

=== THE MISSION BRIEF (the executor's orders, not yours) ===

Ship the next #4 go-to-market deliverable: the **public pricing page** on www.heuresys.com, consistent with the shipped GTM family (landing, `/investors`, `/demo`): same i18n discipline (it+en), same public-route pattern (`proxy.ts` allowlist), same honest-understated tone, soft-CTA via `LeadForm`.

**HARD INPUT GAP (do not invent): the actual prices and tier structure are Enzo's decision and DO NOT EXIST yet.** The plan must treat them as RECON NEEDED with the exact question set for Enzo (how many tiers, price points or "contact us", billing unit — per-employee/per-tenant/flat, annual vs monthly, what's in each tier, trial/pilot policy). Build the page so the numbers are data, not layout: a tier config the executor fills when Enzo answers, with a "contact us" fallback rendering if numbers are withheld.

Deliver: `/pricing` public page (it+en) + `lead_source` extension (fork: reuse an existing enum value vs add PRICING — check migration 000153 pattern and the D-38 assert class before adding) + LeadForm wiring with the chosen source + nav/footer links from the landing family + E2E spec (pattern of `investors.spec` / `demo.spec`).

Follow the established GTM flow: brainstorm→spec→plan docs under docs/superpowers/{specs,plans}/ before code.

=== EXECUTION CONSTRAINTS (heuresys-advanced, binding) ===

- Repo: `D:\heuresys-advanced` (Windows) / `/home/ubuntu/heuresys-advanced` (VM). Monorepo pnpm; db/migrations 167 files max 000169 at S1015 — re-derive live.
- Before ANY work read in order: docs/kb/SOT_STATE.md → docs/kb/SOT_BACKLOG.md → docs/kb/DEBT_REGISTER.md → .handoff/STATE.md. SoT wins.
- Public routes: no-auth/no-CSRF + rate-limit pattern (see `/v1/leads` 5/min and `/v1/public/platform-stats` 30/min); any new enum value = varchar+CHECK migration, twice-run idempotent, watch permission/enum count asserts (class D-38/regression 000142).
- Tests under per-file tx isolation (D-52); full API suite 0 fail.
- Done means: typecheck · lint · i18n parity · full suite green · CI 6/6 · vm-deploy · LIVE verification (200 on /pricing, real lead submitted and removed, rate-limit counted per-IP as in D-42 verification).
- Pricing numbers/tiers = Enzo's authority, full stop.
