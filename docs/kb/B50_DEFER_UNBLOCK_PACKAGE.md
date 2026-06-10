# B-50 unblock-package — 3 DEFER (S981)

Dossier misurato live 2026-06-10 su: **advanced** `heuresys_advanced` (localhost:5433, tunnel VM) + **legacy** `heuresys_platform` (oracle-vm-default, psql nativo). Solo letture. Stato attuale target: `sys_branches=0, sys_succession_pools=0, sys_successor_candidates=0` righe. Chiave persona verificata: `sys.sys_users.user_external_code` = **`LEGACY_EMP::<employees.id>`** su 160/161 utenti (1 NULL = admin piattaforma) — conforme I14.

Riferimento muri: migration `db/migrations/000076_b50_residual_wall_terminal_annotation.sql` (S972) tiene i 3 tavoli in `NEEDS_DECISION` nel registry.

---

## 1. MURO 1 — bridge location ↔ org_unit (sys_branches)

### 1.1 Legacy `locations` — censimento

```sql
SELECT count(*) FROM locations;                       -- => 34
SELECT t.name, count(l.id) FROM tenants t LEFT JOIN locations l ON l.tenant_id=t.id GROUP BY 1;
-- RTL Bank=15 | SmartFood=11 | EcoNova=5 | Heuresys System=3
```

Campi utili (da `\d locations`, 34 colonne): `code(20) NN`, `name(100) NN`, `location_type(30)` (headquarters/office/branch), `address(255)`, `city`, `province`, `postal_code`, `country` (default `'ITA'` — char(3), il target è `char(2)` → mapping ITA→IT), `phone`, `email`, `latitude/longitude`, `capacity_headcount`, `opening_date/closing_date`, `is_active`. **Nota schema target: `sys_branches` non ha colonna name** → name della location va in `branch_metadata`.

### 1.2 Cardinalità org_units → location (il "47 FK su 13 location")

Il bridge reale è **`org_units.default_location_id`** (nessun constraint FK formale; gli unici FK dichiarati verso `locations` sono `contracts.location_id` e `internal_mobility_postings.location_id`).

```sql
SELECT count(*), count(default_location_id), count(DISTINCT default_location_id) FROM org_units;
-- => 76 | 47 | 13   (conferma esatta del muro PM)
-- per tenant: RTL 32|21|5 · SmartFood 25|16|5 · EcoNova 11|7|2 · Heuresys System 8|3|1
```

Distribuzione completa per i 2 tenant in scope advanced (RTL_BANK + HEURESYS):

| Tenant | location code | name | type | n° org_units |
|---|---|---|---|---|
| RTL | MI-HQ | Sede Centrale Milano | headquarters | **15** |
| RTL | MI-OPS | Centro Operativo Assago | office | **3** |
| RTL | BG-CEN | Filiale Bergamo Centro | branch | **1** |
| RTL | BS-CEN | Filiale Brescia Centro | branch | **1** |
| RTL | MI-CEN | Filiale Milano Centro | branch | **1** |
| RTL | BG01, BS01, CO01, HQ, MI01, MI02, MZ01, OPS, VA01, TEST-AUTH-LOC | (10 location) | branch/hq/office | **0** |
| HS | HS-HQ | Ufficio Milano Centrale | headquarters | **3** |
| HS | HQ, TEST-AUTH-LOC | — | — | **0** |

- **Location con UNA SOLA org_unit (importabili 1:1 senza alcuna decisione): 3 su RTL** (BG-CEN, BS-CEN, MI-CEN) — globalmente 5 (le altre 2 sono SmartFood, fuori scope).
- Le 10 location RTL a 0 org_units includono una **serie duplicata pre-esistente** (BG01≈BG-CEN, BS01≈BS-CEN, MI01≈MI-CEN, HQ≈MI-HQ, OPS≈MI-OPS): due generazioni di seed legacy. La serie "viva" (referenziata dalle OU) è quella `*-CEN`/`MI-*`.

### 1.3 Aggancio al target — traceability GIÀ ESISTENTE

```sql
-- advanced: 26 OU totali (RTL_BANK=23, HEURESYS=3); tipi: DIVISION 18, OFFICE 5, HEADQUARTERS 2, TEAM 1
SELECT DISTINCT jsonb_object_keys(organization_unit_metadata) FROM sys.sys_organization_units ...;
-- => legacy_org_unit_id, legacy_org_type, ... (presente su tutte le 23 OU RTL)
```

Le 23 OU advanced RTL portano **`organization_unit_metadata->>'legacy_org_unit_id'`** = id legacy → il join `advanced OU → legacy org_unit → default_location_id → location` è **deterministico al 100%**, nessun matching euristico. Le 9 OU legacy RTL non importate (8 `PROTO-*` + `TEST-AUTH`) non hanno location (32−9=23 ✓). Le 3 OU `FIL-*` advanced (FIL-BG-CEN, FIL-BS-CEN, FIL-MI-CEN, type OFFICE) corrispondono esattamente alle 3 location 1:1.

### 1.4 Schema target `sys.sys_branches` (vincoli misurati)

NOT NULL: `branch_organization_unit_id` (FK→sys_organization_units, **UNIQUE**), `branch_tenant_id`, `branch_code(64)` (UNIQUE per tenant), `branch_opening_hours jsonb` (default `{}`), `branch_metadata jsonb`. Nullable: address_line1/2, city, postal_code, `country_code char(2)`, region_code, regulatory_zone. La UNIQUE su OU vincola **1 branch per OU**, non 1 OU per location → il muro "cardinalità inversa" si risolve scegliendo **una OU àncora per location**, non spalmando la location su tutte le OU.

### 1.5 Opzioni sblocco sys_branches

| Opzione | Contenuto | Branch creati | Effort | Rischio |
|---|---|---|---|---|
| **A — solo 1:1 stretti** | importa le 3 location RTL con esattamente 1 OU (FIL-* già in advanced) | 3 | ~1.5h | BASSO (zero decisioni) |
| **B — regola àncora-OU (raccomandata)** | per ogni location referenziata: branch agganciato alla **OU topologicamente più alta** del gruppo (MI-HQ→OU root `RTL` HEADQUARTERS; MI-OPS→`DIV-OPS`; le 3 FIL-* 1:1; HS-HQ→OU root HEURESYS) | 6 (5 RTL + 1 HS) | ~2–3h | BASSO-MEDIO (1 decisione semantica: HQ/OPS contano come "branch"? — il modello sys_branches è anagrafica sede, compatibile) |
| **C — copertura totale filiali** | creare OU nuove per le 7 filiali orfane (BG01…VA01) + risolvere la serie duplicata | 13+ | ~4–6h + ADR | MEDIO-ALTO (invata struttura org non presente nell'org chart legacy vivo; duplicati BG01/BG-CEN ambigui) |

**Raccomandazione tecnica: B.** Regola deterministica, traceability completa in `branch_metadata` (legacy location id + name + serie duplicata annotata), le 10 location orfane RTL dichiarate residuo terminale nel registry (la serie duplicata è dead-data legacy). C è sconsigliata: crea org chart, autorità PM.

---

## 2. MURO 2 — bridge position (sys_succession_pools)

### 2.1 Scoperta strutturale: la sorgente giusta è `succession_plans`, non `talent_pools`

Schema target: `succession_pool_position_id` **NOT NULL** FK→`sys_positions`, code UNIQUE/tenant, status CHECK (ACTIVE/ARCHIVED/PROPOSED). È un pool **position-centrico**.

- `talent_pools` (24 = 8 RTL + 8 SF + 8 EN; **0 HS**) sono pool **generici per criterio** (`pool_type`: critical/high_potential/innovation/mobility/leadership/emerging/succession/expertise + `criteria jsonb` tipo `{"min_performance":4.0,"max_age":40}`) — **nessuna position ricavabile da name/criteria/owner**: strutturalmente incompatibili col target. Verdetto: non-mappabili su `sys_succession_pools` (eventuale futuro target diverso).
- `succession_plans` (31 = 10 RTL + 10 SF + 8 EN + 3 HS) sono il vero equivalente: `position_name(200) NOT NULL` (31/31 valorizzato, 31 distinct), `position_id` **0/31** (conferma muro), `incumbent_employee_id` 10/31 (RTL 6/10, HS 3/3), `criticality_level`, `status`.

### 2.2 Position ricavabile per ALTRA via — misurato su RTL (158 positions attive)

**Via incumbent** (`'LEGACY_EMP::'||incumbent_employee_id` → sys_users → `sys_user_position_assignments` PRIMARY ACTIVE): **6/6 risolti**:

```
CRO / Chief Risk Officer        => POS-00000313 [Risk Analyst]        ← semanticamente dubbio
CTO / Chief Technology Officer  => POS-00000431 [IT Director]
Head of Compliance              => POS-00000291 [Compliance Officer]
Head of HR                      => POS-00000403 [HR Director]
Head of Operations              => POS-00000338 [Operations Director]
Head of Retail Banking          => POS-00000436 [Retail Director]
```

**Via titolo** (match su `position_title` RTL attive): `CEO` → POS-00000321 exact unico; `Chief Risk Officer` → POS-00000396 exact unico (preferibile all'incumbent "Risk Analyst"); `Finance Director` → POS-00000384 unico (fuzzy per "CFO / Direttore Finanziario"); `Operations Director` → **2 match** (POS-00000338/378, ambiguo da solo, disambiguato dall'incumbent); `Branch Director` → **0 match**; "Compliance" fuzzy → 19 match (inutilizzabile).

**Cascata deterministica risultante (RTL): 8/10 auto-derivabili** — (1) exact-title unico [CEO, CRO]; (2) incumbent PRIMARY ACTIVE [CTO, Head of HR/Operations/Compliance/Retail]; (3) fuzzy unico [CFO→Finance Director, da confermare]. **Picklist PM residua: 2–3 righe** (Branch Director Milano: nessuna position; Head of Corporate Banking: nessun match; CFO se il fuzzy non convince). HS: 3 piani tutti con incumbent ma **solo COO risolve** (1/3; CEO&Founder e CTO/Head of Product → employee non presenti in advanced).

### 2.3 Opzioni sblocco sys_succession_pools

| Opzione | Contenuto | Pool creati | Effort | Rischio |
|---|---|---|---|---|
| A — solo auto-derivabili | importa cascata (1)+(2), residuo in picklist successiva | 7–8 RTL +1 HS | ~2h | BASSO |
| **B — picklist completa (raccomandata)** | Enzo conferma/compila la tabella 10 righe RTL sopra (5 min: 8 pre-compilate + 2-3 scelte), import 10/10 +1 HS | 10–11 | ~2–3h post-decisione | BASSO (mapping esplicito firmato, salvato in `succession_pool_metadata`) |
| C — schema change (`position_id` nullable) | — | — | — | **SEGNALATO E SCONSIGLIATO**: viola il design position-centric, richiede ADR nuovo; nessuna necessità dato che 8/10 si derivano |

**Raccomandazione tecnica: B.** Il dossier rende la decisione un sì/no per riga; `talent_pools` dichiarati formalmente non-sorgente per questo target nel registry.

---

## 3. sys_successor_candidates (gated su pools)

### 3.1 Misure

```sql
SELECT count(*), count(candidate_employee_id), count(critical_role_id), count(DISTINCT candidate_employee_id) FROM succession_candidates;
-- => 206 | 206 | 120 | 147     (employees è VIEW su employees_core; 0 orfani: tutti i 206 risolvono a employees)
-- per tenant: RTL 116 (linked a un piano: 30, esattamente 3 per ciascuno dei 10 piani; 88 employee distinti) · SF 52 · EN 32 · HS 6
```

**Cross-match advanced (RTL):** 88/88 employee distinti risolvono a `sys_users` via `LEGACY_EMP::` (86 ACTIVE, 2 non-ACTIVE). I 40 `talent_pool_members` RTL: 40/40 ACTIVE (ma irrilevanti finché talent_pools non ha target). HS: 2/4 employee esistono (1 ACTIVE, 1 DEACTIVATED).

**Vincoli target:** `successor_candidate_pool_id` NOT NULL (→ gating sui pool §2), `user_id` NOT NULL FK, UNIQUE(pool,user) — duplicati legacy (plan,employee): **0** ✓. CHECK readiness: `READY_NOW/READY_6_MONTHS/READY_1_YEAR/READY_2_YEARS/NOT_READY`; CHECK status: `CANDIDATE/CONFIRMED/WITHDRAWN/NOT_READY`.

**Readiness dei soli linked importabili (36 = 30 RTL + 6 HS):** ready_2_years 11 · ready_3_5_years 9 · ready_1_year 8 · ready_3_years 5 · development_needed 3. Tre valori fuori CHECK → mapping deterministico proposto: `ready_now→READY_NOW`, `ready_1_year→READY_1_YEAR`, `ready_2_years→READY_2_YEARS`, `ready_3_years|ready_3_5_years|ready_3_plus_years→NOT_READY`, `development_needed→NOT_READY` — valore originale preservato in `successor_candidate_metadata.legacy_readiness` (+ strengths/development_needs/rank_order in metadata).

### 3.2 Opzioni

| Opzione | Contenuto | Righe | Effort | Rischio |
|---|---|---|---|---|
| A — RTL-only linked | 30 candidati sui 10 pool RTL; gli 86 unlinked (critical_role_id NULL, nessun altro aggancio possibile: pool_id NOT NULL) dichiarati residuo terminale nel registry | 30 | ~1.5–2h (incl. pools) | BASSO |
| **B — tutti i linked risolvibili (raccomandata)** | A + i candidati HS i cui employee esistono in advanced (incl. 1 DEACTIVATED — FK ok, status candidato `CANDIDATE`) | ~30–34 | +0.5h | BASSO |
| C — pool sintetico per gli 86 unlinked | impossibile senza position (NOT NULL) → schema change/ADR | — | — | SCONSIGLIATO (stesso muro di 2-C) |

**Nota collaterale registry:** popolare `sys_successor_candidates` fa decadere il ramo "cascade parent=0" della rationale TERMINAL di `sys_successor_readiness` (mig 000076); il verdetto NO_SOURCE resta valido per il ramo "nessuno score numerico legacy" → aggiornare solo la rationale, non lo status.

---

## 4. Sintesi esecutiva — decisioni richieste a Enzo (5 minuti)

| # | Decisione | Opzioni | Raccomandazione |
|---|---|---|---|
| D1 | sys_branches: quante sedi | A=3 · **B=6** · C=13+ | **B** (regola àncora-OU deterministica) |
| D2 | sys_succession_pools: conferma cascata + picklist | A=7-8 auto · **B=10-11 con picklist** · C=schema change | **B** (2–3 scelte manuali: Branch Director Milano, Head of Corporate Banking, conferma CFO→Finance Director) |
| D3 | sys_successor_candidates: scope + mapping readiness | A=30 RTL · **B=~34 RTL+HS** · C=ADR | **B** + mapping readiness §3.1 (sign-off tabella) |

**Effort totale stimato (D1=B, D2=B, D3=B): ~5–7h in 1 sessione** — seed/migration idempotente stile `db/seeds/rtl-rebuild/` con id deterministici `uuid_generate_v5` (lezione mig 000096), update registry (chiusura DEFER→POPULATED + residui terminali annotati), `pnpm db:validate` + suite vitest verde. Regression risk: **BASSO** (tabelle oggi vuote, nessun endpoint le serve ancora con dati, import additivo, 0 violazioni UNIQUE misurate). Token budget esecuzione: medio (~1 sessione dedicata o coda di una sessione batch).

File rilevanti: `D:\heuresys-advanced\db\migrations\000076_b50_residual_wall_terminal_annotation.sql` (annotazione muri S972), `D:\heuresys-advanced\db\migrations\000009_organization_model.sql` (sys_branches), `D:\heuresys-advanced\db\migrations\000018_career_succession_model.sql` (pools/candidates), `D:\heuresys-advanced\db\seeds\rtl-rebuild\` (pattern import).
