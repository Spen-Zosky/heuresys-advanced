# 01 — Discovery & baseline — heuresys-advanced

> DD investor-grade. Postura: **indipendente / avversariale** (il diavolo dell'investitore). Tutto il materiale interno (`docs/kb/**`, `docs/kb/improvement/**`, ADR, debt register) è trattato come **rappresentazione del venditore**: input, non verità. Ogni claim materiale è rivalidato con tool reali. Data: 2026-06-17. HEAD `ce26608` (S994). Ambiente: host Windows (Git Bash), tunnel SSH :5433 → OCI VM PostgreSQL 16.14 (aarch64).

## Cos'è (status quo a colpo d'occhio)

HRMS/BPM SaaS multi-tenant. Monorepo pnpm: **Fastify 5.8 API** (Zod 4 type-provider, Argon2id, RS256 JWT, RBAC DB-driven) su **PostgreSQL 16 nativo** (NO Docker — ADR-0004) raggiunto via tunnel SSH alla VM OCI free-tier; **Next.js 16** admin SPA + ESS portal; **`@heuresys/ui`** design-system npm-published; **showcase** static site su GitHub Pages. Dichiarato **v1.0.0 GA** (tag `v1.0.0`, 2026-06-02) con programma post-v1 in corso ("ondata 1"). **Dati = case-study sintetici** (legacy `heuresys-evo`), **nessun tenant cliente reale** (ADR-0023 no-PII by-design). Single developer (Enzo). Programma di miglioramento interno "RELEASE 100X" già eseguito (audit forense A1..A11 + 14 dossier decisionali) — è lo "scenario di brevissimo periodo".

## Baseline misurata (comandi riproducibili, output reale — HEAD ce26608)

| Metrica | Valore live | Comando | vs claim venditore |
|---|---|---|---|
| Moduli API (dir) | **75** | `ls -d apps/api/src/modules/*/` | claim BASELINE_METRICS=72 (S985) → cresciuto |
| `routes.ts` | 75 | `find apps/api/src -name routes.ts` | — |
| Endpoint (`app.<verb>(`) | **424** | `grep -rhoE "app\.(get\|post\|patch\|put\|delete)\(" apps/api/src/modules` | claim ~407 → cresciuto |
| Shared Zod schemas | 79 | `ls packages/shared/src/schemas/*.ts` | claim 75 |
| Migration `.sql` | **130** (max `000131`, gap 000035) | `ls db/migrations/*.sql` | claim 108 (S985) → +22 |
| ADR | 23 | `ls docs/architecture/adr/*.md` | confermato |
| File test integration API | **148** | `find apps/api/test -name '*.test.ts'` | claim 130 → cresciuto |
| Blocchi `it()/test()` | **1012** | `grep -rhoE "\b(it\|test)\(" apps/api/test` | claim 901 → +111 |
| Web `page.tsx` | 85 | `find apps/web/src/app -name page.tsx` | claim 83 |
| Playwright spec | 48 | `find apps/web -name '*.spec.ts'` | claim 47 |
| LOC TS/TSX (no `.d.ts`) | ~35.8k | `git ls-files 'apps/**/*.ts*' 'packages/**/*.ts' \| xargs wc -l` | claim ~26.3k (esclude tsx) |
| **Typecheck (5 ws)** | **exit 0 — pulito** (~30s wall) | `pnpm typecheck` | CONFERMATO |
| **`pnpm audit --prod`** | **0 vulnerabilità note** | `pnpm audit --prod` | CONFERMATO (WS-H) |
| Tabelle `sys.*` | **193** | `information_schema.tables` | — |
| Tenancies (tutte) | **2** (RTL_BANK + Heuresys) | `count(*) sys.sys_tenancies` | CONFERMATO (case-study) |
| Users / Positions | 162 / 162 | live | position-centric (I1) |
| Roles / Permissions / role×perm | 11 / 137 / **600** | live | CONFERMATO |
| Org units | 26 | live | |
| Skills (ESCO) | **21.939** | live | D-32/33 chiusi |
| Occupation→skill reqs | **126.051** | live | D-33 import live |
| refresh_tokens / login_events | **39.440 / 62.410** | live | ⚠ ricresciuti dopo pruning WS-C (37k) → auth-audit unbounded (WS-C F-4 / D-37) |
| Reconciliation registry | **148 POP / 21 NO_SOURCE / 9 EXCL / 1 REF** | `sys.v_reconciliation_status` | evolve (S985: 142/21/7/2) |

**Stack/toolchain** (da `package.json`): TypeScript 6.0.3, Next.js 16.2.7, Fastify 5.8.5, Zod 4.4.3, vitest 4.1.8, pnpm 9.15.0. Node dev-host v24.3.0 (target engines ≥22 — drift dev-host, non blocker; D-36 chiuso con wrapper).

**Footprint** (claim S985, da rivalidare per T8/X): repo on-disk ~31G (24G `.next` dev-cache + 3G showcase + 3.7G dump rigenerabili), `.git` 28M (sano). Cleanup script `pnpm clean` shipped (QW-2).

## Lettura: il codebase è in evoluzione attiva

I counts live (S994) sono sistematicamente **superiori** alla baseline 100X (S985): +3 moduli, +17 endpoint, +22 migration, +111 test case in ~4 giorni di sessioni. Conferma sviluppo ad alta cadenza ma anche **drift cronico delle SoT/doc** (tema ricorrente: D-01, WS-I, QW-I1..I4). 242+ commit direct-to-main dal v1.0.0, 0 merge (WS-G). Per l'investitore: forte velocity individuale, ma il modello operativo è **single-contributor con governance leggera** (X3).

## Claim del venditore da rivalidare (estratti — assegnati ai workstream)

| # | Claim del venditore | Fonte | Pilastro | Stato iniziale |
|---|---|---|---|---|
| C1 | "v1.0.0 GA, live in produzione (HTTPS www.heuresys.com)" | CLAUDE.md, MASTER_PLAN | P1/T9 | da verificare live |
| C2 | "424 endpoint, ognuno coperto da test integration su DB reale, 0 mock" | BASELINE_METRICS, WS-F | T2/T9 | parziale (1012 it, ma 73/75 mod) |
| C3 | "Auth self-built completa: Argon2id, RS256, refresh-rotation+replay, CSRF, MFA 4-kind" | Security model | T6 | da verificare avversarialmente |
| C4 | "0 IDOR / 0 tenant-break / 0 SQL-injection (SQL 100% parametrico), Zod 415/415" | WS-B, WS-H | T6/T5 | da rivalidare |
| C5 | "Tenant isolation = FK + middleware, MAI RLS (I5)" | Invarianti | T5/T6 | da verificare |
| C6 | "CI SPOF: 7/8 workflow su runner self-hosted unico = la VM prod; 1 CRITICAL fork-PR ACE su host prod (D-08)" | WS-G | T8/T6 | confessato dal venditore → verificare gravità |
| C7 | "Backup DB schedulato + DR drill verificato live (RTO 93s, restore reale)" | WS-C QW-C3 | T8 | da verificare |
| C8 | "0 dead-dep, 0 env non documentate, drizzle rimosso" | WS-A, QW-1/3 | T3/T4 | parz. confermato (audit prod pulito) |
| C9 | "BPM = solo modeling statico, nessun runtime (process-instance/task/SLA)" | POST_V1_ROADMAP §3.3 | P1/X1 | gap funzionale confessato |
| C10 | "Nessun tenant reale; dati sintetici no-PII (ADR-0023); GDPR tooling gated al primo tenant" | ADR-0023, roadmap | X2/P3 | da pesare per investor |
| C11 | "AI/ML: pgvector embeddings, voyage-client, flight-risk/skill-gap/matching/succession" | SOT_STATE | T7/P4 | da verificare robustezza/eval |
| C12 | "debt register: 37 debiti, 36 RISOLTI con evidenza, 1 aperto-minore" | DEBT_REGISTER | T3/X3 | spot-check campione |

## Domande al founder (non-discoverable dal repo) + assunzioni esplicite per procedere

> Per la rubrica P3 (business model & economics) e X2 (legal/IP) servono dati non presenti nel repo. Li raccolgo qui; procedo con **assunzioni dichiarate** e marco i finding relativi `da confermare`.

| # | Domanda | Assunzione di lavoro (in assenza di risposta) |
|---|---|---|
| Q1 | Financials: revenue attuale, ARR, clienti paganti? | **Pre-revenue, 0 clienti paganti** (coerente con "case-study sintetico, 0 tenant reali"). |
| Q2 | Funding ask, runway, burn? | **Pre-seed/bootstrap; burn ≈ costo infra OCI free-tier ≈ €0 + tempo founder**. |
| Q3 | Pricing/monetizzazione previsti? | **Non definiti** (nessun pricing/billing nel codice). |
| Q4 | Target di mercato / ICP (SMB vs enterprise, geografia)? | **HR/BPM mercato EU/IT** (CCNL, ATECO, lingua IT, banking-native RTL). |
| Q5 | Titolarità IP / contributi terzi / licenze? | **IP 100% del founder** (sole-coder, repo proprio); OSS deps MIT/Apache prevalenti — da verificare X2. |
| Q6 | `@heuresys/ui` e `heuresys-evo` legacy: proprietà e licenza? | **Stesso owner** (sorgente dati legacy autorizzata, lib UI propria npm-published). |
| Q7 | Team: assunzioni previste post-funding? | **Single developer oggi**; scalare il team è parte del use-of-funds → bus factor = rischio chiave (X3). |
| Q8 | Compliance target (GDPR/AI Act) e timeline GA-commerciale? | **GDPR/AI Act non implementati by-design** (no-PII); diventano prerequisiti al primo tenant reale. |

## Mappa architetturale (sintesi — dettaglio nei workstream)

```
heuresys-advanced (monorepo pnpm)
├─ apps/api        Fastify 5.8 · 13-step plugin chain · 75 moduli /v1/* · 424 endpoint · RBAC cache boot
│                  repo raw-SQL parametrico · withTransaction · pg single pool
├─ apps/web        Next.js 16 App Router · admin SPA + ESS /me/* · TanStack Query · live-data only
├─ apps/showcase   Next.js 16 static export → GitHub Pages (brand)
├─ apps/agent-gateway  Claude Agent SDK gateway (subscription MAX auth) — fuori da CI build/lint (WS-A)
├─ packages/shared @heuresys/shared — 79 Zod schemas + types (subpath exports)
├─ db/migrations   130 SQL idempotenti (twice-run proven)
└─ infra           OCI VM (api:8013 + web:3013, systemd, nginx TLS) · self-hosted CI runner (SPOF) · linux-pc twin
```

Esterni: PostgreSQL 16 nativo (OCI VM), nginx TLS (`www.heuresys.com`), GitHub Actions (8 workflow, 7 su runner self-hosted=VM prod), ESCO/ISTAT reference-sync (HTTP, fixture in CI), Voyage embeddings + pgvector, Claude Agent SDK (agent-gateway, subscription).

## Gate Fase 0 — superato
Baseline = numeri reali (no TBD) ✅ · lista claim completa e assegnata ✅ · domande founder + assunzioni esplicite ✅ → procedo a Fase 1 (live E2E) + workstream.
