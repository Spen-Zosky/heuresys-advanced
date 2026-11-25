# Storia36 — Task C: shape esatte e range dati per i check G2–G4

Rilevazione live su `heuresys_advanced` (tunnel :5433), 2026-07-27, accesso in sola lettura.
G2 = nessun evento per-utente prima della hire_date · G3 = parita' busta paga ↔ presenze per mese · G4 = sequenzialita' created<resolved, start<=end.

---

## 1. Data di assunzione (ancora per G2)

**Unica colonna `%hire%` in `sys.*`**: `sys.sys_user_employment.user_employment_hire_date` (`date`, NULLABLE).

Shape rilevante di `sys.sys_user_employment` (28 colonne):
- PK `user_employment_id` uuid; **UNIQUE `user_employment_user_id`** (`sys_user_employment_user_uq`) → esattamente 1 riga employment per utente.
- FK: user → `sys_users(user_id)` ON DELETE CASCADE; tenant → `sys_tenancies` RESTRICT.
- Date disponibili: `hire_date`, `seniority_date`, `probation_end_date`, `contract_end_date`, `termination_date` (tutte `date`, nullable).
- Retribuzione: `user_employment_salary numeric(15,2)`, `pay_scale_level varchar(32)` (contiene i livelli CCNL: 3A1L..3A4L, QD3, QD4, Dirigente — sincronizzato dal seed S1028 con `sys_user_contracts`), `pay_periods_per_year smallint`, `work_schedule_pct`.
- CHECK: solo `user_employment_status IN ('ACTIVE','SUSPENDED','TERMINATED')`. **Nessun CHECK di ordinamento tra le date** (hire<=termination non e' enforced).

Misure: **161 righe / 161 utenti distinti; min hire = 2003-03-16, max hire = 2024-12-15**. Nessuna hire NULL implicata dal conteggio (161 = tutte le righe hanno hire valorizzata: min/max su 161 rows).

## 2. `sys.sys_attendance`

### Shape
- PK `attendance_id`; **UNIQUE business (tenant_id, subject_user_id, date)** → max 1 riga per utente/giorno.
- Colonne ore: `attendance_hours_regular / _overtime / _night / _holiday` numeric(5,2) NOT NULL default 0; **`attendance_hours_total` GENERATED ALWAYS AS (somma delle 4) STORED**.
- Orologio: `clock_in/clock_out/break_start/break_end` `time` (senza tz), nullable.
- `attendance_status varchar(32)` CHECK ∈ {PRESENT, ABSENT, SICK, HOLIDAY, VACATION, PAID_LEAVE, UNPAID_LEAVE, TRAINING, REMOTE, BUSINESS_TRIP} (default PRESENT).
- `attendance_source varchar(32)` CHECK ∈ {MANUAL, BADGE, MOBILE_APP, BIOMETRIC, IMPORT, SYSTEM, API} (default MANUAL).
- Validazione: `is_validated bool` + CHECK coerenza (se true → validated_by + validated_at NOT NULL).
- CHECK G4-friendly gia' nel DB: `clock_out >= clock_in`, `break_end >= break_start`, ore non negative, `updated_at >= created_at`.
- FK subject_user → sys_users RESTRICT; `attendance_natural_key varchar(512)` UNIQUE per tenant.

### Misure
- **3.180 righe · 157 utenti distinti · min 2024-10-01 · max 2025-12-08.**
- **Weekend: 0 righe** con data sabato/domenica (extract(dow) IN (0,6) → 0).
- **Straordinario: 2.429 righe con `hours_overtime > 0`** (valori campione: 1.00 su giornata 9h).
- **Night: 0 righe con `hours_night > 0`** (la colonna esiste ma e' sempre 0 — il NIGHT vive solo in `sys_overtime`, 3 righe).
- Distribuzione mensile: 2024-10 → 2025-10 = **1 solo utente** (15–22 righe/mese, serie storica singola); **2025-11 = 2.041 righe / 157 utenti; 2025-12 = 902 righe / 157 utenti (fino all'8/12)**. Il grosso del dataset e' quindi concentrato su 2 mesi.
- Campione (15 righe recenti): tutti `source=IMPORT`, `is_validated=false`, clock 09:00–18:00 (o 08:45–17:45), reg 8–9h, ot 0–1h, status PRESENT/REMOTE, break NULL.

## 3. Buste paga — `sys.sys_user_pay_slips`

### Shape
- PK `user_pay_slip_id`; FK user (CASCADE) + tenant (RESTRICT). **Nessuna UNIQUE business (user, period)** — i duplicati per periodo non sono impediti dal DB.
- **Periodo rappresentato in 3 colonne**: `user_pay_slip_period varchar(64)` (testo libero) + `user_pay_slip_period_start date` + `user_pay_slip_period_end date`. Piu' `user_pay_slip_payment_date date`.
- Importi: `gross_pay/net_pay numeric(15,2)`, `deductions jsonb`.
- `user_pay_slip_status` CHECK ∈ {available, issued, paid, draft, cancelled} **oppure NULL** (minuscolo! unico caso nel giro di tabelle esaminate).

### Misure
- **471 righe · 157 utenti · period_start min 2025-09-01 · period_end max 2026-06-30 · payment_date 2025-09-28 → 2026-06-27.**
- **Formato periodo INCONSISTENTE**: 468 righe `'YYYY-MM'` (ISO: 2026-04, 2026-05, 2026-06 × 156 utenti ciascuno) + **3 righe testuali** (`'September 2025'`, `'October 2025'`, `'November 2025'` — 1 utente, lo stesso della serie storica attendance singola).
- Status: paid = 468, available = 3.
- Per mese recente: **2026-04 / 2026-05 / 2026-06 = 156 slips / 156 utenti ciascuno**.

### ⚠ Implicazione per G3
**I mesi payslip di massa (2026-04..06) NON si sovrappongono ai mesi attendance di massa (2025-11..12).** Oggi non esiste NESSUN mese con entrambe le popolazioni piene: la parita' busta↔presenze per mese e' verificabile solo sull'utente singolo (slips Sep–Nov 2025 vs attendance che pero' si ferma a 2025-10 per lui). Il check G3 richiede prima il backfill (attendance 2026-01..06 oppure payslips 2025-11/12) — G3 va scritto per confrontare `to_char(attendance_date,'YYYY-MM') = user_pay_slip_period` (normalizzando le 3 righe testuali o usando `period_start` troncato al mese, scelta piu' robusta: **usare `date_trunc('month', user_pay_slip_period_start)`**, che e' popolato e tipato per tutte le 471 righe).

## 4. Time-off

### `sys.sys_time_off_requests` (69 righe · 53 utenti · 2025-12-03 → 2026-06-14)
- CHECK: **`request_end_date >= request_start_date`** (`sys_tor_dates_ordered`) — G4 gia' enforced qui; `days_requested > 0`; `updated_at >= created_at`.
- `request_leave_type` CHECK ∈ {VACATION, SICK, PERSONAL, MATERNITY, PATERNITY, BEREAVEMENT, STUDY, SABBATICAL, UNPAID, OTHER}.
- `request_status` CHECK ∈ {PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED}. Stato attuale: **APPROVED 59 · PENDING 10** (nessun REJECTED/CANCELLED/EXPIRED).
- Campi flusso: `approver_user_id` + `approved_at timestamptz` (nessun CHECK `approved_at >= created_at` — da coprire in G4), cancellazione (requested/reason/at/by), certificato medico (required/uploaded), `half_day_start/end`.
- `natural_key varchar(512)` UNIQUE per tenant.

### `sys.sys_time_off_balances` (494 righe · 158 utenti · anni 2025–2026)
- **UNIQUE (tenant, user, leave_type, year)**; `balance_year int` CHECK 2000..2100, default anno corrente.
- Giorni: total/used/pending/carryover/accrued/adjustment numeric(5,2) CHECK non-negativi (tranne adjustment); `carryover_expires_at date`.

### `sys.sys_leave_accrual_rules` (20 righe)
- Shape: `leave_type` (stesso CHECK 10 valori), `method` CHECK ∈ {MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL, PER_PAY_PERIOD, LUMP_SUM}, `amount >= 0`, `max_accrual`, carryover (allow/max_days/expiry_months), `min_tenure_months`, `prorated_first_year`, **`accrual_rule_ccnl_type varchar(100)`**, `is_ccnl_default`, `is_active`, soft-delete `deleted_at`.
- Contenuto: 5 policy (annual/VACATION 1.67 mensile, sick/SICK 1.00, personal 0.50, bereavement 0.50, parental/OTHER 0.50) **duplicate ×4** (stesse nature, presumibilmente per tenant/scope diversi — 20 righe totali). ⚠ Tutte marcate **`CCNL Commercio`** mentre 159/160 contratti utente sono **CCNL Credito 2024** — incoerenza di dominio da tenere presente.

### `sys.sys_leave_balance_transactions` (20 righe, tutte create 2025-12-12 17:54:34)
- Append-only (solo `created_at`, niente updated_at). `transaction_type` CHECK ∈ {ACCRUAL, USAGE, ADJUSTMENT, CARRYOVER, EXPIRY, RESET, TRANSFER}; FK balance CASCADE; `reference_type/reference_id` per link polimorfo; `days_amount numeric(5,2)` senza CHECK di segno.

## 5. Goals (aggancio backfill C2)

- **`sys.sys_goals`: 1.067 righe** · `goal_start_date` 2025-01-01 → 2026-09-03 · `goal_due_date` 2025-03-31 → 2026-12-02 · `created_at` 2025-06-05 → 2026-04-11. (created_at puo' precedere o seguire start_date — il backfill storico e' gia' la prassi qui.)
- **`sys.sys_goal_check_ins`: 1.000 righe** · `check_in_date` (date) 2026-01-02 → 2026-05-06 · `created_at` 2026-02-28 → 2026-05-13. Colonne: goal_id, subject_user_id, natural_key, previous/new_progress int, status_update, notes/blockers/next_steps, confidence_level int, solo `created_at` (append-only).
- Innesto C2: la finestra naturale per nuovi check-in retrodatati e' 2025-H2/2026-H1 dentro [goal_start_date, goal_due_date] del goal padre.

## 6. Approvals (VUOTE — 0 righe entrambe)

### `sys.sys_approval_requests`
- Colonne G4: `created_at` (default now) → **`approval_request_resolved_at`** → **`approval_request_applied_at`** (entrambe timestamptz nullable). **NESSUN CHECK di ordinamento** created < resolved < applied — G4 e' interamente un check dati, il DB non lo garantisce.
- `status` CHECK ∈ {PENDING, APPROVED, REJECTED, APPLIED}; `decision_policy` CHECK ∈ {ALL_OF, ANY_OF}; `priority` CHECK ∈ {INFO, MEDIUM, HIGH, CRITICAL}; `sla_hours int > 0` o NULL; `updated_at >= created_at` (unico CHECK temporale).
- `resource_type varchar(64)` + `resource_id uuid` (link polimorfo, indicizzato dove not null); FK tenant CASCADE, created_by SET NULL.

### `sys.sys_approval_steps`
- Colonne G4: `created_at` → **`approval_step_decided_at`** (nullable) + `decided_by`; `due_at`, `escalated_at`, `reminder_count`.
- `status` CHECK ∈ {PENDING, APPROVED, REJECTED, SKIPPED}; `level_policy` NULL o {ALL_OF, ANY_OF}; `ordinal int default 1`.
- **UNIQUE (request_id, approver_user_id)** — un approver una sola volta per request. FK request CASCADE, approver CASCADE (⚠ cancellare un utente cancella i suoi step).
- Anche qui nessun CHECK `decided_at >= created_at`.

## 7. Assignments / contratti

### `sys.sys_user_position_assignments` (167 righe · 162 utenti · start 2005-09-13 → 2026-07-23 · 6 con end_date)
- **CHECK `end_date IS NULL OR end_date >= start_date`** (`sys_upa_dates_ordered_check`) — G4 gia' enforced.
- `kind` CHECK ∈ {PRIMARY, SECONDARY, INTERIM, ACTING}; `status` CHECK ∈ {ACTIVE, ENDED, PROPOSED, CANCELLED}; `fte` numeric(4,3) CHECK 0..1.
- **UNIQUE parziale: 1 solo assignment PRIMARY ACTIVE per utente** (`sys_upa_one_primary_active_per_user`).

### `sys.sys_user_contracts` (160 righe · 160 utenti · start 2003-03-16 → 2024-12-15 · 61 con end_date)
- Date: `start_date`, `end_date`, `probation_end_date`, `termination_date` — **NESSUN CHECK di ordinamento** (a differenza di UPA) → G4 deve coprire `end >= start` qui.
- **`user_contract_ccnl_type varchar(64)` + `user_contract_ccnl_level varchar(64)`** ← e' QUI che vive l'inquadramento CCNL usato dalla regola di esenzione S1028.
- Distribuzione livelli: 3A4L 49 · 3A3L 47 · 3A1L 22 · **QD3 18 · QD4 5 · Dirigente 9** (CCNL Credito 2024) + **Dirigente 1 · Quadro 1** (CCNL Commercio) → **34 utenti esenti totali**.
- Altre colonne: gross_annual_salary, salary_type, payment_frequency, work_hours_weekly, schedule_type, part_time_pct, job_title, status CHECK ∈ {ACTIVE, EXPIRED, TERMINATED}.
- Nota: le date contratto rispecchiano le hire date (stesso min/max di `user_employment_hire_date`).

### `sys.sys_overtime` (contesto: 178 righe · 111 utenti · 2025-09-14 → 2025-12-12)
- `overtime_type`: WEEKDAY 97 · WEEKEND 44 · HOLIDAY 34 · **NIGHT 3** (i 3 NIGHT superstiti sono IT operativo, post-fix S1028).
- ⚠ Esistono 44 overtime WEEKEND + 34 HOLIDAY ma **0 righe attendance su sabato/domenica** → gli straordinari weekend non hanno la presenza corrispondente (incoerenza per un eventuale check di parita' attendance↔overtime).

## 8. Regola di esenzione S1028 (file: `db/seeds/rtl-banking-skills/seed_residual_user_coherence.sql`, sezioni C1–C3 + post-condition F6)

**Fonte inquadramento**: `sys.sys_user_contracts.user_contract_ccnl_level` (join su `user_contract_user_id = <subject_user_id>`).

**Espressione SQL testuale degli ESENTI da straordinario retribuito** (CCNL Credito quadri direttivi; CCNL Commercio dirigenti/quadri) — usata identica in C1 (purge sys_overtime con archivio `audit.overtime_exempt_archive`), C2 (azzeramento `attendance_hours_overtime`) e F6a/F6b (invarianti fail-loud):

```sql
JOIN sys.sys_user_contracts c ON c.user_contract_user_id = <t>.<subject_user_id>
WHERE (c.user_contract_ccnl_level LIKE 'QD%'
       OR c.user_contract_ccnl_level IN ('Dirigente','Quadro'))
```

**Regola NIGHT / IT-ops** (C3 + F6c): il tipo `NIGHT` in `sys_overtime` e' plausibile SOLO per l'IT operativo, identificato via assignment PRIMARY ACTIVE sulla posizione:

```sql
JOIN sys.sys_user_position_assignments a
     ON a.user_position_assignment_user_id = o.overtime_subject_user_id
    AND a.user_position_assignment_kind = 'PRIMARY'
    AND a.user_position_assignment_status = 'ACTIVE'
JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
WHERE p.position_title IN ('Software Developer','System Administrator')
```

Gli altri NIGHT sono stati riclassificati `WEEKDAY` (con marker in `overtime_metadata.coherence_fix`). Le post-condition F6a/b/c sono invarianti permanenti: 0 righe overtime per esenti, 0 attendance con `hours_overtime > 0` per esenti, 0 NIGHT su ruoli non-IT. **Qualunque backfill storia36 deve rispettarle** (34 utenti esenti; per loro niente overtime né in `sys_overtime` né in `attendance_hours_overtime`).

## 9. Baseline G2 misurata OGGI (violazioni pre-hire correnti)

| Evento | Righe con data < hire_date |
|---|---|
| `sys_attendance.attendance_date` | **0** |
| `sys_time_off_requests.request_start_date` | **0** |
| `sys_user_pay_slips.user_pay_slip_period_start` | **0** |
| `sys_overtime.overtime_date` | **0** |

Baseline pulita: il check G2 parte verde; ogni backfill deve mantenerlo (min hire 2003-03-16 → nessun rischio pratico per eventi 2024+, ma il check resta il guard-rail).

## 10. Riepilogo range misurati

| Tabella | Colonna | Min | Max |
|---|---|---|---|
| sys_user_employment | user_employment_hire_date | 2003-03-16 | 2024-12-15 |
| sys_attendance | attendance_date | 2024-10-01 | 2025-12-08 |
| sys_user_pay_slips | user_pay_slip_period_start | 2025-09-01 | 2026-06-01 |
| sys_user_pay_slips | user_pay_slip_payment_date | 2025-09-28 | 2026-06-27 |
| sys_time_off_requests | request_start_date → request_end_date | 2025-12-03 | 2026-06-14 |
| sys_overtime | overtime_date | 2025-09-14 | 2025-12-12 |
| sys_goals | goal_start_date | 2025-01-01 | 2026-09-03 |
| sys_goals | goal_due_date | 2025-03-31 | 2026-12-02 |
| sys_goal_check_ins | check_in_date | 2026-01-02 | 2026-05-06 |
| sys_user_position_assignments | user_position_assignment_start_date | 2005-09-13 | 2026-07-23 |
| sys_user_contracts | user_contract_start_date | 2003-03-16 | 2024-12-15 |

## Sorprese / punti d'attenzione per G2–G4

1. **G3 oggi non e' verificabile su scala**: mesi payslip di massa (2026-04..06, 156 utenti) e mesi attendance di massa (2025-11..12, 157 utenti) sono DISGIUNTI. Serve backfill di uno dei due lati prima che la parita' abbia un mese in comune.
2. **`user_pay_slip_period` ha 2 formati** ('YYYY-MM' × 468, 'Month YYYY' × 3): per G3 ancorarsi a `period_start` (date, sempre popolata), non alla varchar.
3. **Nessuna UNIQUE (user, period)** su pay_slips: G3 deve anche contare i duplicati per (utente, mese).
4. **Approvals**: nessun CHECK DB su created < resolved/applied/decided — G4 e' interamente data-quality; tabelle vuote, quindi qualunque seed definisce la baseline.
5. **`sys_user_contracts` senza CHECK end>=start** (a differenza di UPA e time-off che lo hanno): G4 deve coprirlo via query.
6. **attendance_hours_night sempre 0** su 3.180 righe; il NIGHT esiste solo in `sys_overtime` (3 righe IT). Un backfill attendance con night>0 per non-IT violerebbe lo spirito (non la lettera) di F6c.
7. **0 righe attendance weekend** ma 44+34 overtime WEEKEND/HOLIDAY: parita' attendance↔overtime non allineata sul weekend.
8. **Accrual rules marcate 'CCNL Commercio'** mentre 159/160 contratti sono 'CCNL Credito 2024'; 5 policy duplicate ×4 (20 righe).
9. **161 utenti con employment vs 157 con attendance**: 4 utenti senza presenze (insieme non necessariamente = esenti QD/Dirigente, che sono 34 e HANNO presenze con ot=0).
10. `attendance_hours_total` e' GENERATED: mai scriverla nei backfill.
