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


### 2026-06-15 | nota | REVIEW #9 (re-review post-WI-A) — conferma GO + M-8 + 2 verifiche

Re-review evidence-based su HEAD `1a8738b`. **Verdetto: GO confermato** (allineato al GO-con-modifiche già riconciliato `5f37cc1`). PLAN solido e forense-grounded; WI-A ben impostato.

Conferme positive:
- WI-A esenzione MFA in **tabella dedicata** `sys.sys_auth_mfa_exemptions` (mig `000116`), **NON** colonna su `sys_users` → **I7** rispettato; registry D/EXCLUDE nella stessa migration; **default-safe** (tabella vuota = login byte-identico a pre-000116); idempotente. Guard in `auth/service.ts:~367` + `repository.ts:715` (`isUserMfaExempt`).
- `apps/agent-gateway` = workspace TS separato (client HTTP di `/v1`, non modulo Fastify) → no violazione module-pattern. WI-C `tenant-materialization` come modulo con dry-run + `ON CONFLICT` idempotente (coerente con Phase B). D2 (rank KPI) correttamente identificato necessario + edge **I9** sulla VIEW PIP. M-1..M-7 solidi.

Findings da recepire (nessuna riprogettazione):
- **M-8 (HIGH) — vincolare lo scope dell'esenzione a livello codice/DB, non solo operativo.** `isUserMfaExempt(userId)` (`repository.ts:715-728`) ha chiave solo su `userId`+`enabled=true`: una riga su un utente **umano** disabiliterebbe silenziosamente la sua MFA a tempo indefinito (unica traccia = audit `LOGIN_*` + colonna `reason`). La garanzia "solo service user" oggi è solo disciplina operativa. Raccomando: CHECK/guard che limiti l'esenzione a utenti **platform-level / tenant-null** (o vincolo a PLATFORM_ADMIN) + audit periodico del contenuto + alert su INSERT. (Estende M-2/M-4.)
- **V-1 (bloccante) — confermare che `000116` NON è stata APPLICATA al DB senza go.** Il file esiste e il guard è live (default-safe), ma il vincolo era "non applicare migration senza conferma". Verificare il ledger `sys_schema_migrations` (000116 atteso ASSENTE) e allineare i doc: PLAN header/§6 dicono ancora "DDL=PROPOSED/non creata" mentre `000116` è **creata+committata** → aggiornare in "creata, default-safe, da APPLICARE su go".
- **V-2 — WI-A sub-task 3 (seed service user) e 4 (test) mancanti.** Il path `exempt=true` è oggi dead-code non testato. Al seed del service user, i test devono coprire: (i) exempt=true salta il gate; (ii) **negativo**: un utente umano/tenant-scoped NON può essere esentato (se M-8 adottata); (iii) refresh/mutex (M-5).

Nessun blocco di design. Ordine confermato: WI-A → WI-B (mock-first) → WI-C → pilota → WI-D2.
stato: [RICONCILIATA baaf424] — CLI 2026-06-15: **M-8 implementato** (mig `000117` trigger eligibility — esenzione consentita solo a tenant-null OR PLATFORM_ADMIN; `user_tenant_id` è NOT NULL → ramo PLATFORM_ADMIN operativo; admin eligibile, tommaso USER bloccato) + test neg/pos, commit `9005adc`. **V-1**: 000116/000117 **APPLICATE** sotto il go "procedi" di Enzo (ledger `sys_schema_migrations` id 6828) — NON un'applicazione senza go; doc PLAN header/§6/§9 allineati a "creata+APPLICATA, default-safe" (`baaf424`). **V-2**: path `exempt=true` già testato (test "ACTIVE exemption"); negativo M-8 testato; seed service user = **WI-A.2** scaffolding opt-in `db/scripts/seed-service-user.ts` (`ca7c193`, no-op senza `AGENT_SERVICE_USER_*`, R11 — non creato live); mutex refresh (M-5) → WI-B. **WI-A ✅ DONE** (exemption 5/5, auth+mfa 83/83, typecheck verde). Prossimo: **WI-B (mock-first)**.


### 2026-06-15 | nota | REGOLA VINCOLANTE — Definition of Done = live E2E con dati reali

Regola di Enzo (vincolante, cross-sessione, su #9 e sviluppi futuri): **nessun task/step è "fatto" se non abilita l'uso reale live end-to-end con dati live.** Mock / placeholder / green-test = solo scaffold transitorio DENTRO uno step, **mai** endpoint accettabile. Step-by-step ok, ma ogni step si chiude SOLO con una **dimostrazione live su dati reali** (output reale allegato). Unica attesa ammessa: input che solo Enzo può fornire (secret/credenziale, approval umana) — R23(iii); in tal caso lo stato è **blocked-on-Enzo**, non "done".

Implicazione per #9 (acceptance LIVE, non mock — da recepire nel PLAN § acceptance e in SOT_BACKLOG #9):
- **WI-B.2 / read-live**: gateway in esecuzione → richiesta reale (sessione utente reale, es. login come persona fixture E2E) → `/v1` LIVE → **dati reali del tenant** in streaming a un client reale. Il mock vale solo come scaffold intermedio.
- **Write-live (gated)**: scrittura reale, approvata human-in-the-loop, **applicata** a un tenant (di test) reale, osservabile in piattaforma, reversibile.
- **Pilota-live**: generate → plan → **apply** di un blueprint reale su un tenant di test reale, osservabile.

Doc di riferimento (repo plugin): `docs/DEFINITION_OF_DONE.md`. Da riflettere come DoD per ogni WI.
stato: [RICONCILIATA 2f47ef2] — CLI 2026-06-15: DoD recepita e **persistita** in `CLAUDE.md §"Definition of Done — live E2E con dati reali"` (regola durevole, riletta a ogni sessione del repo) + acceptance LIVE in `SOT_BACKLOG #9` e nel PLAN §3.0 (commit `2f47ef2`). Vale per OGNI WI: chiusura SOLO con dimostrazione live su dati reali (output reale, R5); secret/approval/migration-apply mancanti → `blocked-on-Enzo`, mai "done".


### 2026-06-17 | proposta-backlog | Product Discovery: Business Scope + PRD + riposizionamento (deliverable in docs/product/)

Cowork ha eseguito un programma di Product Discovery a 5 fasi (DD forense `docs/due-diligence/` + 3 KB wiki [advanced-wiki ingegneristico, advanced-graph codice, **heuresys-wiki** prodotto/strategia mai entrato nella DD] + cartografia codice F0 + ricerca competitiva web live F2 + caccia funzionalità latenti F3). Colma un buco reale: **mancava il livello "prodotto"** (nessun PRD, nessuna ricognizione consapevole del funzionale implementato vs latente). Deliverable creati in `docs/product/` (cartella nuova, **fuori** da docs/kb): `BUSINESS_SCOPE_AND_PRD.md`, `COMPETITIVE_SCORECARD.md`, `LATENT_CAPABILITY_CATALOG.md`, `WORKITEM_GAP1_PERSPECTIVES_AND_SCORECARD.md`, + PRD `.docx`.

Findings chiave (verified-by, read-only su HEAD corrente):
- **Nessun runtime BPM**: `grep -riE "process_instances|tasks|approvals|workflow|sla" db/migrations` → 0 tabelle di runtime (solo blueprint statico + activation = riga-link; coerente con scoperte #9). Il claim "BPM" è oggi non mantenuto.
- **3 prospettive promesse, 1 implementata**: `find apps/web/src/app -type d` → 0 route Process-Owner/Org-Director (solo Porta HR). È il gap di prodotto #1.
- **Conteggi reali ri-derivati (F0)**: 75 moduli · ~399 endpoint dichiarati nei moduli (il "~424" storico include health/auth) · 130 migration · 180 tabelle `sys.*`.
- **Tesi "Organizational Intelligence" come *nuova categoria* non regge al mercato 2026**: Forrester Skills Intelligence Solutions Landscape Q1 2026 = **27 vendor**; ogni differenziatore dichiarato è table-stakes o eroso tranne l'ampiezza 5-dim (fragile: euristiche, replicabile, già brevettata, no data moat). Raccomandato riposizionamento → "skills+org intelligence EU-native, ESCO-based, AI-Act-explainable per mid-market regolato"; competitor diretto ~365Talents (1-vs-1, non 1-vs-27).
- **ICP risolto (finding, non assunto)**: primario = **mid-market EU regolato, banking-first** (il tenant RTL_BANK è una banca); enterprise precluso oggi (no data moat / 0 clienti / single dev); SMB/startup/holding/flat fuori scope; PA e project-based gated su scope-extender non costruiti.

Proposta al CLI: (a) valutare adozione di `docs/product/` come home canonica del **livello prodotto** (oggi assente nella SoT); (b) aprire item `SOT_BACKLOG` "**Gap #1 — Porte Process/Org UI + scorecard prescrittiva (MLCE + Maturity engine)**" come candidato post-#9 (dettaglio in `docs/product/WORKITEM_GAP1_PERSPECTIVES_AND_SCORECARD.md`); (c) ⚠️ i "building-block presenti" delle funzionalità latenti nel `heuresys-wiki` sono **in parte legacy `heuresys-evo`** (es. 106 pagine, embeddings 1536-dim) → ri-verificare sullo schema **advanced** prima di impegnarli in roadmap. Nessuna migration creata/applicata; nulla scritto in `docs/kb/*` fuori da questo inbox.

stato: [RICONCILIATA 2026-06-19 S997] — CLI: decisione Enzo recepita su tutti e 3 i punti. (a) `docs/product/` **adottata come SoT del dominio prodotto** in `CLAUDE.md §Source of Truth` (disgiunta da `docs/kb/` tecnico e `docs/due-diligence/` investor); 5 deliverable + DD `SCORECARD_ACQUIRER_RUTHLESS.md` committati. (b) **Item Gap #1 aperto** in `SOT_BACKLOG` (candidato roadmap, autorità *cosa* = Enzo). (c) ⚠️ latent-capability **ri-verificate LIVE sullo schema advanced** → `docs/product/WORKITEM_GAP1_PHASE0_VERIFICATION.md` (count reali su :5433): il catalogo **sovrastima** (event-sourcing/maturity erano legacy evo, **assenti** nel repo advanced); building-block reali presenti+popolati (ESCO 126051, PIP VIEW, requirements, insights, org 26/162); MLCE/Maturity/Porte UI = da costruire (~7.5-9 pw, additivo, no event-store → ricomposizione batch).
## 2026-07-06 | Cowork (Fable 5) — battle plan wargame depositati in docs/wargames/

Aggiunti (untracked) 7 battle plan eseguibili + 7 review adversariali + README in `docs/wargames/`. Mappa: 11→#27, 12→#26, 13→#24(F4), 14→#28, 15→#4(pricing), 16→#34, 17→#17. Ognuno = execution-spec del rispettivo item (mosse, fork con trigger, abort, verification). Proposta: commit dei file e uso come spec quando l'item viene aperto. Decisioni WAIT-INPUT elencate nel README (pricing Q1-Q8, F4 A/B, Wave-3 A/B, H-1 authz).
