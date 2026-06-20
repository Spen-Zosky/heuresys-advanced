# Gap #1 — Design-Spec esecutivo (Porte Process/Org UI + MLCE + Maturity engine)

> ✅ **RE-ALIGNED (S998, 2026-06-20)** — Il consolidamento della documentazione di prodotto (`docs/product/`) è **concluso** (SoT = `FUNCTIONAL_CAPABILITY_LEDGER.md` + `README.md`). Delta-check eseguito vs il Ledger: **tutti i fatti tecnici/building-block CONFERMATI** (nessuna contraddizione), allineati i soli riferimenti/framing. La parte *product-narrative* (scope prospettive, priorità porte, framing scorecard) è stata ri-validata in questo riallineamento; resta da sciogliere solo il **go + le decisioni di scope §8 di Enzo** (incl. rubrica L0-L5 = D2).

> **Companion tecnico** del piano `WORKITEM_GAP1_PERSPECTIVES_AND_SCORECARD.md` (scope/fasi/effort) e della verifica `WORKITEM_GAP1_PHASE0_VERIFICATION.md` (stato reale). Questo file è il **blueprint implementativo**: data-model, algoritmi, endpoint, file, test e numerazione migration, tutto verificato live (tunnel :5433, 2026-06-19) con `file:line` reali. **Stato: PROPOSTA** — gate "go" + decisioni di scope = Enzo (sezione §8). Autore: CLI S998. DoD del repo: chiusura solo con dimostrazione LIVE su dati reali (no mock).

## 1. Sintesi e sequenza di build

Gap #1 converte la narrativa "intelligence" in prodotto dimostrabile: oggi **1 prospettiva su 3** esiste e **non c'è layer prescrittivo**. I **dati abilitanti esistono** (ESCO 126k, PIP VIEW, 844 pos-skill req, 902 skill-evidence, org 26 OU / 162 pos); manca il **layer di computazione + le 2 UI**.

**Catena di dipendenza (ordine di build obbligato):**

```
RBAC slice (ORG_DIRECTOR + perms)  ──┐
                                     ├─→  MLCE Phase-1 (composite numerico)  ──→  Maturity Phase-2 (L0-L5)  ──┐
Porta 1 Process-Owner (dati già live)─┘                                                                       ├─→  Porta 2 Org-Director console (consuma MLCE+Maturity)
                                                                                                              ─┘
```

- **RBAC + Porta 1** sono costruibili **subito, full-live** (tutti gli endpoint che servono esistono già).
- **MLCE → Maturity** sono la spina numerica (entrambi da zero; Maturity è hard-blocked su MLCE).
- **Porta 2** è live per la metà struttura→posizione→PIP **oggi**; i pannelli capability/maturity mostrano un **empty-state onesto** finché MLCE/Maturity non emettono dati (poi si accendono senza rework UI).

**Effort totale ~7.5-9 person-week** (additivo, nessun rewrite), così ripartito (verificato vs piano):

| Fase | Componente | Effort | Costruibile live oggi? |
|---|---|---|---|
| RBAC | ORG_DIRECTOR + 3 perms + 2 nav rows | ~0.5 pw | ✅ sì |
| 1 | MLCE Phase-1 (`capability-composition`) | ~1.5-2 pw | ✅ sì (usa dati esistenti) |
| 2 | Maturity engine (`capability-maturity`) | ~1.5 pw | ⛔ blocked-on-MLCE |
| 4 | Porta 1 — Process-Owner console (UI) | ~1.5-2 pw | ✅ sì (dati live, RACI demo) |
| 3 | Porta 2 — Org-Director console (UI) | ~1.5-2 pw | 🟡 metà sì; pannelli cap/maturity dopo Fase 1-2 |
| 5 | Scorecard UI + a11y/i18n hardening | ~1 pw | dopo Fase 2-3 |

**Raccomandazione di sequenza** (massimizza il dimostrabile presto): RBAC → **Porta 1** (tutto live) → **MLCE** → **Maturity** → **Porta 2 piena** → hardening.

## 2. Stato verificato (ground-truth live — ciò su cui si costruisce)

- **PIP VIEW** `sys.sys_position_intelligence_profiles_v` (`000011:272`, 22 col, JSONB proiettato a runtime via `jsonb_agg` → I9 rispettato): proietta `required_skills[{skill_id, required_proficiency, weight, criticality}]`, `required_kpis`, `required_learning_paths`, `compensation_profile`, `succession_relevance`. Consumata in `positions/repository.ts:284`.
- **Requirements**: `sys_position_skill_requirements` (`000011:90`, `weight numeric(4,3)` + `criticality` CHECK + `required_proficiency` CHECK NOVICE..MASTER); `_kpi_` (`:132`, `weight` + `rank`); `_learning_` (`:161`, `is_mandatory`, no weight); `sys_occupation_skill_requirements` (`000123:34`, globale, ESSENTIAL/OPTIONAL).
- **Held-skill** = `sys.sys_user_skill_evidence` (NON `sys_user_skills` che non esiste): `_declared_proficiency` CHECK NOVICE..MASTER, `_score`, `_assessed_at`. Mappa ordinale in `sys.sys_skill_proficiency_levels` (NOVICE=1..MASTER=6).
- **Gerarchia org**: `sys_positions.position_reports_to_position_id` (self-FK) + `sys_organization_units.organization_unit_parent_id` (self-FK). ⚠️ La **closure-table `sys_organization_hierarchies` è VUOTA (0 righe, D-35)** → usare **recursive CTE su `parent_id`**, mai la closure.
- **Conteggi live** (evidenza verifica 2026-06-19; SoT conteggi = `docs/kb/SOT_STATE.md`, non ri-hardcodare): 26 OU (RTL_BANK 23 + HEURESYS 3), 162 pos, 844 pos-skill-req, 172 pos-kpi-req, 1791 pos-learning-req, 126051 occ-skill-req, 902 skill-evidence, 160 PRIMARY-active assignments, 2 tenant ACTIVE.
- ⚠️ **GAP CRITICO PESO**: `position_economic_weight` è **NULL su tutte le 162 posizioni**; `position_criticality` popolato ma skew (160 MEDIUM / 2 CRITICAL). → la pesatura va con **COALESCE(economic_weight, criticality_factor, 1.0)**, auto-upgrade quando i pesi verranno popolati. (NB: questa è la **colonna** `sys_positions.position_economic_weight`, distinta dalla **tabella temporale** `sys_position_economic_weight` — 24 righe period-based, Ledger S-LAT7 — già proiettata nel PIP ma non esposta stand-alone.)
- **Assenti (da zero)**: 0 tabelle capability/composition/maturity; 0 permission `capability:*`; ruolo **ORG_DIRECTOR assente**; nessun event-store di dominio (#4 → ricomposizione batch, pattern `insights`).
- **Pattern di riferimento** (verificato live, da replicare): modulo `insights` — `repository.ts` delete-then-insert atomico (D-18), score-table `numeric(5,2)` 0..100 + `band varchar+CHECK` (RD-08) + `payload jsonb` + `computed_at timestamptz` (RD-09) + riga `reconciliation_registry` bucket-D EXCLUDE + assert 0-UNCLASSIFIED; `service.ts` scoring puro deterministico con re-normalizzazione pesi; `routes.ts` GET + POST `/recompute` (CSRF + perm); `recompute-cli.ts` SYSTEM_ACTOR per systemd timer.
- **UI**: sidebar DB-driven da `sys_ui_interfaces` (`000050`) via `GET /v1/me/interfaces`, gate ibrido server-side `me/service.ts:90` (`requires_admin` + permesso). Pagine read-only esistenti `processes/page.tsx` + `organization/page.tsx` (DataTable, non porte). Template master-detail già esistente: `positions/[positionId]/page.tsx`. `@heuresys/ui` espone già **ogni primitiva necessaria** (PageHeader, Breadcrumbs, Card, Tabs, DataTable, FieldGrid, EmptyState, ErrorState, CapabilityRadar, SkillHeatmap, EChartsCard, ESCOTreeNavigator…) → **nessuna nuova primitiva**.

## 3. Componente A — RBAC slice (prerequisito, ~0.5 pw, live oggi)

Nuovo ruolo + 3 permission + 2 voci sidebar. Tutto idempotente (pattern `000005`/`000049`/`000122`/`000133`/`000134`).

**Ruolo**: `ORG_DIRECTOR` ('Organization Director', `auth_role_category='functional'` come CEO) — `INSERT … ON CONFLICT(auth_role_code) DO NOTHING`. Resta **holderless** (vedi decisione D1).

**Permission** (codici verbatim dal piano; nota hyphen vs snake_case = decisione D5):
- `process-owner:read` → PLATFORM_ADMIN, TENANT_ADMIN, PROCESS_OWNER, BLUEPRINT_MANAGER
- `org-director:read` → PLATFORM_ADMIN, TENANT_ADMIN, ORG_DIRECTOR, HRMS_MANAGER
- `capability:read` → PLATFORM_ADMIN, TENANT_ADMIN, ORG_DIRECTOR, HRMS_MANAGER (+ `capability:admin` per `/recompute`)

Mapping via `INSERT…SELECT CROSS JOIN … WHERE auth_permission_code=… AND auth_role_code IN (…) ON CONFLICT DO NOTHING`. **PLATFORM_ADMIN va elencato esplicitamente** (il cross-join one-time di `000005` non copre i nuovi permessi). DO-block di verifica finale (RAISE EXCEPTION on miss).

**Sidebar** (`sys_ui_interfaces`, pattern `000134`, `ON CONFLICT(code) DO NOTHING`):
- `('process-owner-console','Console Process Owner','/process-owner','GitBranch','operations','PROCESS','process-owner','read', true, 25)`
- `('org-director-console','Console Org Director','/org-director','Network','intelligence','ENTERPRISE','org-director','read', true, 34)`

⚠️ **Verifica obbligatoria prima del build**: `apps/api/src/modules/me/service.ts` — se `UI_ADMIN_ROLES` è un set hard-coded che non include `ORG_DIRECTOR`, la voce `org-director-console` (requires_admin) non comparirebbe ai suoi holder → aggiungere `ORG_DIRECTOR` (1 riga) nella stessa slice + estendere `me.integration` (mirror test 5/5 di `000050`). Se invece deriva da category/is_platform, `ORG_DIRECTOR=functional` si comporta come HRMS_MANAGER (già mostrato) → nessuna modifica.

## 4. Componente B — MLCE Phase-1 (`capability-composition`, ~1.5-2 pw)

Nuovo modulo `apps/api/src/modules/capability-composition/` (read+compute, 7-step). Calcola un `capability_score` 0..100 per soggetto a 4 livelli **employee→position→org-unit→org** via `aggregation_mode` configurabile, con lineage append-only. È il prerequisito numerico della Maturity.

**Data-model** (2 tabelle + estensione VIEW opzionale):
- `sys.sys_capability_scores` — una riga attiva per `(subject_type, subject_id)` per coorte `computed_at`. Colonne: `subject_type varchar(16) CHECK(EMPLOYEE/POSITION/ORG_UNIT/ORG)`, `subject_id uuid` (polimorfo, no FK — integrità nel service, come gli score insights), `value numeric(5,2) CHECK 0..100`, `coverage numeric(5,2)`, `aggregation_mode varchar(24) CHECK(WEIGHTED_AVG/SIMPLE_AVG/MIN/WORST_CRITICAL/COVERAGE)`, `model_version`, `child_count`, `payload jsonb` (derivation), `computed_at timestamptz`. Tenant FK ON DELETE CASCADE (I5). Idx `(tenant, subject_type, subject_id, computed_at DESC)`.
- `sys.sys_capability_score_lineage` — ledger append-only: una riga per arco (parent, child) per coorte → ogni score aggregato è riproducibile dai figli + mode. `child_value` congelato al compute, `weight` normalizzato effettivo.
- (opzionale Fase-1, **I9**) estendere la PIP VIEW con una colonna `capability_composite json` (subquery correlata, pattern identico a `compensation_profile`) — **deferito**: l'endpoint già la espone (vedi D-opt).

**Algoritmo** (deterministico, bottom-up, in una sola call):
- **Employee** (foglia): `coverage = 100 * Σ(weight_i·s_i)/Σ(weight_i)` sulle required-skill della posizione assegnata (PRIMARY ACTIVE), dove `s_i = clamp(held_rank/required_rank, 0..1)` (held = ultima `sys_user_skill_evidence`). Criticality amplifica il peso in WEIGHTED_AVG (`CRITICAL 2.0/HIGH 1.5/MEDIUM 1.0/LOW 0.5`).
- **Position**: aggregato degli incumbent (PRIMARY+ACTIVE), peso = FTE. Posizione **vacante** → vedi decisione D3.
- **Org-unit**: aggregato delle posizioni dell'unità + sotto-unità via **recursive CTE su `parent_id`** (closure vuota). Peso = `COALESCE(position_economic_weight, criticality_factor, 1.0)` (gestisce il gap NULL).
- **Org**: aggregato delle root-unit del tenant.
- Pesi mancanti → drop + re-normalizzazione a Σ=1 (registrato in payload). `payload.derivation = {rule_id:'capability-composition-v1', aggregation_mode, model_version, computed_at, inputs:[{child_id, child_value, weight}]}` → audit completo.

**Endpoint** (prefix `/v1/capability/composition` — vedi nota collisione §6):
- `GET …/composition?subjectType=&subjectId=` → score attivo + lineage figli (404 se mai calcolato/fuori scope). `capability:read`.
- `GET …/composition?scope=org-unit` → lista score attivi di un livello, scope-filtered. `capability:read`.
- `POST …/recompute` → ricomputo bottom-up full per scope (deterministico, delete-then-insert bounded). `capability:admin` + CSRF.

**File**: `packages/shared/src/schemas/capability-composition.ts` (Zod), modulo `repository/service/routes/recompute-cli.ts`, `apps/api/test/capability-composition.integration.test.ts`, migration tabelle + permission-seed. Modifiche: `app.ts` (register step 13), `shared/index.ts` + `package.json` (subpath export), `apps/api/package.json` (script `capability:recompute`).

**Test live** (RTL_BANK, mirror `insights.integration`): recompute(admin) → position>0/orgUnit>0; GET org-unit reale → value 0..100 + lineage non-vuoto; determinismo (2× = identico); D-18 bounded (count == distinct-key); I5 (TENANT_ADMIN vede solo RTL); 403 USER senza perm; CSRF_FAIL; 404 subject ignoto; livello ORG con lineage childType ORG_UNIT.

## 5. Componente C — Maturity engine Phase-2 (`capability-maturity`, ~1.5 pw, blocked-on-MLCE)

Nuovo modulo `apps/api/src/modules/capability-maturity/`. Scorecard read-only L0-L5 che consuma il composite MLCE + una **rubrica codificata**, deriva un livello **SQL-auditable** per org-unit (grain v1).

**Data-model**: `sys.sys_capability_maturity_scores` — `org_unit_id uuid FK`, `capability_ref varchar(64) DEFAULT 'OVERALL'` (slice futura senza schema-change, vedi D-grain), `level varchar(2) CHECK(L0..L5)` (RD-08), `composite numeric(5,2)` (il numero MLCE da cui deriva = ponte auditabile), `model_version`, `payload jsonb` (= `{rule_id, rubric_version, composite, mlce_lineage_ref, criteria:[{level,label,met,evidence:{metric,value,threshold,operator}}]}`), `computed_at`. Tenant FK CASCADE. + riga reconciliation-registry bucket-D + assert 0-UNCLASSIFIED.

**Rubrica L0-L5 proposta** (DA APPROVARE — decisione D2): livello = il **più alto L** la cui banda-composite **E tutti i gate-criteri** sono soddisfatti (downgrade gated → audit-defensibile):

| L | Nome | Banda composite | Gate criteri (evidence SQL-derivabile) |
|---|---|---|---|
| L0 | Ad-hoc | <20 o no-MLCE-input | — |
| L1 | Initial | 20-40 | — |
| L2 | Repeatable | 40-55 | skill-coverage ≥ 0.4 |
| L3 | Defined | 55-70 | KPI-achievement ≥ 0.7 ∧ coverage ≥ 0.6 |
| L4 | Managed | 70-85 | KPI ≥ 0.85 ∧ readiness-coverage ≥ 0.5 |
| L5 | Optimizing | ≥85 | tutti i gate L4 ∧ quota MAJOR_GAP = 0 |

Metriche di gate tutte SQL-derivabili da dati live (composite MLCE, coverage skill-evidence, KPI measured/target, readiness `sys_succession_readiness_scores`, skill-gap `sys_skill_gap_scores`). `v1-simple` = solo bande; `v1-full` = bande + gate (raccomandato — è il gating che rende il claim audit/AI-Act-defensibile, motivo per cui Maturity batte VRIO).

**Endpoint** (`/v1/capability/maturity`): `GET …/maturity?scope=…` (lista + `criteria[]` auditabile), `GET …/maturity/org-units/:id` (404 fuori scope), `POST …/maturity/recompute` (`capability:admin`+CSRF). **Guard dipendenza**: se MLCE non emette nulla → scrive righe L0 "no MLCE input" (empty-state onesto), mai fabbricato → stato `blocked-on-MLCE`, mai "done".

**File/test**: analoghi a MLCE (mirror `insights`), test live RTL con assert che il livello è **riproducibile** da `deriveMaturity(composite, metrics, rubric_version)` (garanzia di spiegabilità).

## 6. Componente D — Le 2 Porte UI (Fasi 3+4, ~3.5-4.5 pw, no nuovi moduli API)

Solo pagine Next.js che compongono `/v1/*` esistenti via TanStack Query + `@heuresys/ui`. **Live-data only**.

**Porta 1 — Process-Owner console** (`/process-owner`, **tutto live oggi**): catalogo processi (`/v1/blueprint-processes`) → dettaglio processo + **RACI** (`/v1/organization-unit-processes/by-process/:id`, ruolo singolo OWNER/CONTRIBUTOR/CONSULTED/INFORMED) → dall'OU OWNER alle posizioni → catena skill/KPI (riusa PIP). **È navigazione del grafo, NON runtime BPM** (quello è Gap #2) → va dichiarato in pagina. ⚠️ RACI = **13 righe demo su RTL** ("NOT production truth") → vedi D-RACI.

**Porta 2 — Org-Director console** (`/org-director`): albero struttura → OU → posizioni (`/v1/positions?organizationUnitId=` — filtro verificato) → PIP (`/v1/positions/:id/intelligence-profile` + skills/kpis) → **pannello capability/maturity** (`/v1/capability/composition` + `/v1/capability/maturity`) reso **EmptyState "engine pending"** finché Fasi 1-2 non shippano, poi `CapabilityRadar` + badge L0-L5 senza rework. Insights OU-aggregati opzionali.

**Route prefix**: MLCE e Maturity condividono `/v1/capability/*` → montare **due plugin Fastify distinti** con sotto-prefissi `/v1/capability/composition` e `/v1/capability/maturity` (o un router `capability` che li compone). Da coordinare alla registrazione in `app.ts` step 13.

**E2E Playwright** (live RTL, DoD): `org-director.spec.ts` (persona `federica.marchetti` TENANT_ADMIN, autorizzata via mapping — naviga OU reale → posizioni → PIP reale; pannello cap/maturity = EmptyState pre-Fase1/2, radar+L-level dopo); `process-owner.spec.ts` (persona `luca.bianchi@rtl-bank.org` PROCESS_OWNER, **ha credenziale LOCAL live** ma va aggiunto a `fixtures.ts`/`auth.setup.ts` PERSONAS + eventuale TOTP fixture → catalogo → processo → RACI demo → catena skill/KPI; negativo: USER → 403/ErrorState). Run via `pnpm test:e2e:prod` (o `:node22` su host Node≥23, D-36).

## 7. Piano migration (numerazione coerente)

Ultima su disco = **000141** (gap 000035+000139 cosmetici). Sequenza proposta (numeri finali assegnati a implementazione, gap ammessi):

| # | Contenuto |
|---|---|
| 000142 | `capability:read` + `capability:admin` + `process-owner:read` + `org-director:read` + ruolo `ORG_DIRECTOR` + mapping (RBAC slice) |
| 000143 | `sys_capability_scores` + `sys_capability_score_lineage` (MLCE) + registry EXCLUDE |
| 000144 | `sys_capability_maturity_scores` (Maturity) + registry EXCLUDE |
| 000145 | 2 righe `sys_ui_interfaces` (console Porta 1 + Porta 2) |
| (000146 opz.) | estensione PIP VIEW `capability_composite` (I9) — solo se serve inline nel PIP |
| (000147 opz.) | grant `ORG_DIRECTOR` → utente RTL reale (000049-style) — se Enzo nomina l'holder |

Ogni migration idempotente (`CREATE … IF NOT EXISTS` + ADD CONSTRAINT guarded + `INSERT … ON CONFLICT DO NOTHING` + assert 0-UNCLASSIFIED), twice-run = empty pg_dump diff.

## 8. Decisioni aperte (autorità *cosa* = Enzo — da sciogliere prima del "go")

| # | Decisione | Opzioni | Raccomandazione |
|---|---|---|---|
| **D1** | Holder di `ORG_DIRECTOR` | (A) grant a un utente RTL reale (serve nome per funzione); (B) holderless, demo Porta 2 come `federica.marchetti`/TENANT_ADMIN (già autorizzata + persona E2E) | **(B) ora** per il demo DoD (zero blocco), **(A) follow-up** quando nomini il vero Org Director |
| **D2** | Soglie/criteri rubrica L0-L5 | proposta in §5 (`v1-simple` solo bande vs `v1-full` bande+gate) | **v1-full** (i gate sono ciò che rende Maturity audit/AI-Act-defensibile). Serve il tuo sign-off sui cutoff numerici + metriche-gate; se la rubrica autorevole è nel wiki, la adotto verbatim |
| **D3** | Posizione VACANTE nello score org-unit | (A) value=0 (drag); (B) drop+re-normalizza; (C) imputa da baseline | **(B)** in Phase-1 (lo score riflette la capability del personale in carica); rivedere con la dimensione "staffing". Impatto live ~2 vacanze su 162 |
| **D-grain** | Grain Maturity: solo org-unit, o org-unit × capability | (A) org-unit (`capability_ref='OVERALL'`); (B) richiede entità `capability` di prima classe + mappa skill→capability (non esiste) | **(A)** v1 (la colonna `capability_ref` future-proofa B senza schema-change). Sblocca la Porta 2 |
| **D-cap** | Entità `capability` di prima classe in MLCE | (A) Phase-1 = coverage diretta per (subject,level), no grouping; (B) modellare `sys_capabilities` + mappa ora | **(A)** — è il prerequisito numerico, usa 100% dati esistenti; la tassonomia skill→capability è una decisione/popolazione di prodotto separata |
| **D-mode** | `aggregation_mode` default org-unit/org | WEIGHTED_AVG / SIMPLE_AVG / WORST_CRITICAL / COVERAGE | **WEIGHTED_AVG** con fallback `COALESCE(economic_weight, criticality, 1.0)` (significativo ora, auto-upgrade quando popoli i pesi); override `?aggregationMode=` esposto |
| **D-RACI** | RACI di produzione per Porta 1 | oggi 13 righe demo RTL ("NOT production truth"). (A) demo etichettata; (B) fornisci dataset RACI reale | **(A)** ship + etichetta "demo RACI" per la narrativa; **(B)** = tuo input di prodotto (engine/UI pronti appena ci sono righe reali) |
| **D5** | Casing permessi (`process-owner:read` vs `process_owner:read`) | il piano usa hyphen; la house-style multi-parola è snake_case | mantengo i literal del piano per tracciabilità + nota nell'header; se preferisci snake_case stretto, normalizzo i 3 una volta sola prima del commit |
| **D-opt** | Esporre composite via PIP VIEW in Phase-1 | (A) sì (000146, I9-compliant); (B) defer (l'endpoint già lo serve) | **(B)** defer alla fase UI/Maturity |

## 9. Rischi principali (probabilità × mitigazione)

| Rischio | P | Mitigazione |
|---|---|---|
| `position_economic_weight` NULL su tutte → WEIGHTED_AVG produce NULL/0 | HIGH | `COALESCE(economic_weight, criticality_factor, 1.0)`; tier registrato in payload; test assert valore non-null su RTL reale |
| Closure-table vuota (D-35) → roll-up piatto sbagliato | HIGH | **mai** leggere la closure; recursive CTE su `parent_id` tenant-scoped; unit-test sull'albero RTL reale (1 root, depth>1) |
| Maturity senza input MLCE (Phase-1 non shippata) | HIGH | sequenza stretta MLCE→Maturity; guard dipendenza scrive L0 onesto; stato `blocked-on-MLCE`, mai "done" |
| Rubrica senza sign-off Enzo = soglie arbitrarie | HIGH | decisione D2 esplicita; `rubric_version` in payload → revisione supersede senza data-loss |
| `me/service` `UI_ADMIN_ROLES` esclude ORG_DIRECTOR → sidebar non mostra la console | MED | leggere `UI_ADMIN_ROLES` PRIMA del build; se hard-coded aggiungere ORG_DIRECTOR + estendere `me.integration` |
| `criticality` skew (160 MEDIUM/2 CRITICAL) → WEIGHTED_AVG ≈ SIMPLE_AVG oggi | MED | accettabile Phase-1 (matematica corretta, auto-differenzia); esporre mode COVERAGE/WORST_CRITICAL per segnale più netto |
| `subject_id` polimorfo senza FK → righe orfane | MED | tenant-FK CASCADE; il delete-then-insert per coorte pota i soggetti spariti al recompute successivo; commento + registry rationale (come gli score insights) |
| Mandatory-MFA live per `luca.bianchi` (persona Porta 1) | MED | `completeMfaIfChallenged` già gestisce; aggiungere il TOTP fixture in `mfa-fixture-secrets.ts` |
| Collisione prefix `/v1/capability/*` (MLCE + Maturity) | MED | due plugin con sotto-prefissi `/composition` e `/maturity` |

## 10. Definition of Done (vincolante)

Ogni fase chiude **solo** con dimostrazione live su RTL_BANK: comando + risposta API reale + screenshot UI + path/timestamp (R5). Mock = scaffold intermedio, mai chiusura. Mancano secret/approval/decisione → stato `blocked-on-Enzo`, mai "done". MLCE/Maturity = `pnpm db:migrate` + integration test live verdi; Porte = E2E Playwright `pnpm test:e2e:prod` verdi su dati seed reali. Gate trasversale per ogni commit: typecheck 5/5 ws + vitest API + Playwright + i18n parity.
