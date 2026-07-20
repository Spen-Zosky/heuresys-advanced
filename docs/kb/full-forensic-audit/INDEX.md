# INDEX — Audit forensi read-only (full-forensic-audit)

> Append-only. Un blocco per run. Report + findings JSON affiancati.

## [AUDIT FORENSE read-only] 2026-07-03 15:12 — scope: intero repo
- Scanner: pnpm audit (0 vuln/1359 dep), SAST LLM (10 finder + 63 verifier), **fp-check formale (21 agenti, prova live)**, psql read-only. Semgrep/CodeQL non disponibili. Falsi positivi 1ª passata scartati: 10.
- Findings verificati: Critical 1 / High 0 / Medium 5 / Low 19 / Info 28.
- fp-check (21 security-relevant): **4 TRUE POSITIVE**, 17 FALSE POSITIVE-come-vuln (hardening).
- Scorecard: architettura 82/100, security 55/100, db 83/100, test 90/100.
- TRUE POSITIVE (fix reali):
  - [Critical] Committed default admin password + committed VERIFIED TOTP fixtures are seeded into PRODUCTION — full password+MFA bypass for admin@heuresys.com (db/scripts/seed-test-admin.ts:48) — F-001
  - [Medium] Open redirect in post-login navigation: `next` param accepts protocol-relative URLs (//evil.com) (apps/web/src/app/login/page.tsx:27) — F-002
  - [Medium] CSV formula/DDE injection: csvCell performs RFC-4180 quoting but never neutralizes formula-trigger characters (apps/api/src/modules/analytics/csv.ts:29) — F-004
  - [Low] Self-hosted PROD runner executes dependency install/build lifecycle scripts on same-repo and Dependabot PRs (.github/workflows/build-web.yml:56) — F-012
- Top Critical+High (max 10):
  1. [Critical] security — db/scripts/seed-test-admin.ts:48 — Committed default admin password + committed VERIFIED TOTP fixtures are seeded into PRODUCTION — full password+MFA bypass for admin@heuresys.com — NEW
- NEW debt candidato per DEBT_REGISTER (proposta, non applicata):
  - [Critical] [fp-check TP] Committed default admin password + committed VERIFIED TOTP fixtures are seeded into PRODUCTION — full password+MFA bypass for admin@heuresys.com (db/scripts/seed-test-admin.ts:48)
  - [Medium] [fp-check TP] Open redirect in post-login navigation: `next` param accepts protocol-relative URLs (//evil.com) (apps/web/src/app/login/page.tsx:27)
  - [Medium] [fp-check TP] CSV formula/DDE injection: csvCell performs RFC-4180 quoting but never neutralizes formula-trigger characters (apps/api/src/modules/analytics/csv.ts:29)
  - [Medium] Sensitive-data org-axis (ADR-0027 F3) is enforced ad-hoc per module — the F2 data-class taxonomy has zero consumers, so a new sensitive module can silently omit the gate (D-50 class) (apps/api/src/lib/scope/data-classes.ts:81)
  - [Medium] getDashboardTrends: N+1 over trend entities, each running a correlated count(*) full-scan per weekly bucket (apps/api/src/modules/dashboard/repository.ts:344)
  - [Medium] Integration suite (185 files) runs against the shared LIVE OCI VM dev DB with no transactional isolation — non-hermetic, order-coupled, drift-prone (apps/api/vitest.config.ts:4)
  - [Low] [fp-check TP] Self-hosted PROD runner executes dependency install/build lifecycle scripts on same-repo and Dependabot PRs (.github/workflows/build-web.yml:56)
- Report: AUDIT_FORENSE_heuresys_2026-07-03_151241.md | Findings: FINDINGS_2026-07-03_151241.json | fp-check: FP_CHECK_VERIFICATION_2026-07-03_151241.md
- Nota: READ-ONLY sul codice; nessuna modifica fuori da full-forensic-audit/, nessun git commit. Promozione NEW debt/fix a cura del CLI owner.

## [AUDIT FORENSE read-only] 2026-07-20 02:22 — scope: intero repo
- Scanner girati: psql read-only (:5433, pg_stat/pg_constraint/pg_index/information_schema/pg_extension), pnpm audit (0 vuln, exit 0), git grep/ripgrep (injection/secrets/XSS/authz/ORDER-BY-dinamico), Read mirati (app.ts/env.ts/csv.ts/login.tsx/@heuresys-shared/workflows). **fp-check = verifica di persona integrata** (fan-out multi-agente fallito su session-limit account → audit completato in main thread). Falsi positivi scartati/refutati: 4 (XSS themeBootScript, SQL injection→placeholder, env boolean footgun→z.enum, N+1 dashboard→subquery aggregate).
- Findings: Critical 0 / High 1 / Medium 3 / Low 4 / Info-Asset 7.
- Scorecard: architettura 83/100, security 85/100, db 76/100, test 80/100 (+ci-cd 66, frontend 80).
- Top Critical+High (max 10): 1. [HIGH] ci-cd — packages/shared/package.json:7 — D-58 next build/Turbopack fallisce x94 sul barrel .js (main→src TS) → deploy web bloccato — KNOWN(D-58)
- NEW debt candidato per DEBT_REGISTER (proposta, non applicata):
  - [Medium] [F-A04] F4 asse funzionale (#24) dichiarato DoD-complete ma sys_process_participants=0 righe → asse funzionale ADR-0027 non esercitato da dati reali (tensione con DoD ADR-0026)
  - [Low] [F-A06] NACE/ATECO = adjacency parent_code non-FK → parent orfani possibili (ltree assente, il prompt lo assumeva)
  - [Low] [F-A08] doc-drift: endpoint reali 516 vs doc ~407; tabelle vuote 36 vs atlas 67 (conferma: doc inaffidabile, verita' = codice/DB)
  - (KNOWN riconfermati: D-58 High; WS-C-1 261/549 FK no-index Medium; WS-C-4 login-events 91k unbounded Medium; D-35 dead schema closure-OU Low; WS-F no-unit-layer Low)
- Verdetto finance-readiness: **CONDITIONAL-GO** (confidence media) — piattaforma reale e security-solida (516 endpoint, 4 TP storici tutti chiusi con fix strutturali, 0 vuln, SQL param, authz completa); 3 condizioni bloccanti: (1) sciogliere D-58 strutturale, (2) data-completeness feature DoD-complete, (3) igiene DB (FK-index + retention). Competenza esecutiva DIMOSTRATA.
- Report: AUDIT_FORENSE_heuresys_2026-07-20_022239.md | Findings: FINDINGS_2026-07-20_022239.json
- Nota: READ-ONLY sul codice; nessuna modifica fuori da full-forensic-audit/, nessun git commit. Fan-out multi-agente + WS-L + triage D-01..D-14 falliti su session-limit account (reset 6:20am) = residuo esplicito. Promozione NEW debt a cura del CLI owner.
