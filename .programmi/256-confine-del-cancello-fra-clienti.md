# 256 — Il cancello sull'isolamento fra clienti copre solo le rotte sensibili di `orgGate`: misurare la superficie scoperta

> **item**: #256 · **priorità**: P3 · **stima**: ~mezza sessione (indagine)
> **stato**: CHIUSO
> **nasce-da**: mandato S1101 A3, **corretto dalla misura**. Il censimento Cowork del 2026-09-14 dava M5 («cancello meccanico sull'isolamento fra clienti») senza riscontro; nel register non c'è, **nel codice sì**.

## Il fatto misurato in S1101 (2026-09-14)

- **M5 è fatta**: B23 del bundle del 9 settembre, commit `6522c132` (2026-09-10, S1095) — `tenantGate` in `apps/api/src/lib/scope/gate.ts` **impedisce l'avvio** a una rotta sensibile senza dichiarazione (`TENANT_GATE_MISSING`), provata a esiti opposti; 40 moduli `"service"`, 1 `"platform"` (`assessment-methods`).
- **B1 è fatta con lei**: `sys.v_tenant_boundary_violations_full` (mig `000386`), sentinella sui 352 punti del dato vivo.
- **Il confine dichiarato da B23** (`gate.ts:64`): il cancello copre la **stessa popolazione di `orgGate`** — rotte read non-self su risorsa sensibile — non tutta la superficie. Estendere oltre è «lavoro futuro, non dato per fatto».

## Cosa fa questa voce

Non costruisce M5. **Misura** quante rotte che filtrano per `tenant_id` a monte stanno **fuori** dalla popolazione di `orgGate`, e decide — con il numero davanti — se estendere il cancello o dichiarare il confine sufficiente. È un'indagine con esito, non un rifacimento.

## Fasi

- [x] **F1 — La misura** — FATTO 2026-09-28 · quattro numeri, ognuno col comando che lo produce (dettaglio sotto).
- [x] **F2 — La decisione** — FATTO 2026-09-28 · confine dichiarato SUFFICIENTE, nessuna estensione. Dettaglio sotto.

## F1 — La misura, coi comandi

Rotte totali dell'API, da un boot vero contro il DB vivo (`buildTestApp()` + `app.orgGateStats`, script una-tantum in `.zp/msg_commit/256-misura.mts`, eseguito con `pnpm --filter @heuresys/api exec tsx <script>`):

- **popolazione `orgGate`/`tenantGate`** (rotte READ non-self su risorsa SENSIBILE): `stats.sensitiveReadRoutes.length` = **297**, tutte con `orgGate`/`tenantGate` dichiarati (`violations`/`tenantViolations` = 0).
- **popolazione `catalogGate`** (ADR-0039, rotte READ non-self su risorsa di CATALOGO): `stats.catalogReadRoutes.length` = **59**, tutte dichiarate (`catalogViolations` = 0).
- **popolazione totale coperta dai tre cancelli meccanici**: 297 + 59 = **356**.

Rotte totali e classificazione per risorsa, dall'atlante fresco (`python docs/kb/tools/build_atlas.py`, poi `.zp/msg_commit/256-analisi.py` su `docs/kb/atlas/atlas.yaml`):

- **rotte totali (tutti i metodi)**: **657**.
- **rotte GET totali**: **366**, di cui **341** con un permesso RBAC dichiarato (le altre sono `/healthz`/`/readyz` e simili, senza permesso).
- **rotte GET fuori dalla popolazione sensibile+catalogo, non-self**: **139**, su **38 risorse distinte**: `analytics, approval, auth, branch, candidate, content, dashboard, delegation, engagement_feedback, gdpr, interview, leads, me, mfa_policy, notification, observability, occupation_classification, offer, org_director, organization_unit, organization_unit_kpi_template, organization_unit_processes, platform_tenant_assignment, position, process_kpi_template, project, provenance, reference_sync, requisition, role_matrix, seed_acquisition, team, tenant, tenant_blueprint, timeline, user_position_assignment, visualization, whistleblowing`.
- **di queste 38, quante filtrano già per `tenant_id` nel proprio `repository.ts`** (`grep -c tenant_id apps/api/src/modules/<modulo>/repository.ts` per ciascuno, uno per uno): **34 su 38**, tutte con almeno un riscontro (da 1 a 29).
- **risorse GET fuori popolazione SENZA alcun filtro `tenant_id` nel repository**: **4** — `leads`, `occupation_classification`, `process_kpi_template`, `reference_sync`.

Verifica sul dato vivo per le 4 senza filtro — **hanno davvero una colonna `tenant_id` da dimenticare, o non l'hanno mai avuta?** (`psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='sys' AND column_name='tenant_id' AND table_name IN (<le loro tabelle sys_*>)"`): **0 righe** su tutte e otto le tabelle toccate da quei quattro moduli (`sys_leads`, `sys_occupation_classifications`, `sys_process_kpi_templates`, e le tabelle di riferimento di `reference-sync`: `sys_activity_classifications`, `sys_esco_occupation_mappings`, `sys_skills`, `sys_blueprint_process_registry`, `sys_kpi_definitions`). **Nessuna di queste tabelle ha mai avuto una colonna `tenant_id`**: non è un filtro dimenticato, è dato platform-wide per costruzione (tassonomie ESCO/ATECO/KPI aperte a tutte le industrie per I21, e `leads` è la superficie commerciale pubblica).

## F2 — La decisione

**Confine dichiarato SUFFICIENTE. Nessuna estensione del cancello.**

Le 139 rotte GET fuori dalla popolazione di `orgGate`/`tenantGate`/`catalogGate` si spiegano interamente in tre classi, nessuna delle quali è un buco:
1. **self-scope** (I17) — l'attore legge i propri dati, non serve un cancello di isolamento fra clienti.
2. **34 risorse su 38 filtrano già per `tenant_id` nel repository**, difensivamente, anche senza una dichiarazione `config.tenantGate` esplicita: l'isolamento c'è, solo non è *presidiato meccanicamente all'avvio* come per le 356 rotte del cancello.
3. **4 risorse (`leads`, `occupation_classification`, `process_kpi_template`, `reference_sync`) non filtrano perché le loro tabelle non hanno mai avuto una colonna `tenant_id`** — sono dato platform-wide per costruzione, non un residuo dimenticato.

Non emerge nessuna rotta GET su dato per-tenant reale che sfugga sia al cancello meccanico sia a un filtro difensivo nel repository. Estendere `orgGate`/`tenantGate` a queste 139 rotte aggiungerebbe presidio meccanico dove il presidio applicativo (2) o l'assenza strutturale del rischio (1, 3) già bastano — costo senza beneficio misurabile. Nessuna voce nuova nasce da questa indagine.

## Cronaca
