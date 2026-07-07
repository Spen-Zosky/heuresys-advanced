# REVIEW-12 — Adversarial review del wargame 12 (heuresys #26 A/L1 goals/OKR)

**Reviewer**: indipendente, adversarial (non autore del piano). 2026-07-06.
**Target**: `wargames/12-heuresys-goals-okr.md` · Standard: `SUCCESS.md` · Brief: `tasks/12-heuresys-goals-okr.md`.
**Metodo**: spot-check di 20 claim fattuali contro il repo read-only `D:\heuresys-advanced` (file+DDL+node_modules, zero comandi git, zero DB — il tunnel non è nel perimetro del reviewer), poi attacco mirato su count-coupling, RBAC, blind-executability.

---

## VERDETTO

**CONDITIONAL PASS — eseguibile SOLO dopo 4 patch (1 HIGH, 3 MEDIUM).**
La ricognizione del piano è di qualità rara: 18/20 claim verificati ESATTI (fino al numero di riga del DDL). La claim centrale "**zero migration necessarie**" è **CONFERMATA in modo indipendente** (vedi §3). Ma il piano lascia una judgment call nascosta che fa esplodere un test pre-esistente hardcodato, un template psql col DB sbagliato, un contratto testid E2E non implementabile col componente scelto, e un leak-vector sugli okr check-ins che il red-team del piano non ha visto.

---

## 1. SPOT-CHECK OUTCOMES (≥10 richiesti; eseguiti 20)

| # | Claim del piano | Esito | Evidenza (verified-by) |
|---|---|---|---|
| 1 | 7 tabelle dormant in mig 000037, DDL line pins 41/216/277/333/379/432/628 | ✅ ESATTO | `db/migrations/000037_sys_goals_okrs_scaffold.sql` — CREATE TABLE alle righe 41, 216, 277, 333, 379, 432, 628 (grep -n) |
| 2 | Indici per-goal (`*_goal_idx`, alignments source/aligned, okr_check_ins okr_idx) | ✅ | 000037:260, 324, 370, 414, 468-469, 680 |
| 3 | `check_in_subject_user_id NOT NULL` + FK RESTRICT (goal check-ins) | ✅ | 000037:281 (`uuid NOT NULL`) + :318 (FK `ON DELETE RESTRICT`) |
| 4 | okr check-ins: subject **nullable**, FK SET NULL, scope-coherence CHECK | ✅ | 000037:633, :674, :657-662 (`KEY_RESULT`↔kr NOT NULL / `OKR_AGGREGATE`↔kr NULL) |
| 5 | `comment_is_private boolean NOT NULL DEFAULT false` | ✅ | 000037:387 |
| 6 | `goal:read`/`okr:read` seedati mig 000142 ai 6 ruoli elencati; assert = **floor >= 8** con commento su 000166 | ✅ | `000142_goals_okrs_permission_seed.sql:26` (i 6 role code esatti) + :40-43 (`IF v < 8 THEN RAISE`) |
| 7 | `goal:read:self` seedato 000166 a 4 ruoli ESS; backfill 632/1067 via `LEGACY_EMP::` | ✅ | `000166_me_goals_self.sql:44` (4 ruoli esatti) + header :10 (632/1067) + :28 (crosswalk I14) |
| 8 | `goal`/`okr` → EVALUATION in data-classes.ts **:70-72** | ⚠️ SOSTANZA SÌ, RIGHE NO | `apps/api/src/lib/scope/data-classes.ts:65-66` (non 70-72) → finding L1 |
| 9 | gate.ts D-51: self-exempt by design, `ORG_GATE_MISSING` refuse-boot | ✅ | `gate.ts:79` (`parts.includes("self") → null`), :116-122 (throw) |
| 10 | okrs `listKeyResults` = il template 7-step, service.ts **:37-42** | ⚠️ SOSTANZA SÌ, RIGHE ~ | `okrs/service.ts:36-41` (off-by-one) → L1 |
| 11 | goals-scope test: 5 personas reali, password env-driven F-001, SUITE_PREFIX, invariant-only | ✅ | `test/goals-scope.integration.test.ts:45-48,105-116` + `test/helpers/personas.ts:26` (`requiredEnv("TEST_ADMIN_PASSWORD")`, fail-closed) |
| 12 | `MeGoalSchema` senza `goalId`, me.ts:491-503 | ✅ ESATTO | `packages/shared/src/schemas/me.ts:491-503` — 11 campi, nessun id |
| 13 | `/v1/me/goals` routes.ts:200-203 (`goal:read:self`); `loadMyGoals` WHERE a repository.ts:453 | ✅ ESATTO | `me/routes.ts:200-203`; `me/repository.ts:453` |
| 14 | `@heuresys/ui@0.1.9` esporta `Timeline` + `TimelineEvent` (+ Dialog completo) | ✅ | `apps/web/package.json:20` (`^0.1.9`); `node_modules/.pnpm/@heuresys+ui@0.1.9*/…/dist/index.d.ts`: `TimelineEvent {id,time,title,description?,icon?,tone?}`, `Timeline({events,className,emptyMessage})`, Dialog/DialogContent/…/DialogTrigger tutti presenti |
| 15 | goals/page.tsx 71 righe DataTablePanel, testids; `EntityTableProps` **:31-46** senza onRowClick | ✅ ESATTO | `goals/page.tsx` (70-71 righe, testids `goals-*`); `data-table-panel.tsx:31-46` — nessun onRowClick, `DataColumn.cell → ReactNode` |
| 16 | me/career 3 sub-tab (28 righe) + goals-tab.tsx (37) con testids `career-goal*` | ✅ | `me/career/page.tsx:14-18`; `_components/goals-tab.tsx:18-25` |
| 17 | E2E goals.spec.ts (tenantAdmin, `goals-title/count/row`) + me-career-tabs.spec.ts (employee) | ✅ | entrambi i file, `storageStateFor` in `tests/e2e/fixtures.ts:70,79,87` |
| 18 | i18n `hr.json` goals/okrs block + `ess.json` career.goals in it+en | ✅ | parse JSON entrambe le lingue: chiavi identiche it/en |
| 19 | M0 expected: 167 file migration, max 000169; SoT S1016 HEAD `2397eb0a` | ✅ | `ls db/migrations/*.sql | wc -l` = 167, tail = 000169; `SOT_STATE.md:13` |
| 20 | R11: password in `.secrets/test_admin_password.txt` | ✅ | il file esiste in `.secrets/` (verificato ls, contenuto NON letto) |

Verifica incrociata anti-count-coupling (attacco §3): `org-gate.integration.test.ts` è **drift-proof** (deriva dal taxonomy, `violations toEqual([])` — nuove route annotate passano); `scope-data-classes.integration.test.ts` non conta route; nessun test asserisce il numero di permessi goal/okr o di mapping RBAC in modo che il piano possa rompere. **Una eccezione trovata → H1.**

---

## 2. FINDINGS

### H1 (HIGH) — La judgment call di M6.3 innesca la mina `toBe(4)` in me-career-tabs

**Evidenza**: `apps/api/test/me-career-tabs.integration.test.ts:47`:
```ts
expect(body.total).toBe(4); // tommaso bridged to 4 legacy goals (mig 000166)
```
**Attacco**: M6.3 dice *"extend the existing me career test file **or** sibling"*. È una scelta lasciata all'esecutore (violazione SUCCESS.md #3). Il ramo "extend the existing file" è avvelenato: il piano richiede di seedare un goal con subject=tommaso per testare la timeline; sotto D-52 il rollback è **per-FILE**, quindi DENTRO lo stesso file la fixture è visibile → `GET /v1/me/goals` per tommaso ritorna total=5 → l'assert pre-esistente alla riga 47 diventa rossa, l'esecutore entra in un loop R3 su un test che non capisce (il fork F6 copre solo il "key set", NON il count). Il ramo sibling è invece sicuro (rollback prima del file successivo, vitest singleThread).
**Patch (testo esatto, M6.3)** — sostituire:
> `3. me-goals (extend the existing me career test file or sibling): …`

con:
> `3. me-goals — NEW SIBLING FILE ONLY: create test/me-goals-timeline.integration.test.ts (do NOT extend me-career-tabs.integration.test.ts and do NOT seed any goal for tommaso inside that file: its line 47 hardcodes expect(body.total).toBe(4) on /v1/me/goals — a same-file fixture is visible under D-52 per-FILE rollback and breaks it). In the sibling: tommaso GET /v1/me/goals → items now carry goalId; GET /v1/me/goals/<his seeded goal>/timeline → 200 with seeded events; GET /v1/me/goals/<antonio's goal id>/timeline → 404; unauthenticated → 401.`

E aggiungere a F6:
> `F6-bis — me-career-tabs total: IF me-career-tabs.integration.test.ts goes red on total after your changes → you seeded a goal for tommaso in the WRONG file; move the fixture to the sibling file, never edit the toBe(4) expectation for this mission.`

### M1 (MEDIUM) — Template PSQL con database sbagliato (12 comandi recon dipendono da lì)

**Evidenza**: piano §2: `PSQL="psql postgresql://heuresys@localhost:5433/heuresys"`. Il canonico del repo (CLAUDE.md §Required infrastructure) è `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced` — il DB si chiama **`heuresys_advanced`**, non `heuresys`. Il piano hedge-a ("adapt user/db from .env") ma R2-R12, M0/V1/V2 usano il template letterale: un esecutore mid-tier lo copia, prende `FATAL: database "heuresys" does not exist` a inizio missione e la prima cosa che il piano gli fa vedere assomiglia ad ABORT A2 (tabelle "missing").
**Patch**: in §2 riga 78 sostituire con:
> `` `PSQL="psql postgresql://heuresys@localhost:5433/heuresys_advanced"` (db name per repo CLAUDE.md; if auth fails, read the exact DSN from the gitignored `.env` — do NOT print credentials). ``

### M2 (MEDIUM) — M11 asserisce un testid (`goals-timeline-event`) che il componente scelto in M7 non può produrre

**Evidenza**: verificato `dist/index.d.ts` di `@heuresys/ui@0.1.9`: `Timeline({ events, className, emptyMessage })` con `TimelineEvent { id, time, title, description?, icon?, tone? }` — **nessuno slot testid per-evento**; gli eventi sono renderizzati internamente al componente. M7 istruisce testids `goals-timeline-open/dialog/empty`; M11 però fa asserire `goals-timeline-event` first visible. Così com'è, o l'esecutore scarta il componente (F5 senza che il trigger sia scattato) o l'E2E non ha selettore. Gap di blind-executability tra due move.
**Patch (M7)**: aggiungere:
> `Wrap the <Timeline events={…}/> render in a container div with data-testid="goals-timeline-events" (visible only when items.length > 0; the empty branch renders goals-timeline-empty instead). Same for okrs (okrs-timeline-events) and ESS (career-goal-timeline-events).`

**Patch (M11)**: sostituire ogni `goals-timeline-event` con `goals-timeline-events` (container), i.e. `expect dialog visible AND (goals-timeline-events visible OR goals-timeline-empty visible)`; idem per il toggle ESS.
*(Nota positiva: `time` è una string preformattata → il mapping occurredAt→formatDate previsto dal piano è corretto; R1 confermerà, F5 quasi certamente non scatta.)*

### M3 (MEDIUM) — okr check-ins: leak-vector sul subject user che il red-team del piano non ha attaccato

**Evidenza**: `sys_okr_check_ins.check_in_subject_user_id` (000037:633, FK `sys_users`) può essere una persona **diversa** da `okr_owner_user_id`, e le righe portano notes/blockers/confidence — dati EVALUATION per-persona. Il piano (M4) gate-a `listOkrCheckIns` clonando `listKeyResults`, cioè SOLO su tenant + org-readability dell'**owner** dell'OKR (e un OKR con owner NULL è tenant-visible). Risultato: un MANAGER che vede l'OKR legge check-ins il cui subject è FUORI dal suo sub-tree — tensione diretta con **I18** ("sensitive data organizational-only"). Il precedente key-results non copre il caso: le key-results non hanno subject persona. Il red-team del piano ha attaccato goals (Attack 1) ma non questo ramo. Per la regola di autorità del piano stesso ("product decisions are fenced off"), la scelta è di Enzo — ma il piano non la instrada.
**Patch**: (a) aggiungere a §2/Items ENZO:
> `E4: okr check-in rows carry a per-person subject (check_in_subject_user_id) that may differ from the OKR owner; v1 default = expose the row but NULL out subjectUserId when canReadOrgTarget(subject) is false (mirror of the alignments counterpart-title rule — decided, no judgment). Whether to instead HIDE such rows entirely is Enzo's call — record count of rows with subject ≠ owner in the report.`

(b) in M4, dopo "add `listOkrCheckIns` cloning `listKeyResults`":
> `then apply the E4 v1 rule: for each row with a non-null subjectUserId, if NOT canReadOrgTarget(pool, a, subjectUserId, o.tenantId) → set subjectUserId: null (keep the row).`

(c) in M6.2 aggiungere l'assert: seed un check-in con subject=antonio su un OKR owner=tommaso → paolo lo legge con `subjectUserId === null`.

### M4 (MEDIUM) — Fixture okr di M6.2 sotto-specificata rispetto alla superficie NOT NULL

**Evidenza**: `sys_okrs` richiede `okr_natural_key`, `okr_objective`, `okr_period_start`, `okr_period_end` NOT NULL (000037:482-489) + CHECK su type/period/status; `sys_okr_check_ins` richiede `check_in_natural_key` NOT NULL (000037:634) + `check_in_tenant_id` + `check_in_scope`. M6.2 dice solo "seed 1 okr + 1 check-in (scope OKR_AGGREGATE, kr NULL)" — nessuna column list (il lato goals invece punta a `seedGoal`). Un esecutore blind incassa una serie di `23502 not_null_violation` prima di convergere.
**Patch (M6.2)**: aggiungere:
> `OKR INSERT minimal columns: (okr_tenant_id, okr_natural_key='${SUITE_PREFIX}::okr', okr_objective, okr_owner_user_id, okr_period_start='2026-01-01', okr_period_end='2026-03-31') — defaults cover type/period_type/status. Check-in INSERT minimal: (check_in_tenant_id, check_in_okr_id, check_in_natural_key='${SUITE_PREFIX}::ci1', check_in_scope='OKR_AGGREGATE') — check_in_key_result_id stays NULL (coherence CHECK), check_in_date defaults.`

### L1 (LOW) — Tre pin di riga presentati come VERIFIED sono scivolati

`data-classes.ts:70-72` → reale **65-66**; `okrs/service.ts:37-42` → reale **36-41**; `goals/routes.ts:16-27` → reale **15-25**. Sostanza corretta in tutti e tre; ma un piano che vende precisione al numero di riga deve pagarla. Patch: correggere i tre riferimenti.

### L2 (LOW) — Baseline suite S1015 stantia in §1.4

"186 files passed / 2 skip, 1285 tests" è il delta S1015; il SoT S1016 dice **189** file API (verificato `SOT_STATE.md:13`). M10/V7 usa già "≥189", quindi nessun impatto operativo — allineare la citazione per coerenza.

### L3 (LOW) — Il gold-pattern da clonare contiene una password stantia nel commento

`goals-scope.integration.test.ts:26` (e altri 9+ file scope) recita nel header `(password Admin#PassW0rd!)` — residuo pre-F-001 (la password è stata ruotata, il valore è morto, ma è un pattern che non deve replicarsi). Il piano dice di creare sibling "mirroring S1014 style": un esecutore che copia il header replica la riga.
**Patch (M6, una riga)**:
> `When cloning the scope-suite header comment, DROP the literal "(password Admin#PassW0rd!)" fragment — stale pre-F-001 residue; write "(password env-driven, F-001)". Flag the residue in the 10 existing files to Enzo in the report (cleanup candidate, not this mission).`

### INFO
- **I1**: il file `000037_*.sql` si auto-intitola "Migration 000035" nel header (il gap 000035 è documentato come cosmetico in CLAUDE.md) — nessun impatto su A2.
- **I2**: la claim "zero D-12/D-38 exposure" regge: nessuna migration nel diff previsto, l'assert 000142 è floor, `org-gate` test è taxonomy-derived, nessun test conta permessi goal/okr.

---

## 3. VERIFICA INDIPENDENTE DELLA CLAIM "ZERO MIGRATIONS"

Confermata su quattro assi (tutti verificati su file, non su memoria):
1. **Permessi**: le nuove route riusano `goal:read` / `okr:read` / `goal:read:self` — tutti e tre esistono nelle migration (000142:10,14; 000166:33). I sub-read okr viaggiano sotto `okr:read` esattamente come l'esistente `/:id/key-results` (okrs/routes.ts:27-31). **Non esiste `okr:read:self`** e non serve: il piano non apre alcuna route ESS okr (coerente col brief, che chiede self-scope solo sui goals).
2. **Schema**: tutte le colonne/indici richiesti esistono da 000037; nessuna colonna nuova.
3. **Gate D-51**: nuove route admin annotate `orgGate:"service"` passano il collector; `/me/*` esenti via `parts.includes("self")` (gate.ts:79) — F7/A5 del piano sono la risposta giusta al caso patologico.
4. **Test-coupling**: nessun assert su count di permessi/route che una route in più romperebbe (org-gate test derivato, non hardcodato).

---

## 4. GRADE INDIPENDENTE (SUCCESS.md, 8 punti)

| # | Criterio | Esito | Nota |
|---|---|---|---|
| 1 | Expected observation per move | **PASS** | Le aspettative verificabili staticamente sono esatte (167/000169, testids, personas, floor>=8) |
| 2 | Failure+causa+counter per move | **PASS (con gap)** | Manca il failure NOT-NULL della fixture okr (M4) e la mina toBe(4) (H1) |
| 3 | Fork con trigger, zero judgment call | **FAIL → patchable** | M6.3 "existing file **or** sibling" è una judgment call, e un ramo è avvelenato (H1) |
| 4 | RECON NEEDED con check esatto | **PASS (con difetto)** | R1-R12 letterali e giusti, ma il template PSQL punta al DB sbagliato (M1) |
| 5 | Abort conditions | **PASS** | A1-A8 corretti; A3/A4 confermati non-scattabili dalla mia verifica §3 |
| 6 | Verification spelled out | **PASS (con difetto)** | V1-V13 solidi; il testid di V8/M11 non è costruibile come scritto (M2) |
| 7 | Red-team pass registrato | **PASS (incompleto)** | 3 attacchi registrati e genuini; il 4° (okr subject leak, M3) è passato inosservato |
| 8 | Eseguibile blind | **CONDITIONAL** | H1+M1+M2+M4 generano ciascuno una domanda o una svolta sbagliata per un mid-tier |

**Punteggio: 5/8 pieni, 3 condizionali, 0 irrimediabili → CONDITIONAL PASS.** Con le 4 patch applicate: 8/8 plausibile.

---

## 5. ESITO

- **Findings**: 1 HIGH · 3 MEDIUM · 3 LOW · 2 INFO · 0 CRITICAL (nessuna evidenza sbagliata nei 20 spot-check: 18 esatti, 2 con drift di riga).
- **Safe da eseguire blind DOPO le patch**: **SÌ**. Senza patch: NO — H1 manda l'esecutore in un loop R3 su un test pre-esistente e M1 gli sbarra la recon al primo comando.
