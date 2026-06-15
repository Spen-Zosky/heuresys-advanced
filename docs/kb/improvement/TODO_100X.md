# TODO_100X — machine-checkable program tracker

> Formato: `[ ] S-100X-?? | WS | task | gate di verifica | stato`. Stati: TODO · IN-PROGRESS · DONE · DEFERRED · BLOCKED. Aggiornato a ogni sessione. Cross-ref: `MASTER_PLAN_100X.md`, `AUDIT_PROTOCOL.md`.

## Fase 0 — Recon (S-100X-0, 2026-06-13)

- [x] S-100X-0 | — | grounding live SoT + counts + CI + footprint | drift annotato in BASELINE_METRICS | DONE
- [x] S-100X-0 | — | recon 3 sub-agent read-only (WS-A..K) | FINDINGS/S-100X-0_recon.md | DONE
- [x] S-100X-0 | — | intervista (gate bloccante) | INTERVIEW_LOG.md | DONE
- [x] S-100X-0 | — | master plan + protocollo + todo + stub FINDINGS/DOSSIERS | file presenti + backlog epic | DONE

## Fase A — Audit per-WS (read-only, sub-agent fan-out; robustness-first)

- [x] S-100X-A1 | WS-G | audit CI/CD & deploy (runner SPOF, rollback, caching, release) | FINDINGS/WS-G.md + baseline durate CI | **DONE** (S987 — 30 finding: 1 CRITICAL fork-PR ACE su prod host, 10 HIGH, 5 QW-G; D-08 → security-priority)
- [x] S-100X-A2 | WS-H | audit sicurezza & supply chain (auth, secrets, OWASP, SBOM, env-doc) | FINDINGS/WS-H.md | **DONE** (S988 — fan-out 5 sub-agent: 1 HIGH TRUST_PROXY [D-28 RISOLTO S988], MED rate-limit/skill-taxonomy/media-sniff; 6 QW-H tutti chiusi S989; SQL 100% param, Zod 415/415, pnpm audit 0)
- [x] S-100X-A3 | WS-F | audit test & QA (unit-layer, parallelism, isolation, flakiness) | FINDINGS/WS-F.md + baseline durate suite | **DONE** (S990, 2026-06-15 — 19 finding: 3 HIGH no-full-E2E-in-CI / no-unit-layer / tunnel-coupling, 5 MED, 6 LOW, 5 INFO; 6 QW-F + 6 DOSSIER + 3 ASSET; baseline 134 file/~920 case/73-su-73 mod/0 mock/ratio 6.7:1; anchor x19a stale pre-MFA 86.53s)
- [ ] S-100X-A4 | WS-C | audit dati & persistenza (squash, backup/restore, indici, dead schema) | FINDINGS/WS-C.md | TODO
- [ ] S-100X-A5 | WS-B | audit backend/servizi (module-pattern cost, hot path, repo SQL) | FINDINGS/WS-B.md | TODO
- [ ] S-100X-A6 | WS-A | audit architettura (coupling, dead code, dep inutilizzate) | FINDINGS/WS-A.md | TODO
- [ ] S-100X-A7 | WS-D | audit frontend (RSC/streaming, bundle, data-fetching) | FINDINGS/WS-D.md + bundle baseline | TODO
- [ ] S-100X-A8 | WS-E | audit design-system / UX-IX (token, a11y tail, euristiche, i18n) | FINDINGS/WS-E.md | TODO
- [ ] S-100X-A9 | WS-J | audit config & env (env contract, script, multi-host) | FINDINGS/WS-J.md | TODO
- [ ] S-100X-A10 | WS-K | audit repo hygiene & footprint (cleanup, retention, LFS) | FINDINGS/WS-K.md + misura prima/dopo | TODO
- [ ] S-100X-A11 | WS-I | audit documentazione (drift, duplicazioni, index) | FINDINGS/WS-I.md | TODO
- [ ] S-100X-A-L | WS-L | ecosistema Claude design-only (claude-ecosystem-optimizer) + bug claude-mem hook | WS-L_PLAN.md + WS-L_TODO.md | TODO

## Fase C — Consolidamento (dossier finali → decide Enzo)

- [ ] S-100X-C | — | sintesi cross-WS + DOSSIERS D-01..D-14 completi (conservativo/evolutivo/radicale + raccomandazione) | DOSSIERS/D-*.md tutti compilati | TODO
- [ ] S-100X-C | — | gate decisionale: Enzo decide per-dossier (go/defer/won't) | esiti registrati in DOSSIERS + backlog | BLOCKED (su Fase A)

## Fase E — Esecuzione (1 epic/sessione, branch dedicati, autorizzata per-dossier)

- [ ] S-100X-E? | — | epic da dossier approvati (branch + gate verdi + test + handoff) | CI verde + KPI relativo | BLOCKED (su Fase C + go Enzo)

## Quick-wins misurati (CLASS-A; esecuzione gated dal go di Enzo)

- [ ] QW-1 | WS-A | rimuovi drizzle-orm + drizzle-kit (dead dep, 0 importatori del `db` export) | typecheck+test verdi, dep assenti | TODO
- [ ] QW-2 | WS-K | `clean` script + retention `.next`/pg_dump_snapshots (−~31G) | script idempotente + doc | TODO
- [ ] QW-3 | WS-J | 8 env var non documentate → `.env.example` (meglio auto-gen dal zod env.ts) | `.env.example` completo / generator | TODO
- [ ] QW-4 | WS-B | estrai `withTransaction` + helper query da auth → `src/db/` | 67 moduli possono riusarlo, test verdi | TODO
- [ ] QW-5 | WS-I | fix `apps/api/package.json` description stale (58/272 → 72/407) | descrizione allineata | TODO

## Quick-wins WS-G (da S-100X-A1; CLASS-A; esecuzione gated dal go di Enzo)

- [ ] QW-G1 | WS-G | caching CI dichiarato: `cache: pnpm` sui 6 setup-node self-hosted + `actions/cache` `apps/web/.next/cache` | cache esplicita + portabile (prereq 2° runner) | TODO
- [ ] QW-G2 | WS-G | SHA-pin delle 13 GitHub Actions (esp. third-party peaceiris/actions-gh-pages) | `uses:` a SHA 40-char + `# vN`; Dependabot bump preservato | TODO
- [ ] QW-G3 | WS-G | env-contract: 7+ var `env.ts` → `.env.example` + nota SoT (incl. POSTGRES_DB/POSTGRES_DATABASE dual-set) | `.env.example` completo (lega a QW-3/R09) | TODO
- [ ] QW-G4 | WS-G | `showcase.yml` drop checkout sister-repo + `npm install --legacy-peer-deps` (premessa `link:` stantia; reale npm `@heuresys/ui@^0.1.5`) | verify build registry-only → drop step + fix comment | TODO
- [ ] QW-G5 | WS-G | cache `~/.cache/ms-playwright` + reuse build-web artifact in playwright-smoke (no rebuild) | smoke verde, browser/`.next` cache | TODO
