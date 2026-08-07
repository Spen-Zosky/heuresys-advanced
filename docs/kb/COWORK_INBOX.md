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

stato: [RICONCILIATA 4fc901de] — CLI S1029 (2026-07-25): la proposta è stata accolta, i file sono committati e tracciati in `docs/wargames/` (14 documenti + README). Restano aperte le sole **decisioni** elencate nel README di quella cartella (pricing Q1-Q8, rotta Wave-3 A/B), che vivono come cluster `needsEnzo` nel piano `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` §W6. Entry marcata a posteriori: era l'unica dell'inbox priva della riga di stato richiesta dal protocollo (riga 10 di questo file).


### 2026-07-22 | proposta-backlog | Asse professione — chiusura gap ISCO-08 standalone + CP2021 (design + DDL PROPOSED)

Contesto: verifica live dell'asse classificazioni (Cowork read-only). L'asse **attività economica** è COMPLETO (verified-by `psql localhost:5433/heuresys_advanced` 2026-07-22): `sys_activity_classifications` ATECO_2025=3257 (L1-6 = 22/87/287/651/920/1290, = totale ufficiale Istat), ATECO legacy=2210, NACE legacy=1066; crosswalk `sys_activity_classification_mappings`=5730 (NARROWER 2865 + BROADER 2865). L'asse **professione** è coperto solo lato ESCO: `sys_esco_occupation_mappings`=7675 (3070 con ISCO, 3000 ISCO distinti), ma l'ISCO è **solo attributo** `esco_occupation_mapping_isco_code varchar(16)` (mig 000010) — nessun catalogo gerarchico. CP2021: **assente** (0 tabelle; il watermark `ISTAT_CP2021` era solo un esempio in commento a mig 000095, mai istanziato — live: solo ATECO_2025/ESCO/ESCO_SKILL_HIERARCHY).

Gap reali: (A) manca catalogo ISCO-08 gerarchico standalone (10/43/130/436 = 619 nodi, ILO); (B) manca CP2021 (5 livelli, 813 unità professionali, Istat — richiesto INPS/Uniemens da 05/2025, abbinato ad ATECO 2025); (C) minore — qualità dati NACE legacy (L2/L3 = 88/305; confermare currency vs NACE Rev 2.1 su RAMON, oppure deprecare i base a favore di ATECO_2025 canonico ex mig 000119). Nota: l'ipotesi iniziale "ATECO_2025 incompleto (1945)" è FALSA — 1945 = solo codici crosswalk-eligible; catalogo completo a 3257.

Design (DDL PROPOSED, DO-NOT-APPLY; rispecchia il pattern `activity_classifications`, invarianti onorati: naming `sys.*`, unique `(scheme,code)`, parent index parziale, trigger `set_updated_at`, no-PII ADR-0023, catalogo indipendente da `job_role` ADR-0016):
- mig 000200 `sys.sys_occupation_classifications` — scheme ISCO_08/CP_2021/ESCO; `code`/`parent_code`/`level`/`name`/`metadata jsonb`; CHECK scheme; unique `(scheme,code)`; parent idx; trigger.
- mig 000201 `sys.sys_occupation_classification_mappings` — `source_id`/`target_id` FK self-referencing; kind EXACT/NARROWER/BROADER/RELATED/APPROXIMATE; confidence; unique pair. Gemello di 000007 §2.
- aggancio ESCO additivo non-breaking: VIEW `sys_esco_isco_resolved` (LEFT JOIN su `split_part(esco_occupation_mapping_isco_code,'.',1)`) e/o colonna FK nullable opzionale su `sys_esco_occupation_mappings`.

Work items (CLI): WI-1 DDL 000200/000201 (default-safe, idempotente, tabelle vuote=zero impatto); WI-2 connettore ILO ISCO-08 + seed 619 + test + watermark `ISCO_08` (pattern `istat-ateco-connector.ts`, fail-loud, fixtures CI); WI-3 connettore Istat CP2021 + seed 813 + watermark `ISTAT_CP2021`; WI-4 crosswalk ISCO↔ESCO deterministico (self-join da `isco_code`, pattern 000112) + ISCO↔CP2021 (corrispondenza Istat); WI-5 VIEW risolutiva (+ FK additiva opz.); WI-6 (prodotto) currency/deprecazione NACE legacy.

DoD live-E2E (regola Enzo): chiusura SOLO con dimostrazione live su dati reali — es. `GET /v1/occupation-classifications?scheme=ISCO_08` su albero reale + risoluzione live `job_role → ESCO → ISCO → CP2021` su tenant di test. Go migration + eventuale sorgente CP2021 = autorità Enzo (`blocked-on-Enzo` altrimenti).

Anti-duplicazione: NON re-importare ATECO/NACE/crosswalk (già completi); NON creare schemi `isco_*`/`cp_*` separati (riuso pattern `sys.*`); NON toccare `sys_esco_occupation_mappings` in modo breaking (aggancio additivo).

Deliverable Cowork (consegnato a Enzo via chat, NON scritto nel repo): `heuresys_classificazioni_reconciliation_2026-07-22.md` (riconciliazione + audit + gap + design completo con ER Mermaid). Nessuna migration creata/applicata; nulla scritto in `docs/kb/*` fuori da questo inbox.

stato: [RICONCILIATA 16ce9cd4+5f615d49 S1027] — CLI: proposta IMPLEMENTATA con deviazioni deliberate. (a) Numerazione reale **000206** (catalogo+crosswalk shell+VIEW `sys_esco_isco_resolved`+registry bucket-D+i18n reg — il max era 000205, non 000199) / **000207** (coverage gate) / **000208** (RBAC `occupation_classification:*`, matrice veritiera: read←enterprise_typing:read, write←tenant:create PLATFORM-only, i18n conforme nativa). (b) CHECK **strict** ISCO_08/CP_2021 senza 'ESCO' (anti-duplicazione, le occupazioni ESCO restano in `sys_esco_occupation_mappings`; aggancio = VIEW, no FK — ADR-0016). (c) WI-2/WI-3 connettori HTTP sostituiti da **seed CSV committati** (`db/data/occupations/` + loader idempotente fail-loud, watermark ISCO_08/ISTAT_CP2021): i deliverable curati non sono ri-scaricabili as-is. (d) WI-4 crosswalk ISCO↔CP2021 **deferred** (serve la corrispondenza ufficiale Istat; tabella pronta). (e) WI-6 NACE → item di backlog **#73**. Verifiche §6 tutte PASS: 619 (10/43/130/436) + 1502 (9/40/130/510/813), overlay EN 2121, view ESCO 3070/3070 risolti su 426 unit-group, gate missing=0, orfani 0. Modulo API `/v1/occupation-classifications` (5 endpoint, localize x-locale, 8 test verdi su login reali). DoD live dimostrata.


### 2026-07-22 | proposta-backlog | i18n: gate di COPERTURA (completezza EN) + conformità tabelle nuove (incl. occupation_classifications)

Contesto: verifica live del bilinguismo dei dati (ADR-0029 wave-1, mig 000190, S1024). Framework solido — IT canonico in-row + overlay EN in `sys_reference_translations`; registro `sys_translatable_field` (22 campi + skill_groups); vista integrità `v_reference_translation_orphans` = 0; fallback runtime sempre a IT (mai vuoto). **MANCA un gate di COMPLETEZZA**: la vista orfani prova l'integrità (nessuna traduzione pendente), NON la copertura EN riga-per-riga.

Copertura live (verified-by `psql localhost:5433/heuresys_advanced` 2026-07-22, DO block registry-driven read-only): `sys_reference_translations` = 29013 ESCO + 498 HARVEST (solo locale 'en'; IT è in-row). Completi ✅: auth_roles, goal_templates, job_families, skill_categories, skill_families, operating_model_catalog, skill_proficiency_levels, skill_groups.name. GAP ❌: `sys_kpi_definitions` (name 243 + descr 126, en=0 → 369 mancanti), `sys_job_roles` (name 137 + descr 50, en=0 → 187), `sys_auth_permissions.name` (197 vs 182 → 15), `sys_skills` (name+descr 14041 vs 13933 → 108+108 ≈ 0.8%). ANOMALIA ⚠️: `sys_skill_groups.description` en=507 > base=30 (477 overlay EN su descrizioni IT vuote/blank → o IT-in-row da riempire o overlay stale — da investigare).

Proposta (DDL PROPOSED, DO-NOT-APPLY):
1. `sys.fn_reference_translation_coverage()` + vista `sys.v_reference_translation_coverage` (gemella di fn/vista orfani in 000190, registry-driven): per ogni `sys_translatable_field` → base_rows (colonna in-row non vuota) vs en_overlays → missing. Gate: `SELECT * FROM sys.v_reference_translation_coverage WHERE missing > 0` deve essere vuoto (pura lettura, idempotente).
2. Gate in CI + `docs/kb/tools/status_dashboard.py`, accanto a `pnpm i18n:check` (statico) e alla vista orfani (integrità): fallisce se missing > 0 (o soglia concordata). Rende il bilinguismo DATI verificabile come già lo è la UI statica.
3. Conformità tabelle nuove — rendere OBBLIGATORIA la regola ADR-0029 già vigente ("migration future DEVONO fornire IT canonico, POSSONO fornire EN"): ogni nuova reference table (a) IT in-row, (b) registra i campi in `sys_translatable_field`, (c) fornisce overlay EN → coperta automaticamente dal gate registry-driven.
4. Applicazione ai deliverable occupation_classifications: registrare (`sys_occupation_classifications`, 'name'/'description'). **ISCO_08**: il seed prodotto è EN → FLIP a IT canonico in-row (titoli ISCO-08 IT da Istat/ESCO) + overlay EN (già disponibile dall'XLSX ILO). **CP_2021**: IT canonico ✓ → overlay EN da generare (pipeline source='LLM', come le 14k descrizioni skill).
5. Sanare i gap wave-1 (kpi_definitions 369, job_roles 187, permissions.name 15, skills 216) + investigare l'anomalia skill_groups.description (477).

Nessuna migration creata/applicata; nulla scritto in `docs/kb/*` fuori da questo inbox. Deliverable Cowork consegnato a Enzo via chat: framework + tabella copertura live + SQL della vista.
stato: [RICONCILIATA ec25637b S1027] — CLI: gate ADOTTATO (mig **000207**, rinumerata dal PROPOSED 000202) + integrato in `status_dashboard.py` sezione DB (riga "i18n dati"; NON gate hard in CI — heuresys_ci non carica i dataset, stessa ragione di 000195). Gap wave-1 TUTTI SANATI: kpi 243+126 · job_roles 137+50 · skills custom 108+108 (772 overlay EN source=LLM, CSV committati `db/data/i18n/`) · 16 permessi EN-in-row conformati via mig **000209** (IT in-row + overlay EN — erano 000199/000202, il live ne contava 16 non 15). Anomalia `skill_groups.description` (-477) DIAGNOSTICATA e risolta: descrizioni EN ufficiali ESCO senza IT-canonico → 477 IT generate da EN, UPDATE in-row heal-only. Esito live: **25 campi registrati, tutti missing=0, 0 anomalie, 0 orfani** (twice-run proven). Conformità tabelle nuove: applicata nativamente a 000206/000208. Residuo dichiarato: alcune description in-row di job_roles/skills sono prosa EN pre-esistente (semantica in-row, non copertura) → mandato forense S1023.


### 2026-07-22 | nota | ISCO-08 titoli IT procurati (ESCO API) — seed occupation IT-canonico completo + overlay EN pronti

Avanzamento delle proposte "Asse professione" e "i18n" sopra. Titoli ISCO-08 in italiano ottenuti dall'**ESCO API** (`ec.europa.eu/esco/api`, walk dell'albero ISCO in `language=it`): **619/619, 0 errori, livelli 10/43/130/436**, coerenti con la struttura ILO EN. Seed occupation ora **IT-canonico completo**: 2121/2121 righe con `name` IT in-row (ISCO ← ESCO, CP2021 ← Istat/INAIL). Overlay EN ISCO pronti per `sys_reference_translations` (619 righe, field=name, locale=en, source=HARVEST, keyed `ISCO_08:<code>`). Vista di copertura i18n (`fn/v_reference_translation_coverage`, registry-driven) consegnata come `.sql` PROPOSED.

Deliverable Cowork consegnati a Enzo via chat (NON scritti nel repo): `occupation_classifications_seed_IT_2026-07-22.csv`, `occupation_reference_translations_EN_2026-07-22.csv`, `occupation_classifications_bilingual_2026-07-22.csv`, `000202_reference_translation_coverage_PROPOSED.sql`. Resta da generare (decisione Enzo): overlay EN per CP_2021 (1502 righe, pipeline LLM, source='LLM'). Nessuna migration creata/applicata; nulla scritto in `docs/kb/*` fuori da questo inbox.
stato: [RICONCILIATA 16ce9cd4 S1027] — CLI: assorbita dall'entry "Asse professione" (sopra). Seed validato pre-load (0 dup, 0 orfani gerarchici, radici 10+9, match seed↔overlay 1:1) e caricato; CSV versionati in `db/data/occupations/` con provenance README.


### 2026-07-22 | nota | CP2021 overlay EN generati (LLM) — asse professione COMPLETAMENTE bilingue

Chiusura del gap i18n dell'asse professione. Overlay EN per CP2021 generati via LLM (8 subagent paralleli, traduzione IT→EN dei titoli occupazionali), assemblati e verificati: **1502/1502 tradotti, 0 mancanti / 0 extra / 0 vuoti / 0 duplicati** (match esatto sui codici del seed). Overlay EN TOTALE dell'asse professione = **2121 righe** per `sys_reference_translations`: 619 ISCO (`source=HARVEST`, da ESCO/ILO) + 1502 CP2021 (`source=LLM`), field=name, locale=en, keyed `entity_ref = <scheme>:<code>`.

Stato asse professione: IT canonico in-row **2121/2121** (ISCO←ESCO, CP←Istat) + overlay EN **2121/2121** → bilinguismo dati completo. Applicando le migration `000200/000201` (catalogo+crosswalk occupazioni) e `000202` (vista coverage), registrando (`sys_occupation_classifications`,'name') in `sys_translatable_field`, e caricando seed+overlay, il gate `v_reference_translation_coverage WHERE missing>0` sull'asse professione sarà **vuoto**. Deliverable Cowork consegnati a Enzo via chat (NON nel repo): seed IT, overlay EN FULL + CP, vista bilingue, vista coverage SQL. Go migration/apply = Enzo. Nessuna migration applicata; nulla scritto in `docs/kb/*` fuori da questo inbox.
stato: [RICONCILIATA 16ce9cd4 S1027] — CLI: assorbita dall'entry "Asse professione". Go di Enzo ricevuto in-sessione ("agisci di conseguenza" su cli-prompt.md); overlay EN CP2021 validati 1502/1502 e caricati (source=LLM); gate sull'asse professione VERIFICATO VUOTO live.


### 2026-07-25 | consegna | zero-pending-loop: impianto completo da rivedere e committare (21 file, nessun commit fatto)

Contesto: sessione Cowork del 2026-07-25, avviata dopo la chiusura di S1030 (CI 7/7 verde, `7798df59`). Enzo ha chiesto un impianto che porti il progetto verso zero pendenze lavorando in autonomia non presidiata. Il lavoro è **completo e verificato ma non committato**: Cowork non committa su questo progetto senza coordinamento CLI. Nulla in `docs/kb/` è stato modificato a parte i tool nuovi sotto `docs/kb/tools/` (che non sono SoT di stato) e questa entry.

**Cosa c'è.** Una skill `zero-pending-loop` (motore di UNA iterazione), un driver bash esterno (il loop), sei tool Python deterministici, e una CLI PowerShell (`zp`) fuori dal repo. Il punto architetturale: `/clear` non è invocabile da una skill e il contesto residuo non è misurabile dall'interno, quindi il loop **non può** vivere dentro una sessione — vive nel driver, e ogni `claude -p` nasce con contesto vergine. Ne segue che lo stato sta su file, mai in conversazione. Razionale completo: `docs/superpowers/specs/2026-07-25-zero-pending-loop-design.md`; guida d'uso: `.claude/skills/zero-pending-loop/README.md`.

**I 21 file.**
- modificati (13): `.claude/skills/zero-pending-loop/SKILL.md` + `references/{LEARNINGS,adversarial,blast-radius,bootstrap,close,driver,gates,operations,protocol,selection}.md` + `references/zp.config.yaml` + `.gitignore`
- nuovi (8): `.claude/skills/zero-pending-loop/README.md` · `docs/kb/tools/zp_{state,gate,evidence,zero_check,classify,selftest}.py` · `scripts/zero-pending-driver.sh`

Le modifiche ai `.md` della skill sono in gran parte **riflusso tipografico** (paragrafi riuniti su una riga: MarkText rende gli a-capo manuali come interruzioni vere), fatto con `reflow_md.py` che rifiuta il file se cambia una invariante — titoli, tabelle, blocchi di codice, conteggio parole. Il contenuto non è cambiato tranne dove indicato sotto.

**`.gitignore`**: aggiunte 4 righe — `.zp/*` più `!.zp/PROGRESS.md`. Verificato con `git status --porcelain --ignored`: i file di runtime sono ignorati, `PROGRESS.md` no (è la vista che Enzo legge su GitHub dal telefono).

**Classificazione dei cluster (T1).** `zp.config.yaml` ora contiene i **212 cluster aperti** classificati per raggio d'impatto: A=15 (inerti), B=76 (codice reversibile), C=81 (schema e dati), D=10 (produzione viva), E=30 (bloccati su Enzo). Non è una lista scritta a mano: la produce `zp_classify.py` dal testo di ogni cluster, e ogni assegnazione porta la parola che l'ha decisa. I 24 proposti D sono stati riletti uno per uno e **14 erano falsi positivi** (`test:e2e:prod` non è la produzione, «55 nodi su disco» è un indice di memoria): sono `OVERRIDE` espliciti nel sorgente, con il motivo, quindi sopravvivono a una ri-esecuzione su un piano nuovo. `meta.clusters_classified` è ora `true` — la guardia è aperta, ma **niente parte da solo**: serve che Enzo lanci `zp avvia`, e il driver rifiuta comunque di partire su working tree sporco.

**Verificato, non da rifare** (tutto eseguito sulla macchina di Enzo, non ragionato):
- parser: 253 cluster letti dal piano, bloccati su Enzo 9 esterno / 19 decisione-business / 2 segreto — combacia con l'intestazione del piano;
- integrità del piano: **zero rilievi** — tutte le dipendenze risolvono, ogni aperto ha il suo *chiuso quando*, ogni chiuso la sua nota;
- `zp_selftest.py`: **10 test automatici su 10 passano** (classe D mai in safe, C solo in full, E mai eleggibile, dipendenze rispettate, ordine per ondata, coppie di prove);
- `zp_zero_check.py` completo con rete: CI 10 workflow verdi su main, 1 alert Dependabot aperto ma con rischio accettato nel registro (D-75), systemd VM `active active`;
- driver: guardia classificazione → exit 3, guardia working tree sporco → exit 4 con lista file, freno `.zp/STOP` → non parte; dry-run arriva ai candidati (89 in corsia safe, primo Z-203).
- 4 test restano `[a mano]` perché richiedono una sessione viva: bootstrap che non ri-censisce, freno a metà lavoro, troncamento da budget, frontiere della description.

**Due rilievi sul piano, per il CLI.**
1. **W0 non è chiusa.** `Z-034` (segreti TOTP: fixture in chiaro nel repo, 7/19 secret plaintext a DB, `MFA_ENCRYPTION_KEY`) risulta ancora `[ ]`. S1030 ha riportato W0 completa 11/11, ma il piano ne conta 12 in quell'ondata. È classe D, quindi il loop non lo toccherà da solo: resta in attesa di autorizzazione di Enzo, che è il comportamento voluto ma va deciso.
2. **L'intestazione del piano dice 248 cluster, ma le voci sono 253**: S1030 ne ha aggiunti senza aggiornare il totale in testa (`## Il numero` e `## Ordine di esecuzione`).

**Cosa chiedo al CLI.** Rivedere e committare, senza push salvo ok esplicito di Enzo. Suddivisione atomica proposta:
- `feat(ops): zero-pending-loop — skill, driver e tool di orchestrazione` (skill + `scripts/zero-pending-driver.sh` + i 6 `docs/kb/tools/zp_*.py`)
- `chore: .zp/ gitignored tranne PROGRESS.md`
- `docs(plan): allinea l'intestazione ai 253 cluster reali` (se il CLI decide di sanare il rilievo 2)

Nessuna migration creata o applicata. Nessun file di stato nuovo: `.zp/` è runtime gitignored, e i conteggi che produce puntano alle fonti invece di sostituirle. La skill non scrive mai nel register: prepara i blocchi e li fa validare, la scrittura resta di `handoff`.
stato: [RICONCILIATA cb66c1e0 S1030] — CLI: **rivista prima del commit, non dopo**. Due revisori ostili su lenti diverse (tool Python · sicurezza operativa del driver) hanno prodotto ~25 rilievi verificati eseguendo, non ragionati. **Corretti in questa review**: il lock non era un lock (il secondo driver, rinunciando, cancellava quello del primo → il terzo partiva in parallelo; e il trap non verificava la proprietà, quindi il primo uscendo cancellava il lock del terzo) · `kill -TERM` non fermava il driver ma gli faceva mollare il lock, cioè il tentativo di fermarlo era ciò che apriva la concorrenza · **il deploy di produzione non era filtrato da nulla** (il filtro per classe governa la selezione del cluster, non il rito di chiusura, che invoca `close-propagate --auto-deploy` = `reset --hard` + restart systemd su www.heuresys.com): ora `HEURESYS_CLOSE_NODEPLOY=1` è un veto imposto dal codice di `close-propagate.sh` e il driver lo esporta · tetto di spesa inerte (stderr nel JSON + argv oltre il limite Windows di 32.767 char → costo 0 e somma di zeri; misurato: due sessioni da $11.87 contabilizzate $0.00) · la corsia non arrivava alla sessione (`--lane safe` era una speranza sulla prosa) · **«zero pendenze» dichiarabile con lavoro dentro**: il parser scartava in silenzio le righe non conformi — `Z-110` letto 253 su 254 per giorni — e la rete su stderr non bastava perché il driver la reindirizza a `/dev/null`; ora è un criterio esplicito che viene prima di tutti · «CI verde» con zero workflow valutati · API di produzione **ferma** vista come sana (`is-failed` risponde «inactive» sia per spento sia per inesistente; ora `is-active` + sonda HTTP) · alert di sicurezza «a rischio accettato» perché il nome del pacchetto compariva nella prosa del registro (12 su 30 per coincidenza: tar, ip, ws, semver, glob, cookie…) · «condizione raggiunta» con metà dei criteri saltati da `--no-net`.

**Freno inserito** (`meta.autorizzato_non_presidiato: false`, driver → exit 3): l'impianto è versionato e ispezionabile ma **non parte**. Restano rilievi che chiedono un ridisegno e non una patch, elencati per esteso in `zp.config.yaml`: la classificazione ammette in corsia safe cluster che toccano la produzione (Z-153 deploy pubblico · Z-070 backfill ~14k skill sul DB reale · Z-186 import 139k archi · Z-048 PATCH reali su `/v1/me/*` · Z-167 · Z-108 · Z-209), perché la regola guarda la descrizione e non il *chiuso quando*, che è dove sta l'azione; `class_c_preconditions` non è letto da alcuna riga di codice (dump verificato, prova su linux-pc, doppia esecuzione sono prosa); il tipo di prova è autodichiarato — due `echo` chiudono un cluster — e con output UTF-8 la prova viene registrata verde e **vuota**; il gate rifiuta le coppie che la Definition of Done del progetto impone (`integration+e2e`, `psql+runtime`) e accetta `staticcheck` come mezza prova; `zp_selftest` non rileva 4 regressioni su 5.

**I due rilievi al CLI erano fondati, entrambi chiusi** (commit `1802ba99`, pushato prima del vincolo sul push posto in sessione): W0 non era completa — `Z-034` (segreti TOTP) è davvero ancora aperto, S1029 l'aveva dichiarata 11/11 e S1030 l'ha **ereditata senza rimisurarla**, che è l'errore contro cui era andata tutta la giornata; e i totali erano fermi a 248 contro 254 voci reali (ora allineati, con la nota che spiega perché il totale cresce e il comando per contarlo invece di fidarsi della tabella). **Il vincolo sul confine è rispettato e lo è nel codice, non nella prosa**: verificato che nessun tool scrive in `SOT_STATE`/`SOT_BACKLOG`/`DEBT_REGISTER`/`STATE.md` — le uniche scritture vanno in `.zp/` e in `zp.config.yaml`; `DEBT_REGISTER` è **solo letto**, per riconoscere gli alert a rischio accettato. Verifiche dopo le correzioni: `zp_selftest` 10/10 · integrità piano 254 cluster / 0 rilievi · veto deploy attivo con nessuna regressione sul percorso presidiato · freno che blocca l'avvio. **Nessun push**: i commit restano locali in attesa dell'ok di Enzo.


---

## [COWORK → CLI] 2026-08-07 — Decisioni architetturali AI/RAG, da recepire

Proposta di Cowork (Claude Opus), sessione del 2026-08-06/07 con Enzo.
Non scrivo in `SOT_STATE` / `SOT_BACKLOG` / `DEBT_REGISTER`: sono di CLI.
Qui deposito ciò che è stato deciso, perché finora viveva fuori dal repository.

### D1 — Catalogo generico invece di uno strumento per modulo

**Deciso.** Non si colmano i 78 moduli scoperti aggiungendo 78 strumenti MCP. Un
catalogo con ~95 strumenti degrada la selezione del modello, gonfia il contesto a ogni
turno e alza il costo per chiamata. Si adottano pochi strumenti generici che navigano
il dominio (trova entità per concetto → descrivi entità → interroga entità), con il
dizionario dei concetti derivato meccanicamente da `atlas.yaml`.

Conseguenza cercata: schema che cambia → atlante rigenerato → corpus ri-vettorizzato →
l'agente vede le entità nuove **senza che nessuno colleghi uno strumento**.

Riferimento: ADR-0033 (`PROPOSED`).

### D2 — Aggregazioni fuori dallo scopo del catalogo generico

**Deciso**, su raccomandazione del referto 2026-08-07 §5.5, opzione 1.
L'agente instrada; le domande di calcolo («quali competenze mancano di più», «quante
persone nella direzione crediti») le servono gli endpoint analitici che **esistono già**
(`analytics`, `org-health`, `insights`).

Ragione decisiva, da mettere agli atti perché non è nel referto: l'opzione 2
(arricchire i concetti con «quali domande so rispondere») reintroduce **contenuto
scritto a mano** nel corpus. Quel testo invecchia e va manutenuto, il che distrugge
la proprietà che rende D1 sostenibile — il corpus derivato che si rigenera da solo.
Restringere lo scopo costa zero codice e conserva il ciclo automatico.

### D3 — Il ponte gateway ↔ pagine web deve valere per le pagine future

**Vincolo di progetto**, da applicare quando il ponte verrà costruito (non ancora fatto).

- Un solo canale in streaming e **un solo componente riusabile**. Il ponte non sa nulla
  delle pagine. Aggiungere una pagina = usare il componente. Zero lavoro sul ponte.
- Il contesto di pagina («sto guardando l'unità X») è un **parametro libero**, mai un
  ramo condizionale per tipo di pagina.
- I permessi restano automatici: li applica il server sulla sessione inoltrata.
- **NON è automatico** che l'agente sappia rispondere sui dati nuovi: quello dipende da
  D1 e dalla rigenerazione dell'atlante, non dal ponte. Due metà distinte.

Rischio da evitare: scrivere il primo prototipo *dentro* una pagina. Funziona subito e
rende costosa ogni pagina successiva, finché si smette di aggiungere l'agente senza che
nessuno lo decida mai.

### D4 — I mandati vivono nel repository

Creata `docs/superpowers/prompts/`, gemella di `specs/`: conserva il testo esatto
consegnato a CLI. Un referto senza il suo mandato è metà documento. Convenzione e
motivazione nel README di quella cartella. I due mandati del 2026-08-06 sono depositati.

### Precedenza dichiarata

Nulla di quanto sopra viene prima di **#155** (percorsi di carriera: 207/252 puntano a
posizioni non attive, 130 persone con obiettivo irraggiungibile). Concordo col referto:
è l'unica voce che una persona vera vede aprendo la propria pagina. In più — e questo
il referto non lo collega — #155 insiste sulla **stessa area** su cui si stava
progettando la dimostrazione. È precondizione, non alternativa.

stato: [RICONCILIATA 2026-08-07, CLI — chiusura S1047] Le quattro decisioni sono state recepite nelle SoT che competono alla CLI, e nessuna e' stata data per scontata. **D1** era gia' `ADR-0033` (`PROPOSED`) e resta tale: i tre criteri dell'ADR sono soddisfatti — recupero misurato 8/10 sui primi 3, §5.1 parametri chiuso, §5.2 gate chiuso — ma manca la scelta di **quale superficie aprire per prima**, che e' `#156` (WAIT-INPUT) e non la decide una misura. **D2** ha chiuso `#157`, che avevo appena registrato come domanda aperta: la decisione coincide con l'opzione raccomandata dal referto, e la ragione aggiunta da Cowork — l'opzione (b) reintrodurrebbe contenuto scritto a mano che invecchia, distruggendo la proprieta' auto-rigenerante su cui poggia tutto — e' stata messa agli atti nella voce perche' nel referto non c'era. **D3** e' ora `#159`: registrato come vincolo PRIMA della costruzione, col rischio nominato (il prototipo scritto dentro una pagina). **D4** e' committata: `docs/superpowers/prompts/` con i due mandati e il suo README. **Sulla precedenza**: concordo, e il collegamento che Cowork fa e il referto non faceva regge — `#155` insiste sulla stessa area della dimostrazione, quindi e' precondizione e non alternativa; resta in cima al menu.
