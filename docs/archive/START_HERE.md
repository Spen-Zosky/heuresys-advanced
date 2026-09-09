# START HERE — Heuresys Advanced HRMS/BPM Platform v5

> **Entry point per ogni nuova sessione di lavoro su questo repository.**
> Leggi questo file PRIMA di scrivere qualsiasi codice o decisione architetturale.
> Mantenuto allineato con `docs/BOOTSTRAP_EXECUTION_PLAN.md` §9 Decision Log.

---

## Stato attuale del progetto

**Fase**: Planning completo, **Section 19 unlocked**, MVP‑0 ready to start.

**Repo**: `D:\heuresys-advanced\` · branch `main` · 2 commit · clean.

**Approvazione formale**: 2026‑05‑16 (vedi RD‑24 in `docs/BOOTSTRAP_EXECUTION_PLAN.md` §9.1).

```bash
git log --oneline
# 59b898c  chore(bootstrap): record formal user approval — Section 19 unlocked (RD-24)
# c928034  chore(bootstrap): Section 18 planning phase complete — 10 deliverables + ADR-0011
```

---

## Priming obbligatorio per nuove sessioni Claude/AI

Prima di scrivere o modificare qualsiasi cosa, leggi nell'ordine:

| # | File | Cosa contiene |
|---|------|---------------|
| 1 | `docs/BOOTSTRAP_EXECUTION_PLAN.md` | Overview top‑level, 14 invarianti (§2), 11 ADR table (§3), MVP‑0/1/2 roadmap (§5), acceptance test matrix (§6), Mermaid sequence (§7), risk register R1‑R15 (§8), decision log RD‑01..RD‑24 (§9) |
| 2 | `docs/architecture/ADR_INDEX.md` | Registro 11 ADR (10 Accepted + 1 Open) |
| 3 | `docs/db/TARGET_SCHEMA_DESIGN.md` | ~123 sys + 10 views + 10 aux tables con DDL outline |
| 4 | `docs/db/MIGRATION_IMPLEMENTATION_PLAN.md` | 27 migrations, script PowerShell + Bash, idempotency contract |
| 5 | `docs/security/AUTH_SECURITY_PLAN.md` | 11 auth tables, Argon2id, CSRF, ~100 perms, ESS §6.1 |
| 6 | `docs/api/API_IMPLEMENTATION_PLAN.md` | Fastify, 23 modules, 148 endpoints, modulo `me/` §6.5 |
| 7 | `docs/frontend/FRONTEND_IMPLEMENTATION_PLAN.md` | Next 15 App Router + ESS portal MVP‑2b |
| 8 | `docs/brownfield/BROWNFIELD_*.md` | 4 file — usati solo post‑MVP, non per MVP‑0/1/2 |

In parallelo dove possibile. Tempo di priming stimato: 15‑30 min lettura focalizzata.

---

## Decisioni ancora aperte (rispondi PRIMA di scrivere codice)

| Q | Decisione | Default suggerito | ADR riferimento |
|---|-----------|--------------------|------------------|
| **Q1** | Backend framework | **Fastify 4** (ADR‑0002 Accepted‑overridable) | adr/0002 |
| **Q2** | DB access | **Drizzle ORM + raw SQL migrations** (ADR‑0003 Accepted‑overridable) | adr/0003 |
| ~~Q4~~ | ~~PostgreSQL runtime location~~ | **Chiusa 2026‑05‑16 → ADR‑0010 = Option B (OCI VM `oracle-vm-default`, tunnel port 5433). Vedi RD‑25** | adr/0010 (Accepted) |
| **Q6** | Faker seed per RTL_BANK_REFERENCE | **42** (deterministic) | MIGRATION_IMPLEMENTATION_PLAN §6 |
| **Q7** | Brownfield wave order | **1 → 2 → 3 → 4** canonical | BROWNFIELD_IMPORT_PLAN §7.1 |
| **Q8** | OpenAPI contract location | Copy in `apps/api/openapi.yaml` curated | API_IMPLEMENTATION_PLAN §7 |

> Q3 (DB name) e Q5 (cookie+CSRF) sono **già risolte** nella sessione precedente:
> - Q3 = `heuresys_advanced` (DB) + `heuresys` (role) — vedi RD‑01.
> - Q5 = `SameSite=Lax` + double‑submit CSRF — vedi RD‑06.

---

## Vincoli operativi non negoziabili (sintesi)

| # | Vincolo | Riferimento |
|---|---------|-------------|
| I1 | Position‑centric (non Employee‑centric). Position owner ≠ Incumbent | BOOTSTRAP §2 |
| I3‑I4 | Schema canonical = `sys`. Aux: `staging`, `brownfield`, `audit`. Mai `usr_*`, mai `br_*` | BOOTSTRAP §2 |
| I5 | Tenant isolation = FK + API middleware filter. **Mai RLS** | BOOTSTRAP §2 |
| I7 | Auth separato da `sys.sys_users`: 11 tabelle dedicate `sys.sys_auth_*` | AUTH_SECURITY_PLAN §2 |
| I8 | Out of scope: payroll, T&A, benefits, medical, IAM, recruiting, onboarding, contracts body | BOOTSTRAP §2 |
| I9 | Position Intelligence Profile = `VIEW`/`MATERIALIZED VIEW`, mai blob JSONB | ADR‑0008 |
| I10 | Visualization layer separato: layout edits → `sys_visualization_node_layouts`, semantica intatta | ADR‑0009 |
| I12 | Brownfield = enrichment source only; v5 architecture wins | BOOTSTRAP §2 |
| I13 | PostgreSQL 16 NATIVO. **No Docker**. Runtime location per ADR‑0010 | ADR‑0004 |
| RD‑08 | Categorical fields = `varchar(N) + CHECK`, **non** PostgreSQL ENUM | TARGET_SCHEMA_DESIGN §0.6 |
| RD‑09 | `date` per date‑only; `timestamptz` solo dove serve precision tempo | RD‑09 |
| RD‑02 | Brownfield: dati demo (no PII reale). Niente anonymization | BROWNFIELD_IMPORT_PLAN §5 |
| ADR‑0011 | ESS in scope come MVP‑2b: 13 pages `/me/*` + 18 endpoint `/v1/me/*` + 19 self‑scope perms + ESLint guard | adr/0011 |

---

## Architettura sintetica

```
heuresys-advanced/
├── apps/
│   ├── api/      Fastify 4 + Drizzle + Zod + Argon2id (MVP-1, 23 modules, 148 endpoints)
│   └── web/      Next 15 App Router + React 19 + Tailwind 4 + shadcn/ui + bilingual it/en (MVP-2: admin + ESS)
├── packages/
│   └── shared/   Zod schemas + TS types (cross client+server)
├── db/
│   ├── migrations/   27 idempotent *.sql (000001..000027, 26 v5 + 1 ESS)
│   ├── seeds/        CSV + INSERT idempotent
│   └── scripts/      create_local_database / migrate / reset / validate (PS1 + SH)
├── tests/        vitest + supertest + playwright
├── qa_artifacts/ acceptance outputs + diagrams (Mermaid PNG/SVG)
└── docs/         questo planning (canonical) + source_bundle/ (read-only) + ADR + brownfield
```

**DB target**: PostgreSQL 16 native, schema `sys` canonical, ~123 tabelle. DB name `heuresys_advanced`, role `heuresys`. Runtime location deferred per ADR‑0010.

**Auth target**: 11 tabelle `sys.sys_auth_*`, Argon2id 64/3/4, JWT 15min + refresh 30d rotated con replay detection, HttpOnly cookie + CSRF double‑submit, ~100 permissions, 8 ruoli (PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER, USER, READ_ONLY).

**Brownfield**: 576 tabelle legacy classificate (93 IMPORT + 180 TRANSFORM + 219 REFERENCE_ONLY + 84 EXCLUDE). 4 wave post‑MVP per importare 273 source tables → ~70 canonical. Dati demo (no PII reale), no anonymization.

---

## Primo task concreto (MVP‑0 step 5.0.1)

Dopo aver risposto a Q1/Q2/Q4:

1. Inizializza `package.json` + `pnpm-workspace.yaml` + `tsconfig.base.json` + `.env.example` (3 blocchi commentati per ADR‑0010 A/B/C runtime).
2. Crea cartelle root: `apps/api/`, `apps/web/`, `packages/shared/`, `db/{migrations,seeds,scripts}`, `tests/{db,api,e2e}`.
3. Aggiorna `.gitignore` se serve (verifica vs quello esistente).
4. **NESSUNA installazione `pnpm install` automatica** — chiedi prima di toccare `node_modules/`.
5. Verifica acceptance: `pnpm install` succeeds (dopo conferma).

Poi prosegui sequenzialmente con MVP‑0 step 5.0.2 → 5.0.7 (script PostgreSQL → migrations DDL → twice‑run proof → validation views → seed `RTL_BANK_REFERENCE`).

Riferimento dettagliato: `docs/BOOTSTRAP_EXECUTION_PLAN.md` §5 MVP Roadmap.

---

## Regole di lavoro (CLAUDE.md di Enzo)

- Rispondi sempre in **italiano**. Terminologia tecnica e codice in inglese.
- Prima di operazioni su file: mostra piano + attendi conferma (regola 4 CLAUDE.md).
- Mostra diff prima di applicare modifiche.
- Mai cancellare file senza conferma esplicita.
- Windows: PowerShell 5.1 con path assoluti; `cmd.exe` non è nel PATH di Enzo.
- Mai committare senza richiesta esplicita. Mai pushare.
- Le sub‑directory gitignored `docs/source_bundle/brownfield/extracted/` e `docs/brownfield/_inspection_artifacts/` sono lavoro transiente — non toccare se non richiesto.

---

## ADR registrate (11)

| ADR | Title | Status |
|----:|-------|--------|
| 0001 | Monorepo pnpm workspaces | Accepted |
| 0002 | Backend Fastify 4 | Accepted (overridable Q1) |
| 0003 | DB Drizzle + raw SQL | Accepted (overridable Q2) |
| 0004 | No Docker, native PG | Accepted (hard policy) |
| 0005 | Argon2id 64/3/4 | Accepted |
| 0006 | JWT + refresh + cookie + CSRF | Accepted |
| 0007 | Next 15 App Router | Accepted |
| 0008 | PIP = view, not blob | Accepted |
| 0009 | sys_visualization_node_layouts separate | Accepted |
| 0010 | PG runtime location — Option B (OCI VM, tunnel 5433) | Accepted |
| 0011 | ESS in scope as MVP‑2b | Accepted |

ADR aggiuntive previste (post‑MVP):
- ADR‑0012 React Flow Pro licensing (prima di produzione commerciale)
- ADR‑00XX Eventuali promozioni brownfield (per ogni table promoted)
- ADR‑00XX MFA enforcement strategy
- ADR‑00XX OCI VM closure (quando ADR‑0010 si chiude)

---

## Decision Log (24 entries)

Lista completa in `docs/BOOTSTRAP_EXECUTION_PLAN.md` §9 + §9.1. Sintesi:

- **RD‑01** DB rename → `heuresys_advanced` / role `heuresys`
- **RD‑02..03** Brownfield demo data (4 tenants, 270 employees, no anonymization)
- **RD‑04** ESS in scope (ADR‑0011)
- **RD‑05..06** Argon2id 64/3/4 + SameSite Lax confermati
- **RD‑07** Aggiunta `auth:revoke_user` permission
- **RD‑08..09** varchar+CHECK + date type
- **RD‑10..11** 2 nuove tabelle ESS + 27 migrations totali
- **RD‑12** Bilingual it/en da MVP‑2
- **RD‑13** React Flow Pro warning
- **RD‑14** READ_ONLY → /me view‑only
- **RD‑15..16** P99 PIP 600ms + MV fallback + pool 20
- **RD‑17** Risk R12‑R15 (bus factor, ARM64, bleeding‑edge, ESS expansion)
- **RD‑18..22** Brownfield refresh PR mandatory, DGOV breakdown, exact wave counts, promotion process 16‑step, wave runner docs step 9.0
- **RD‑23** Mermaid PNG/SVG generato
- **RD‑24** Approvazione formale Section 19 unlocked

---

## Risorse esterne disponibili (autorizzate dall'utente)

Per future sessioni Claude/AI: l'utente ha autorizzato accesso completo (inclusi env files, API keys, credenziali per siti web, CLI tools, DBMS e qualunque altra credenziale presente) a due location del codebase legacy **heuresys-evo** che sono la sorgente del brownfield import:

| Sistema | Path | Note |
|---|---|---|
| Windows PC locale | `D:\evo.heuresys.com\` | codebase legacy + tutte le sub-directory |
| OCI VM `oracle-vm-default` | `/home/ubuntu/heuresys-evo` | codebase live; eventuale runtime PostgreSQL brownfield |

**Vincoli operativi**: non stampare segreti in chat/output, usarli solo operativamente. Mai committare path assoluti hardcoded in `heuresys-advanced` (usare `BROWNFIELD_IMPORT_PLAN.md` come canonical pointer). Le directory restano READ-ONLY se non c'è richiesta esplicita di modifica.

**Quando usarle**:
- Step 5.0.2: ispezione PG preesistente sulla VM (riuso vs nuovo install)
- ADR-0010: topologia PG VM (porta, pg_hba.conf, DB esistenti)
- Brownfield waves post-MVP: sorgente canonical per import → trasformazione
- Credenziali: siti, CLI, DBMS, API key di terze parti
- **MVP-2 UI riuso**: il brownfield contiene componenti, librerie e asset visivi estesi che l'utente ha autorizzato a riusare come **shared** in `apps/web` invece di ricostruire da zero. Strategie da valutare in MVP-2 entry (workspace `@heuresys/ui`, symlink, cherry-pick); recon component inventory è prerequisito a step 5.2.1. Open question: compatibilità React/Next 15/Tailwind 4 vs versioni legacy.

---

## Apri ogni nuova sessione così

1. Leggi questo file (`START_HERE.md`).
2. Leggi i 7 file di priming sopra (in parallelo).
3. Verifica `git log --oneline` e `git status --short` per stato attuale.
4. Conferma di aver letto e di avere chiaro lo stato architetturale.
5. Chiedi a Enzo le risposte a Q1/Q2/Q4 (minimo) + Q6/Q7/Q8 (se vuole chiudere tutto in un colpo).
6. Aspetta la conferma esplicita; poi parti con MVP‑0 step 5.0.1.

**Mai partire prima**. Mai assumere. Mai re‑planare.
