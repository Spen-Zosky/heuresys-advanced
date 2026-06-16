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
- [x] S-100X-A5 | WS-B | audit backend/servizi (module-pattern cost, hot path, repo SQL) | FINDINGS/WS-B.md | **DONE** (S993 — 1 CRIT B-1 broadcast N+1 [→QW-B1 FIXED] · 3 HIGH (4 list no-LIMIT, boilerplate 28k LOC, pagination caps incoerenti) · ASSET: 0 IDOR/tenant-break, 0 dead modules, 0 SQL-injection, single pool. QW-B1..B7)
- [x] S-100X-A6 | WS-A | audit architettura (coupling, dead code, dep inutilizzate) | FINDINGS/WS-A.md | **DONE** (S993 — 0 CRIT/HIGH, 2 MED: agent-gateway fuori da build/lint/CI · pino mis-classed devDep+dead-deps; ASSET: 0 circular, 0 web→api-internal, drizzle removed. QW-A1..A4)
- [x] S-100X-A7 | WS-D | audit frontend (RSC/streaming, bundle, data-fetching) | FINDINGS/WS-D.md | **DONE** (S993 — 2 HIGH: chart code-split incoerente (8 analytics eager-import EChartsCard) · app `(authenticated)` 65/66 client-side (DOSSIER); ASSET: live-data doctrine 100%, 0 mock. QW-D1/D2)
- [x] S-100X-A8 | WS-E | audit design-system / UX-IX (token, a11y tail, euristiche, i18n) | FINDINGS/WS-E.md | **DONE** (S993 — 0 CRIT/HIGH, 3 MED: doppio token rosso `text-destructive`/`text-danger` · SystemHealthDashboard no-i18n+duplicato · i18n-gap; ASSET: a11y serious=0, 0 raw-hex, i18n parity 1216. QW-E1..E5. Contrary-evidence: `text-destructive` memo STALE — ora renderizza, verify-first contrast)
- [x] S-100X-A9 | WS-J | audit config & env (env contract, script, multi-host) | FINDINGS/WS-J.md | **DONE** (S993 — 0 CRIT/HIGH, 3 MED: z.coerce.boolean footgun su MATCHING_FREETEXT/API_DOCS [→QW-J1 FIXED] · denylist parziale [→QW-J2 FIXED] · TRUST_PROXY manual-only; QW-3/G3 env-contract confermato chiuso, secret-hygiene pulita)
- [x] S-100X-A10 | WS-K | audit repo hygiene & footprint (cleanup, retention, LFS) | FINDINGS/WS-K.md + misura prima/dopo | **DONE** (S993 — 1 HIGH: apps/web/.next 29G (28G dev-cache, +1.7G/g), no clean script [→QW-2 FIXED]; MED pre-op dumps 3.7G no-retention; ~32G recuperabili; ASSET: 0 tracked generated, 0 LFS, .git 28M sano)
- [x] S-100X-A11 | WS-I | audit documentazione (drift, duplicazioni, index) | FINDINGS/WS-I.md | **DONE** (S993 — 3 HIGH drift: README ~12 numeri stale · CLAUDE.md 4 sezioni (60mod→75, 55mig→130, 586map→600) · INDEX_PATHS stale (13+ moduli mancanti); ASSET: disjunction SoT v2 rispettata 0-dup. QW-I1..I4 + dossier anti-drift)
- [ ] S-100X-A-L | WS-L | ecosistema Claude design-only (claude-ecosystem-optimizer) + bug claude-mem hook | WS-L_PLAN.md + WS-L_TODO.md | TODO

## Fase C — Consolidamento (dossier finali → decide Enzo)

- [ ] S-100X-C | — | sintesi cross-WS + DOSSIERS D-01..D-14 completi (conservativo/evolutivo/radicale + raccomandazione) | DOSSIERS/D-*.md tutti compilati | TODO
- [ ] S-100X-C | — | gate decisionale: Enzo decide per-dossier (go/defer/won't) | esiti registrati in DOSSIERS + backlog | BLOCKED (su Fase A)

## Fase E — Esecuzione (1 epic/sessione, branch dedicati, autorizzata per-dossier)

- [ ] S-100X-E? | — | epic da dossier approvati (branch + gate verdi + test + handoff) | CI verde + KPI relativo | BLOCKED (su Fase C + go Enzo)

## Quick-wins misurati (CLASS-A; esecuzione gated dal go di Enzo)

- [x] QW-1 | WS-A | rimuovi drizzle-orm + drizzle-kit (dead dep, 0 importatori del `db` export) | typecheck+test verdi, dep assenti | **DONE** (S989; verificato S993: 0 ref `drizzle` in qualsiasi package.json)
- [x] QW-2 | WS-K | `clean` script + retention `.next`/pg_dump_snapshots (−~31G) | script idempotente + doc | **DONE** (S993: `scripts/clean.sh` + `pnpm clean`/`clean:dumps`(dry-run, mai auto-delete restore-point)/`clean:deep`; ~32G regenerable. = QW-K1)
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
- [x] QW-C3 | WS-C | timer systemd settimanale per `dr-drill.sh` con alert RPO/row-count (F-WS-C-5) | run timer → `[dr-drill] PASS` + drift→exit!=0 | **DONE** (S993: `dr-drill.sh` strict-mode `DR_DRILL_STRICT=1` — exit!=0 SOLO su DR reale (no-backup / RPO>48h / restore rotto), il drift row-count fisiologico resta WARN; `heuresys-advanced-dr-drill.{service,timer}` Sun 04:00 + wiring vm-bootstrap. **VERIFICATO LIVE end-to-end** (restore reale 162/162/3180/12 OK, RTO 93s, PASS, exit 0). Lo strict-drill ha scoperto+fixato **2 bug DR reali**: (1) `ok`-flag dentro `$()` subshell → vecchio "PASS" sempre falso; (2) `pg_restore <abs-path>` come postgres falliva `Permission denied` (backup sotto /home/ubuntu 0750, non traversabile) → restore via **stdin**. Il backup "shipped" ora è provatamente restorabile.)
- [x] QW-C4 | WS-C | drop `sys_source_lineage_records_natural_key_idx` (10MB, idx_scan=0) verify-first (F-WS-C-2) | grep `ON CONFLICT natural_key`=0 + ingestion ok post-drop | **DONE-LIVE** (S993, mig `000131`: verified non-unique/no-constraint/0-scan/no-ON-CONFLICT → dropped live; `sys_source_lineage_records` 70MB→60MB. Reversible via 000025 def.)

## Quick-wins A6–A11 (S993; CLASS-A)

**DONE:**
- [x] QW-J1 | WS-J | enum-parse i 2 flag footgun (MATCHING_FREETEXT_ENABLED + API_DOCS_ENABLED) — `=false` non li accende più | typecheck api + shell-tests 45/0 | **DONE** (env.ts, fail-open chiuso)
- [x] QW-J2 | WS-J | denylist env-key-merge estesa ai 4 gate-flag (no propagazione dev→PROD) | shell-tests 45/0 | **DONE**

**TODO (residuo, chiudibili da Claude su via libera):**
- [ ] QW-A1 | WS-A | drop 3 dead deps (@tanstack/react-query-devtools, supertest, @types/supertest) + pino dev→deps | typecheck+api test(inject)+boot | TODO (richiede clean install)
- [ ] QW-A2 | WS-A | `build`+`lint` script ad apps/agent-gateway (oggi fuori da CI) | pnpm build/lint coprono il workspace | TODO
- [ ] QW-A4 | WS-A | fix menzione stale "supertest" in CLAUDE.md (harness reale = inject) | doc-only | TODO (parte di QW-I2)
- [ ] QW-D1 | WS-D | instrada 8 analytics + MermaidDiagram via `_charts-client` (next/dynamic) | next build + E2E + bundle echarts fuori chunk iniziale | TODO
- [ ] QW-D2 | WS-D | `experimental.optimizePackageImports` (lucide-react, @heuresys/ui) verify-first | build verde + bundle ridotto | TODO
- [ ] QW-E1 | WS-E | normalizza 9 prod `text-destructive`→`text-danger` + fix memo stale | axe serious=0 + i18n:check | TODO (verify-first contrast)
- [ ] QW-E2..E5 | WS-E | i18n SystemHealthDashboard + EmptyStates · isError branch ~5 pagine · de-dup primitive (→@heuresys/ui DOSSIER) | i18n:check + E2E | TODO
- [ ] QW-I1 | WS-I | rewrite README headline/stack/layout (12 numeri stale) | numeri = live | TODO
- [ ] QW-I2 | WS-I | fix 4 punti CLAUDE.md drift (60→75 mod, 55→130 mig, 586→600 map, endpoint/test line) | numeri = live | TODO
- [ ] QW-I3 | WS-I | rigenera INDEX_PATHS via build_index.py | paths/moduli live | TODO
- [ ] QW-I4 | WS-I | fix FINDINGS/README register (WS-A/D/E/J/K/I = DONE) | register allineato | TODO
- [ ] QW-J3 | WS-J | assert `TRUST_PROXY=1` in vm-bootstrap/provision-linux-pc (governance; runtime già ok D-28) | grep post-bootstrap non-false | TODO
- [ ] QW-K3 | WS-K | retention/archival off-disk dei 27 pre-op dump (3.7G) — MAI auto-delete | decisione Enzo (couples WS-C F-5 / WS-G F-2) | TODO (dossier)

> **Dossier anti-drift (WS-I, decide Enzo)**: README/CLAUDE/INDEX vivono fuori dal flusso `handoff` → il fix one-shot ri-drifta (già successo con D-01). Opzioni: de-hardcode i counts (→SOT_STATE) · CI drift-check shell-test · generare le sezioni-conteggio dal `handoff`.

## Quick-wins WS-B backend (da `FINDINGS/WS-B.md`, S993; CLASS-A)

**DONE:**
- [x] QW-B1 | WS-B | broadcast `POST /v1/notifications` set-based (no N+1) (F-WS-B-1 CRITICAL) | broadcast a ≤500 utenti = 3 query totali, notifications suite verde | **DONE-LIVE** (`emit.ts emitNotificationsBulk`: opt-out lookup + unnest INSERT; service.ts usa bulk; typecheck + notifications 13/13. NB schema già `.max(500)` — l'N+1 1000-1500q→3q era il difetto reale)

**TODO (residuo, chiudibili da Claude su via libera):**
- [x] QW-B2 | WS-B | LIMIT+cap su insights flight-risk/readiness/skill-gap + engagement.listSurveys (F-WS-B-2 HIGH) | suite verde | **DONE** (S993: `LIMIT 5000` cap difensivo sulle 3 read insights + listSurveys — chiude il full-table illimitato; comportamento identico oggi, typecheck + insights/engagement/surveys 34/34. Paginazione esposta completa + org-unit-processes/content-blueprint-links = DOSSIER F-WS-B-6, autorità Enzo)
- [ ] QW-B4 | WS-B | estrai shared `ActorContext`+`actor()`+`isPlatform()` (~150 dup, =QW-4) (F-WS-B-3) | typecheck+test(576) verdi, diff meccanico | TODO
- [ ] QW-B5 | WS-B | `paginationSchema(max)` factory (caps 200/500/1000 incoerenti) | ~60 schemi la usano, test invariati | TODO
- [ ] QW-B6 | WS-B | sposta `withTransaction` da auth/repository.ts a db/client.ts (=QW-4) | typecheck + auth/content/reference-sync verdi | TODO
- [ ] QW-B3 | WS-B | de-N+1 teams my-team (batch members) | `/v1/me/team` 2 query, payload identico | TODO
- [ ] QW-B7 | WS-B | doc-fix CLAUDE.md error-envelope (requestId = header `x-request-id`, non body) | doc-only (parte di QW-I2) | TODO
