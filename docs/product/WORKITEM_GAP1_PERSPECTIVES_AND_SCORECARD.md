# Work-Item — Gap #1: Porte Process/Org UI + Scorecard prescrittiva

> Piano esecutivo per il gap di prodotto #1 identificato nel Product Discovery (`BUSINESS_SCOPE_AND_PRD.md` §2.6). Stato: **proposta** (gate "go" Enzo + riconciliazione CLI via COWORK_INBOX). DoD del repo: **chiusura solo con dimostrazione LIVE su dati reali** (no mock, no green-test).

## Perché questo work-item

È il singolo intervento che **converte la narrativa di prodotto in prodotto dimostrabile**:
- Oggi delle 3 prospettive promesse (Process Owner / Org Director / HR) **ne esiste 1** (verified: `find apps/web/src/app` → 0 route per le altre due). La risposta alla domanda VC "mostrami un Process Owner che usa la piattaforma" è oggi *silenzio*.
- Manca qualunque **layer prescrittivo di capability** (verified: nessuna scorecard/maturity engine in `apps/api/src/modules`). Senza, il prodotto è "HRMS+skills", non "intelligence".

Il dato abilitante è che **i dati esistono già** (ESCO 21.939 skill, 126.051 occupation-skill req — verifica live 2026-06-19, Ledger §4; PIP VIEW, org-units, positions, embeddings): manca l'**orchestration/computation layer + le 2 UI**, non i dati.

## Scope

**IN scope**
1. **Porta 2 — Org Director console**: navigazione struttura → posizione → PIP (skill/KPI/learning requirements + gap) → capability dell'unità. Riusa `organization-units`, `positions`, PIP VIEW, `insights`.
2. **Porta 1 — Process Owner console**: blueprint/processi → RACI OU↔processo → ruoli/skill/KPI collegati. Riusa `blueprint-*`, `organization-unit-processes`, `activity-classification*`. (NB: è *lettura/navigazione del grafo*, non il runtime BPM — quello è Gap #2.)
3. **MLCE slice (Multi-Level Composition Engine, Phase-1)**: endpoint che *calcola* il capability_score aggregato employee→position→org-unit→org con aggregation function configurabile + lineage. Prerequisito numerico delle scorecard.
4. **1 scorecard prescrittiva — Capability Maturity engine (L0-L5)**: deriva la maturity per capability/unità via query SQL auditabili (rubrica già esistente nel wiki) + UI scorecard. Scelta su Maturity (non VRIO) perché ha già rubrica + soglie + è il claim più difendibile in chiave audit/AI-Act.

**OUT of scope (work-item separati)**
- BPM runtime (process-instance/task/approval/SLA) → Gap #2.
- VRIO Scorecard / Essential Capability Ranker / OHI / DPI → "Next/Later" una volta validato il pattern scorecard.
- AI Advisor prescrittivo → "Next".

## Approccio architetturale (vincoli del repo)

- **API-first, module-pattern 7-step** (shared Zod → repo raw-SQL parametrico → service+scope → routes `requirePermission` + CSRF → integration test su DB reale → registrazione `app.ts` → commit atomico). Niente UI prima dell'endpoint tipizzato e testato.
- **MLCE** come nuovo modulo `apps/api/src/modules/capability-composition/` (read+compute; nessun ENUM, `varchar+CHECK` per aggregation_mode; lineage append-only). Edge **I9**: se serve esporre score compositi a livello posizione, estendere la VIEW PIP, non creare blob JSONB.
- **Maturity** come modulo `capability-maturity/` che consuma MLCE + rubrica; output scorecard read-only.
- **UI** in `apps/web` come composizione di primitive `@heuresys/ui` (no nuove primitive qui) + TanStack Query su `/v1/*` reali; **live-data only**.
- **RBAC**: nuove permission `process-owner:read`, `org-director:read`, `capability:read` mappate ai ruoli `PROCESS_OWNER` / `BLUEPRINT_MANAGER` / `HRMS_MANAGER` (già esistenti) — verificare i role-permission mapping prima (live 2026-06-19: **630** mapping / **141** permission; SoT: `docs/kb/SOT_STATE.md`, evidenza Ledger §6).

## Fasi, effort, acceptance (LIVE)

| Fase | Contenuto | Effort | Acceptance (live, dati reali RTL_BANK) |
|---|---|---|---|
| **0 — Verifica building-block** | Confermare sullo schema *advanced* (non wiki legacy) cosa esiste: PIP VIEW, requirements, goal_alignments, talent-signals | ~0.5 ww | Report con file:line + query reali; lista gap dati |
| **1 — MLCE Phase-1 (API)** | modulo `capability-composition` + endpoint compute + lineage + integration test | ~1.5-2 ww | `GET /v1/capability/composition?scope=org-unit/:id` ritorna score reale calcolato sui dati RTL; test verde su DB reale |
| **2 — Maturity engine (API)** | modulo `capability-maturity` + query SQL auditabili L0-L5 + endpoint | ~1.5 ww | `GET /v1/capability/maturity?...` ritorna L-level reale + breakdown auditabile su dati RTL |
| **3 — Org Director console (UI)** | pagine Porta 2 sul grafo struttura→posizione→PIP→capability/maturity | ~1.5-2 ww | E2E Playwright: login `federica.marchetti@rtl-bank.org` (TENANT_ADMIN) → naviga unità reale → vede PIP + maturity reali |
| **4 — Process Owner console (UI)** | pagine Porta 1: processo→RACI→ruoli/skill/KPI | ~1.5-2 ww | E2E: login ruolo process-owner → naviga un processo reale → vede catena processo↔ruolo↔skill |
| **5 — Scorecard UI + hardening** | scorecard capability/maturity per unità + a11y + i18n parity | ~1 ww | E2E scorecard su dati reali; a11y CI verde; typecheck+vitest+playwright verdi |

**Totale stimato: ~7.5-9 person-week** (1 dev; parallelizzabile UI/API con 2 dev). Nessun rewrite — costruzione additiva.

## Dipendenze
- **Dati**: dipende dall'esito Fase 0 (se mancano building-block, +effort).
- **#9 Agent SDK**: indipendente, ma le scorecard diventano *prescrittive* solo con l'AI Advisor (Next) — qui restano diagnostiche.
- **Infra de-risk / commercial layer** (DD): paralleli, non bloccanti per questo WI tecnico.

## Definition of Done (vincolante, repo)
Ogni fase si chiude **solo** con dimostrazione live su tenant di test reale (RTL_BANK): output reale allegato (comando + risposta API reale + screenshot UI + path/timestamp, R5). Mock = scaffold intermedio, mai chiusura. Mancano secret/approval → stato `blocked-on-Enzo`, mai "done".

## Rischi & open question
- **Building-block legacy vs advanced**: rischio che la rubrica/aggregation assuma schema legacy → mitigato da Fase 0.
- **Scelta scorecard**: Maturity (raccomandata) vs VRIO (più board-friendly ma senza rubrica pronta) — decisione Enzo.
- **Ruolo PROCESS_OWNER senza runtime**: la Porta 1 mostra il grafo, non esegue processi; va comunicato per non ri-creare l'aspettativa "BPM".
- Sequenza canonica = quella del blueprint esecutivo (`WORKITEM_GAP1_DESIGN_SPEC.md` §1): RBAC → **Porta 1** (tutto live oggi) → MLCE → Maturity → **Porta 2** piena → hardening. (La precedente preferenza "Porta 2 prima" è superata: Porta 1 è interamente costruibile live.)