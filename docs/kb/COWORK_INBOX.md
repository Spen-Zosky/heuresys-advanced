# COWORK_INBOX — canale proposte Cowork → CLI (write-back single-writer)

> Unico file su cui **Cowork** può scrivere nella SoT di stato. Cowork **appende** qui le proposte di
> cambiamento (stato, backlog, debiti, nuove azioni); il **Claude Code CLI** le riconcilia, applica ai
> file `docs/kb/*` autoritativi e committa. Tutto il resto di `docs/kb/` è read-only per Cowork.
> **Single-writer/committer della SoT = CLI.** Vedi `COWORK_ARCHIVE_NOTE.md` + preferences v5.1.

## Protocollo
- Cowork: aggiungi una entry in fondo con data ISO + tipo (`proposta-stato` / `proposta-backlog` / `debito` / `nota`) + corpo conciso evidence-based (file:line, comando, fatto reale — mai assunzioni).
- CLI: a inizio sessione legge questo inbox, riconcilia nelle SoT (`SOT_STATE`/`SOT_BACKLOG`/`DEBT_REGISTER`), marca l'entry come `[RICONCILIATA <commit>]`, committa.
- Non cancellare entry: marcarle riconciliate (audit trail).

## Entries

<!-- formato:
### YYYY-MM-DD | <tipo> | <titolo>
<corpo>
stato: pending | [RICONCILIATA <short-sha>]
-->

### 2026-05-30 | proposta-backlog | Connettore SuccessFactors → Heuresys (design riconciliato)

Prodotto design esplorativo riconciliato con la SoT reale: `docs/integrations/successfactors_heuresys_reconciled_design_2026-05-30.md` (creato da Cowork; mirror in `C:\Users\enzospenuso\Claude Desktop\outputs\`). Riconcilia un design web standalone (schemi `sf_raw/sf_stg/sf_sync` + target `core.*` inventato, costruito senza accesso a docs/kb) con l'architettura brownfield/SDBI esistente.

Decisione architetturale evidence-based (verified-by: mig 000024/000025/000030/000036 + ADR-0014 + inventario sys.sys_* su 000004/000006/000009/000010/000011/000012/000019):
- **NON** un sottosistema `sf_*` (viola I3/I4: aux schema = staging/brownfield/audit).
- **β** brownfield-come-nuova-sorgente per entità con target `sys.*` esistente (SF = nuova `source_system='SUCCESSFACTORS'`; buffer `staging.sf_<entity>`; riuso `column_mappings` + upsert + `sys_source_lineage_records`).
- **γ** SDBI (ADR-0014) per i gap senza target (EmpEmployment, anagrafica PII ricca, base salary).
- Unico net-new persistente: `brownfield.source_watermarks` (HWM delta) + connettore Node/TS OAuth/extract.

Un flag invariante (regola §9 "fermarsi e chiedere"), da confermare prima di implementare:
- ⚠️ **I3/I4**: buffer in `staging.sf_*`, non in schema `sf_*` nuovo.

~~🔴 I12 PII/GDPR~~ **RITIRATO 2026-05-31 (ADR-0023)**: no-PII globale — il prodotto è un case-study sintetico e non ingerisce PII reale → nessun blocco PII per SF.

Proposta: se Enzo approva, CLI valuta (a) adozione del doc nel repo + (b) apertura item `SOT_BACKLOG.md` "Connettore HRIS esterno (SF/Workday/Zucchetti)" come candidato MVP-4 futuro. Nessuna migration creata/applicata (DDL nel doc è PROPOSED/DO-NOT-APPLY).

stato: pending — [CLI S951: doc committato `c363ef1`; flag 🔴 I12 RITIRATO via ADR-0023 (no-PII globale); resta da decidere (b) adozione connettore come item MVP-4]


### 2026-06-14 | proposta-backlog | #9 Integrazione Agent SDK del plugin human-resources-plus (pilota "blueprint builder" banca retail)

Contesto: il plugin Claude Code **human-resources-plus** (repo privato `Spen-Zosky/human-resources-plus`, v2.6.0, 48 skill + 6 agenti) deve diventare callable dalle webapp di heuresys-advanced via Agent SDK, con le `/v1/*` esposte come tool MCP. Design completo lato Cowork (read-only su questo progetto): vedi nel repo plugin `docs/PLATFORM_MAP.md`, `docs/MCP_TOOL_CATALOG.md`, `docs/AUTH_AND_COMPLIANCE_DESIGN.md`, `docs/BLUEPRINT_BUILDERS.md`, `docs/SDK_INTEGRATION_PLAN.md`.

Findings forensi (verified-by, read-only su `apps/api/src`):
- Auth: unico canale = JWT cookie `hrx_access` (RS256, 15m) via `POST /v1/auth/login`; **nessun account di servizio/API-key/Bearer** (`middleware/auth.ts`, `app.ts` plugin chain, `modules/auth/tokens.ts`); tenant+roles nel claim; CSRF `hrx_csrf`==`x-csrf-token` sulle write (`middleware/csrf.ts`); MFA ON default.
- Blueprint: un `sys_blueprint_variants` è solo header + `sys_blueprint_process_registry` (processi) + `process-kpi-templates`; **non contiene** org-unit/ruoli/skill/KPI-tenant. `POST /v1/blueprint-activations` scrive **una riga di link** tenant→variant, **non istanzia nulla** (`blueprint-activations/service.ts`). L'archetipo banca (158 utenti) è prodotto da `db/scripts/seed-reference-bank.ts`, non dall'attivazione. Typing (`enterprise-typing-profiles`) **non** seleziona variant (nessun FK/recommender).
- Wave-executor: non riusabile come bulk-apply generico (input = `wave` int, legge da `legacy_mirror.*`, PLATFORM_ADMIN); è solo il modello di idempotenza (natural-key + content-hash + `ON CONFLICT`).

Decisioni già prese con Enzo (da implementare CLI-side):
1. **Auth ibrido**: ops user-scoped via sessione utente forwarded dalla webapp; autoria catalogo via **service user PLATFORM_ADMIN dedicato** con **esenzione MFA** (config) — da provisionare. Credenziali in secret store (mai loggate, R11).
2. **Materializzazione in fasi**: (A) il builder persiste al piano catalogo/template; (B) **nuovo generatore per-tenant** (emula `seed-reference-bank.ts`, idempotente `ON CONFLICT`) che istanzia org-units/positions nel tenant → endpoint nuovo `tenant.materialize`, gated come ogni write.

Work items proposti per il CLI (net-new heuresys-side):
- (a) provisioning service user PLATFORM_ADMIN + esenzione MFA per login headless;
- (b) layer/wrapper MCP (o backend SDK in `apps/`) che espone le `/v1/*` come tool con auth ibrido + CSRF;
- (c) generatore di materializzazione per-tenant (Phase B) idempotente;
- (d) opzionali: endpoint bulk-apply dedicato (imitando lineage wave-executor); campo *ranking/priorità* KPI; recommender typing→variant via `size_band_id`.

Pilota: blueprint-builder archetipo banca retail (8 step generate→plan→apply). Reference backend (mock-first, fuori da heuresys) prodotto da Cowork nel repo plugin `reference-backend/`. **Nessuna migration creata/applicata; nulla scritto qui fuori da questo inbox.**

stato: [RICONCILIATA 20fac45] — CLI 2026-06-15: PLAN heuresys-side prodotto in `docs/integrations/agent_sdk_mcp_integration_plan_2026-06-15.md` (5 work-item a/b/c/d + pilota; verifica forense indipendente sul codice reale). Le 3 scoperte design-changing + le decisioni auth-ibrido/materializzazione-in-fasi sono confermate e tradotte in WI-A..WI-D. Aperto item `SOT_BACKLOG.md §🔌 Integrazione #9` + delta `SOT_STATE.md`. **Nessuna migration applicata (DDL=PROPOSED).** Awaiting review Cowork + go Enzo sui punti aperti (§7 del PLAN): (1) meccanica esenzione MFA — flag DB A1 racc. / env A2 / naturale A3; (2) tenant del service user; (3) collocazione `apps/agent-gateway` (TS); (4) quali opzionali D; (5) KPI per-position vs template.


### 2026-06-15 | nota | REVIEW Cowork del PLAN #9 (Agent SDK + MCP) — verdetto GO-con-modifiche

Review architetto/supervisore del PLAN `docs/integrations/agent_sdk_mcp_integration_plan_2026-06-15.md` (`20fac45`). Read-only; nessun commit/edit fuori da questo inbox. Dettaglio completo in scratchpad Cowork `outputs/REVIEW_plan9_agent_sdk_2026-06-15.md`.

**Verdetto: GO-con-modifiche.** Il PLAN resta nel "come", gate "cosa" a Enzo OK, RBAC 11/586/133 e invarianti (I3/I4, I5, I8, ADR-0023, R11) coerenti, verifica forense §1 solida. 7 modifiche di hardening pre-esecuzione (nessuna riprogettazione):
- **M-1 (HIGH)** tenant isolation di `tenant.materialize`: gira come PLATFORM_ADMIN tenant-null -> tenantId dall'input, non dal JWT; serve validazione (esiste+ACTIVE) + conferma tenant nell'approval + test negativi cross-tenant; correggere la riga I5 di §2.
- **M-2 (HIGH)** test adversarial `canUseTool`: replay token, timeout->deny-by-default, principal confusion user/service, write senza token.
- **M-3 (MED)** I8 come allowlist deny-by-default esplicita del catalogo tool (non sola esclusione onboarding/recruit).
- **M-4 (MED)** specificare sink audit >=6 mesi; se tabella sys_* -> registry row nella stessa migration (classe D-22).
- **M-5 (MED)** gateway->/v1 rate-limit post-D-28 + CSRF lifecycle + mutex refresh proprio del service user.
- **M-6 (LOW)** idempotenza re-run pilota sull'attivazione (one-active-per-tenant -> PATCH vs POST).
- **M-7 (LOW)** users materializzati Phase B = persone credential-less, non crosswalk LEGACY_EMP:: (I14).
- chiarimento §7.2: A1 = controllo primario, tenant-null = difesa-in-profondita.

Restano i 5 punti aperti §7 = autorita Enzo (esenzione MFA A1/A2/A3, tenant service user, apps/agent-gateway TS, quali opzionali D, KPI per-position vs template).

stato: [RICONCILIATA 5f37cc1] — CLI 2026-06-15: verdetto GO-con-modifiche registrato; i 7 hardening M-1..M-7 + il chiarimento §7.2 recepiti nel PLAN §9 (`5f37cc1`). I 5 punti §7 sono chiusi dall'AMENDMENT sotto (riconciliato nello stesso commit).


### 2026-06-15 | proposta-stato | AMENDMENT PLAN #9 — 5 punti §7 chiusi (delega Enzo) + hardening M-1..M-7

Su delega Enzo, Cowork ha chiuso i 5 punti aperti §7 del PLAN `docs/integrations/agent_sdk_mcp_integration_plan_2026-06-15.md` e prodotto un amendment incorporabile in un passaggio. Dettaglio completo in scratchpad Cowork `outputs/AMENDMENT_plan9_agent_sdk_2026-06-15.md`. Read-only; nessun commit; DDL = PROPOSED/DO-NOT-APPLY.

**5 decisioni §7 (ancorate a precedente):**
- (a) Esenzione MFA: **A1 flag-DB = controllo PRIMARIO** in tabella **`sys.sys_auth_mfa_exemptions`** (NON colonna su `sys_users` — ancora **I7**: auth separato in `sys_auth_*`); **A3 tenant-null = difesa-in-profondita** (tensione A1-vs-A3 eliminata); A2 scartata. Guard `auth/service.ts §3b` via DI seam come `mfaEnforcement` (S989) + registry row stessa migration (classe D-22) + audit LOGIN_*.
- (b) Tenant service user: **platform-level (tenant-null)** — ancora §1.1 + catalogo globale (job-families `ensurePlatformAdmin`) + §7.2.
- (c) **`apps/agent-gateway` in TypeScript = SI** — monorepo TS + skeleton reference TS + SDK TS-native; client HTTP di `/v1`, non modulo `/v1` (no violazione module-pattern); pin SDK.
- (d) Opzionali: **abilita D2; rinvia D1 e D3**. D2 necessario (verifica 2026-06-15: `positions/routes.ts:162 /:id/kpis` read-only; `sys_position_kpi_requirements 000011:138` solo `weight`, no rank → "8 KPI ranked" non esprimibili). D1 coperto da SDK+WI-C; D3 = net-new senza precedente (no recommender, §1.8.7) → "cosa" separata.
- (e) KPI **per-position con rank (= D2)** per il ruolo flagship; template restano per livelli aggregati. **Edge I9**: estendere la VIEW PIP (`000011:284-299`) per esporre `rank`.

**7 hardening M-1..M-7** mappati a sezione/riga del PLAN (M-1 tenant isolation materialize §2/I5+WI-C, ancora wave-executor §1.5; M-2 adversarial canUseTool; M-3 I8 allowlist deny-by-default; M-4 audit-sink+registry; M-5 rate-limit post-D-28+CSRF+refresh mutex; M-6 idempotenza attivazione pilota; M-7 users Phase B credential-less I14).

**Impatto §6 migration**: M1 confermata (`sys_auth_mfa_exemptions`+registry), M4=D2 confermata (`rank`+VIEW PIP+endpoint), M5=D3 NON creata, +M0 audit-sink (se DB). Tutto idempotente, dopo `000115`.

Restano a Enzo solo i go operativi (nessuna ulteriore scelta §7 pendente). Prossimo passo: ingest CLI dell'amendment → esecuzione WI-A.

stato: [RICONCILIATA 5f37cc1] — CLI 2026-06-15: 5 decisioni §7 (a-e) + 7 hardening M-1..M-7 + impatto migration recepiti nel PLAN §9 + `SOT_BACKLOG §🔌 #9` + delta `SOT_STATE` (`5f37cc1`). D2 abilitato, D1/D3 rinviati; esenzione MFA in `sys.sys_auth_mfa_exemptions` (I7, non su `sys_users`). **DDL=PROPOSED, nessuna migration applicata.** Restano solo i go operativi di Enzo → esecuzione WI-A.
