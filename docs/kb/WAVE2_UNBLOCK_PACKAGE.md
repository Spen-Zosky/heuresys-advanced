# Brownfield Wave-2 unblock-package — source discovery (S981)

**Metodo**: sole letture. Advanced = `heuresys_advanced` via tunnel :5433; legacy = `heuresys_platform` su VM via `ssh oracle-vm-default sudo -u postgres psql`. Dottrina I14 rispettata (persona = `employees`, crosswalk `LEGACY_EMP::<employees.id>`). Tutte le cifre sotto sono misurate, non stimate. Data: 2026-06-10.

---

## 1. Registry: perimetro e tabelle target

```sql
SELECT resolved_status, count(*) FROM sys.v_reconciliation_status GROUP BY 1;
```
```
POPULATED|138  NO_SOURCE|21  EXCLUDE|8  NEEDS_DECISION|3  REFERENCE_ONLY|2   (tot 172)
```
Copertura registry verificata: 173 tabelle `sys.sys_*` fisiche, 172 nel registry — l'unica esclusa è `sys_reconciliation_registry` stessa (meta-tabella, auto-esclusione corretta).

**Tabelle a 0 righe NON terminali** (`has_rows=false AND resolved_status NOT IN ('NO_SOURCE','EXCLUDE','REFERENCE_ONLY')`) — sono **solo 3**, tutte `NEEDS_DECISION` bucket B, conteggio live ri-verificato = 0 per tutte:

| Tabella | Stato registry | Wall dichiarato | Legacy source dichiarata |
|---|---|---|---|
| `sys_branches` | NEEDS_DECISION (DEFER S972) | location_to_org_unit_bridge | `public.locations` (34) |
| `sys_succession_pools` | NEEDS_DECISION (DEFER S970/S972) | job_to_position_bridge | `talent_pools` (24) + `succession_plans` (31) + `critical_roles` (16) |
| `sys_successor_candidates` | NEEDS_DECISION (DEFER S970/S972) | job_to_position_bridge (cascade su pools) | `succession_candidates` (206) + `talent_pool_members` (40) |

Nessuna tabella POPULATED ha 0 righe: il perimetro Wave-2 sulle tabelle vuote è interamente questo trio. I 21 NO_SOURCE restano terminali.

## 2. Source-discovery legacy (conteggi misurati)

`information_schema.tables` legacy, keyword `succession|talent|career|location|critical|pool` → 21 tabelle. Conteggi:

| Tabella legacy | Righe tot | di cui tenant RTL Bank (`0c54b84a…`) |
|---|---|---|
| `locations` | 34 | — (10 di tipo branch, da registry S972) |
| `succession_plans` | 31 | 10 |
| `succession_candidates` | 206 | 116 (88 employee distinti) |
| `critical_roles` | 16 | 8 |
| `talent_pools` | 24 | 8 (pool_type: 8 valori tutti diversi, 1×succession) |
| `talent_pool_members` | 40 | 40 (tutti RTL, 40 employee distinti) |
| `org_units` | 76 | — (default_location_id 47/76, 13 location distinte) |
| cluster `career_*` (10 tabelle) | 32+75+100+16+85+128+40+60+216+50+158+192+20+1106 | non misurato per-tenant (vedi §4: irrilevante, FK job 100% NULL e nessun target advanced) |

Tenant legacy mappati: `0c54b84a…`=RTL Bank, `d5855519…`=Heuresys System (entrambi esistono ACTIVE nell'advanced), `fb1e866c…`=EcoNova, `1d7bf448…`=SmartFood (non esistono nell'advanced → fuori scope import).

## 3. Il muro position_id — misure complete

### 3a. Colonne dirette: muro TOTALE (100% NULL)
```sql
SELECT count(position_id), count(*) FROM succession_plans;  -- e analoghe
```
| Colonna legacy | not-null / tot | FK target |
|---|---|---|
| `succession_plans.position_id` | **0/31** | — |
| `career_path_levels.target_job_id` | 0/75 | `tenant_jobs` |
| `career_simulations.target_job_id` | 0/20 | `tenant_jobs` |
| `career_goals.target_job_family_id` | 0/60 | — |
| `career_path_templates.from/to_job_family_id` | 0/16 + 0/16 | — |
| `career_profiles.current_job_family_id` | 0/158 | — |
| `talent_pools` | nessuna colonna position/job | — |

Conferma S970: nessuna colonna position/job utilizzabile è popolata in legacy. Il bridge **non può** venire dai dati job legacy.

### 3b. SCOPERTA — false friend `critical_role_id`
```sql
SELECT count(*) FROM succession_candidates sc JOIN critical_roles cr ON cr.id=sc.critical_role_id WHERE sc.tenant_id='<RTL>';        -- 0
SELECT count(*) FROM succession_candidates sc JOIN succession_plans sp ON sp.id=sc.critical_role_id WHERE sc.tenant_id='<RTL>';     -- 30
SELECT count(*) FROM succession_candidates sc JOIN succession_plans sp ON sp.id=sc.critical_role_id;                                -- 120 (su 120 not-null globali)
```
**`succession_candidates.critical_role_id` NON punta a `critical_roles` (0 match, 30/30 dangling) ma a `succession_plans.id` (30/30 RTL, 120/120 globale).** È un column-name false friend, stesso pattern del `sys_users`↔`users` di I14. Il registry S972 ("legacy succession_candidates has no pool_id column") va corretto: l'anchor piano→candidato ESISTE.

### 3c. SCOPERTA — l'ancora incumbent è risolvibile al 100% (RTL)
Legacy: `succession_plans.incumbent_employee_id` 10/31 not-null (RTL: **6/10**); `critical_roles.current_incumbent_id` RTL: **8/8**. Test sui 14 incumbent RTL contro l'advanced:
```sql
-- join su sys_users.user_external_code='LEGACY_EMP::<id>' + sys_user_position_assignments status='ACTIVE'
CR: resolved 8/8, con assignment attivo 8/8
SP: resolved 6/6, con assignment attivo 6/6
distinct position_id sui 14 anchor: 14/14 (zero collisioni)
```
Nota: `v_active_primary_assignment_per_user` è una view di **controllo anomalie** (0 righe = 0 violazioni), non l'elenco — misura fatta sulla tabella base (160 assignment, tutti PRIMARY/ACTIVE).

**Regola deterministica disponibile**: `pool.position_id = posizione PRIMARY/ACTIVE dell'incumbent` → 14 pool RTL con position certa, univoca, misurata.

### 3d. Name-match: fallito (non percorribile)
`succession_plans.position_name` è 31/31 popolato, ma vs `sys_positions.position_title` (162 posizioni, tutte con job_role su 227 `sys_job_roles`): **0/18 match esatti** (lower); partial ILIKE ambiguo (CEO→2 hit, CTO→7 hit, tutti gli altri→0). Non deterministico → solo PM.

### 3e. Heuresys System (secondo tenant ACTIVE)
3/3 piani HS hanno incumbent e 6/6 candidati HS sono anchorable, ma solo **1/3 incumbent risolve** nell'advanced (con posizione attiva, 1 distinct). Slice marginale: 1 pool + ≤6 candidati, da rifinire in esecuzione.

### 3f. `sys_branches` (muro separato, confermato)
`org_units.default_location_id`: 47/76 not-null su **13 location distinte** (3-15 OU per location) — cardinalità INVERSA rispetto al vincolo `branch_organization_unit_id NOT NULL UNIQUE`. Nessuna regola deterministica. Confermato il registry: serve bridge PM (pairing 1:1 location↔OU, ~10 righe per le location branch-type) oppure ADR di rilassamento vincolo.

## 4. Risolvibilità crosswalk persone (I14)

Formato verificato nell'advanced: `user_external_code = 'LEGACY_EMP::<uuid>'`, 160/161 utenti (l'escluso è il platform admin).

| Popolazione legacy (RTL) | Risolti in `sys_users` |
|---|---|
| 88 employee distinti di `succession_candidates` | **88/88 (100%)** |
| 40 employee di `talent_pool_members` | **40/40 (100%)** |
| 14 incumbent (6 SP + 8 CR) | **14/14, tutti con posizione attiva** |

Cascata candidati RTL: dei 116, **30 hanno il link al piano** (18 → 6 piani CON incumbent = full-cascade-ready; 12 → 4 piani senza incumbent); **86 sono senza anchor** (NULL) — terminali salvo invenzione PM.

Mapping valori (CHECK advanced verificati): `succession_pool_status ∈ {ACTIVE,ARCHIVED,PROPOSED}` (legacy tutti `active` → ACTIVE); `readiness_level ∈ {READY_NOW,READY_6_MONTHS,READY_1_YEAR,READY_2_YEARS,NOT_READY, NULL}` — legacy `ready_now/ready_1_year/ready_2_years` mappano 1:1; `ready_3*` (3 varianti) e `development_needed` non hanno bucket esatto → colonna nullable: NULL + raw value in `successor_candidate_metadata` (decisione tecnica CLASSE A, lossless); `status` → default `CANDIDATE`.

## 5. Stima per cluster

| Cluster | Righe importabili | Dipendenze (FK cascade) | Effort | Rischio |
|---|---|---|---|---|
| **A. Succession core** (pools+candidates via incumbent-anchor) | 14 pool RTL (+1 HS) + 18 candidati RTL (+≤6 HS) | sys_users (risolti 100%), sys_positions (anchor 14/14), tenant map via seed | ~2-4h CLI: seed idempotente pattern RTL-rebuild, id `uuid_generate_v5` (bit S978), test integrazione | **BASSO**: insert-only su tabelle vuote, CHECK noti, crosswalk 100%; gate = 1 sì/no PM |
| **B. Branches** | 10 (location branch-type; fino a 34 se si importano tutte) | sys_organization_units (26 OU) — vincolo NOT NULL+UNIQUE | bridge PM ~10 righe CSV, poi 1-2h seed | BASSO post-bridge; senza bridge: impossibile (cardinalità inversa misurata) |
| **C. Talent pools+members** | 8 pool + 40 membri (employee 40/40 risolti) | `succession_pool_position_id NOT NULL` — talent_pools NON ha semantica position | 2-3h post-ADR (es. position nullable o asse pool_kind) | **MEDIO**: richiede ADR schema (invariante), non solo dati |
| **D. Career cluster** (~2.300 righe legacy) | 0 | nessun target advanced (non nel trio; registry terminale) + FK job 100% NULL | — | fuori scope Wave-2 |
| **E. Residuo candidates** (86 senza anchor + 12 su piani senza incumbent + 4 piani senza incumbent) | 0 deterministici | name-match fallito (0 exact, partial ambiguo) | solo con bridge PM name→position | — |

## 6. Conclusioni

**(a) Importabile SENZA decisioni PM**: in senso stretto, **niente** — perché la regola incumbent-anchor è esattamente la decisione che Enzo ha messo in DEFER a S970/S972 ("needs PM semantic authority"). MA la discovery cambia il quadro: la decisione si è ridotta da "authorare un bridge job→position che non esiste" a **un singolo sì/no su una regola deterministica ora misurata al 100%** (14/14 incumbent → 14 posizioni distinte attive, zero ambiguità, zero data-entry). Con quel sì: 14 pool + 18 candidati RTL full-cascade (più slice HS 1+≤6). In più, la scoperta del false friend (`critical_role_id`→`succession_plans.id`) sblocca la cascata candidati che il registry S972 riteneva inesistente — il registry va aggiornato comunque.

**(b) Richiede bridge PM vero (data/semantica che non esiste nei dati)**:
1. `sys_branches`: pairing 1:1 location↔org_unit (~10 righe) o ADR rilassamento UNIQUE/NOT NULL;
2. i 4 piani RTL senza incumbent (CEO, CFO, Head of Corporate Banking, Branch Director Milano) → name-match ambiguo, il PM sceglie la posizione o li salta (+4 pool, +12 candidati);
3. `talent_pools` (8) + membri (40): nessuna semantica position → ADR (position nullable / pool_kind) oppure WON'T-DO;
4. gli 86 candidati senza anchor: terminali salvo decisione PM.

**(c) Sequenza raccomandata**:
1. **Decisione PM #1** (sì/no, questo dossier è l'evidenza): adottare incumbent-anchor → esegui Cluster A (~2-4h, rischio basso, idempotente) + correzione registry (false friend + stato post-import).
2. **Decisione PM #2** (CSV 10 righe): bridge location↔OU → Cluster B (1-2h).
3. **Decisione PM #3** (ADR): destino talent_pools → Cluster C o WON'T-DO esplicito nel registry.
4. Career cluster e gli 86 candidati orfani: dichiarare formalmente fuori scope Wave-2 nel registry (evita ri-discovery future).

Raccomandazione: il pacchetto massimo eseguibile dopo la sola Decisione #1 è 14-15 pool + 18-24 candidati = le 2 tabelle su 3 escono dallo stato 0-righe con dati reali full-cascade; `sys_branches` resta l'unico vero bridge-dipendente.
