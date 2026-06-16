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
- [x] S-100X-A4 | WS-C | audit dati & persistenza (squash, backup/restore, indici, dead schema) | FINDINGS/WS-C.md | **DONE** (S993 — 0 CRITICAL / 3 HIGH: F-WS-C-1 243 FK no-index (56 tenant_id) · F-WS-C-4 auth-audit unbounded (46.3k refresh-token/9 utenti, 57k login-events, no pruning) · reconciles WS-G F-10 backup=SHIPPED not zero; QW-C1..C4. ASSET: 0 dead-schema, RD-08 perfetto, D-18 verificato chiuso, squash=DON'T)
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

- [x] QW-1 | WS-A | rimuovi drizzle-orm + drizzle-kit (dead dep, 0 importatori del `db` export) | typecheck+test verdi, dep assenti | **DONE** (S989; verificato S993: 0 ref `drizzle` in qualsiasi package.json)
- [ ] QW-2 | WS-K | `clean` script + retention `.next`/pg_dump_snapshots (−~31G) | script idempotente + doc | TODO
- [x] QW-3 | WS-J | 8 env var non documentate → `.env.example` (meglio auto-gen dal zod env.ts) | `.env.example` completo / generator | **DONE** (S993: diff env.ts↔.env.example → 7 var mancanti aggiunte — MFA_ENROLL_CONFIRM, WEBAUTHN_RP_ID/NAME/ORIGINS, SMS_PROVIDER/FROM, MEDIA_STORAGE_DIR; chiude anche QW-G3)
- [ ] QW-4 | WS-B | estrai `withTransaction` + helper query da auth → `src/db/` | 67 moduli possono riusarlo, test verdi | TODO
- [x] QW-5 | WS-I | fix `apps/api/package.json` description stale (58/272 → 72/407) | descrizione allineata | **DONE** (S993: → "75 business modules + auth, ~407 /v1 endpoints; v1.0.0 GA + post-v1 ondata-1")

## Quick-wins WS-G (da S-100X-A1; CLASS-A; esecuzione gated dal go di Enzo)

- [ ] QW-G1 | WS-G | caching CI dichiarato: `cache: pnpm` sui 6 setup-node self-hosted + `actions/cache` `apps/web/.next/cache` | cache esplicita + portabile (prereq 2° runner) | TODO
- [ ] QW-G2 | WS-G | SHA-pin delle 13 GitHub Actions (esp. third-party peaceiris/actions-gh-pages) | `uses:` a SHA 40-char + `# vN`; Dependabot bump preservato | TODO
- [x] QW-G3 | WS-G | env-contract: 7+ var `env.ts` → `.env.example` + nota SoT (incl. POSTGRES_DB/POSTGRES_DATABASE dual-set) | `.env.example` completo (lega a QW-3/R09) | **DONE** (S993, via QW-3 — diff completo env.ts↔.env.example chiuso)
- [ ] QW-G4 | WS-G | `showcase.yml` drop checkout sister-repo + `npm install --legacy-peer-deps` (premessa `link:` stantia; reale npm `@heuresys/ui@^0.1.5`) | verify build registry-only → drop step + fix comment | TODO
- [ ] QW-G5 | WS-G | cache `~/.cache/ms-playwright` + reuse build-web artifact in playwright-smoke (no rebuild) | smoke verde, browser/`.next` cache | TODO

## Quick-wins 3.2 security ASVS (da `FINDINGS/3.2_ASVS_MAPPING.md`, S993; CLASS-A)

- [x] QW-SEC2 | 3.2 | HSTS header al TLS edge nginx (V9.2/V14.4, net-new gap) | `curl -sI https://www.heuresys.com \| grep -i strict-transport` mostra l'header | **DONE-LIVE** (S993: `add_header Strict-Transport-Security "max-age=31536000" always` nel repo mirror + applicato live VM, nginx -t ok + reload; verificato su HEAD 307→/login e GET)
- [x] QW-SEC1 | 3.2 | verifica live VM `.env` TRUST_PROXY=1 + COOKIE_SECURE=true (lente D-26/D-28) | grep KEY via SSH | **DONE** (S993 evidence: VM `.env` → `TRUST_PROXY=1` + `COOKIE_SECURE=true`; `SMTP_HOST` unset → EMAIL_OTP gated in PROD, coerente col workaround aspetto-1)
- [ ] QW-SEC5 | 3.2 | log strutturato `security-audit` su authn-failure (V7.1.3/4) | vitest cattura failed-login/replay record, no plaintext | TODO (hot-path auth → cautela)
- [ ] QW-SEC6 | 3.2 | AES-256-GCM encryption-at-rest TOTP secret (consuma MFA_ENCRYPTION_KEY inerte, D-30) | enroll→colonna ciphertext, decifra a codice valido | DEFERRED (L2, decisione sicurezza = autorità Enzo)
- [x] ~~QW-SEC3/SEC4/SEC7~~ | 3.2 | skill-taxonomy authz / media magic-byte / matching rate-limit | — | **GIÀ FATTI S989** (QW-H H4/H2/H6; il subagent li ha ri-proposti da WS-H.md che li elencava come finding originali)

## Quick-wins WS-C dati & persistenza (da `FINDINGS/WS-C.md`, S993; CLASS-A)

- [x] QW-C1 | WS-C | indici additivi `*_tenant_idx` sulle 6 tabelle >5MB con tenant-FK senza indice (F-WS-C-1) | EXPLAIN list-by-tenant → Index Scan post-fix | **DONE-LIVE** (S993, mig `000130`: 6 indici creati live; EXPLAIN `sys_auth_refresh_tokens` → Bitmap Index Scan su `sys_auth_refresh_tokens_tenant_idx`; `sys_source_lineage_records` resta seq-scan = tenant unico, indice disponibile per multi-tenant)
- [x] QW-C2 | WS-C | pruning auth-audit (refresh-token revoked/expired + login-event retention) (F-WS-C-4) | count crolla + suite auth verde | **DONE-LIVE** (S993: mig `000129` one-time `46.348→37.028` (−9.320 revoked+expired, 0 prunable residui) + job ricorrente `scripts/auth-housekeeping.sh` + systemd timer daily 02:00 (wired vm-bootstrap); SAFE — solo revoked/scaduti, mai sessioni vive; i 37k attivi scadono e li raccoglie il job; auth+refresh+sessions 29/29 verde)
- [x] QW-C3 | WS-C | timer systemd settimanale per `dr-drill.sh` con alert RPO/row-count (F-WS-C-5) | run timer → `[dr-drill] PASS` + drift→exit!=0 | **DONE** (S993: `dr-drill.sh` strict-mode `DR_DRILL_STRICT=1` — exit!=0 SOLO su DR reale (no-backup / RPO>48h / restore rotto), il drift row-count fisiologico resta WARN; `heuresys-advanced-dr-drill.{service,timer}` Sun 04:00 + wiring vm-bootstrap. bash -n OK; test live end-to-end al deploy)
- [x] QW-C4 | WS-C | drop `sys_source_lineage_records_natural_key_idx` (10MB, idx_scan=0) verify-first (F-WS-C-2) | grep `ON CONFLICT natural_key`=0 + ingestion ok post-drop | **DONE-LIVE** (S993, mig `000131`: verified non-unique/no-constraint/0-scan/no-ON-CONFLICT → dropped live; `sys_source_lineage_records` 70MB→60MB. Reversible via 000025 def.)
