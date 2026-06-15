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
