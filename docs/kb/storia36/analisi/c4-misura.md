# C4 — MISURA cluster formazione (storia36)

Misura read-only eseguita 2026-07-28 su `heuresys_advanced` via tunnel :5433.
Tenant RTL = `86ba7a65-217f-48ba-8ce5-5c09b40a66b0` (158 utenti, tutti `ACTIVE`).
Finestra storia36: 2023-08-01 .. 2026-07-26.

---

## 1. sys_training_initiatives — VUOTA (0 righe): shape completa

| colonna | tipo | nullable | default |
|---|---|---|---|
| training_initiative_id | uuid | NOT NULL | gen_random_uuid() |
| training_initiative_tenant_id | uuid | NOT NULL | — (FK sys_tenancies ON DELETE CASCADE) |
| training_initiative_module_id | uuid | NOT NULL | — (FK sys_learning_modules ON DELETE RESTRICT) |
| training_initiative_code | varchar(128) | NOT NULL | — |
| training_initiative_cohort_name | varchar(255) | NULL | — |
| training_initiative_start_date | date | NOT NULL | — |
| training_initiative_end_date | date | NULL | — |
| training_initiative_facilitator_user_id | uuid | NULL | FK sys_users SET NULL |
| training_initiative_status | varchar(32) | NOT NULL | 'PLANNED' |
| training_initiative_capacity | integer | NULL | — |
| training_initiative_metadata | jsonb | NOT NULL | '{}' |
| created_at/by, updated_at/by | timestamptz/uuid | | trigger sys_set_updated_at |

- **CHECK status**: `PLANNED | OPEN | IN_PROGRESS | COMPLETED | CANCELLED`
- **UNIQUE (natural key)**: `(training_initiative_tenant_id, training_initiative_code)`
- **Vincolo strutturale**: ogni iniziativa aggancia **UN solo modulo** (module_id NOT NULL, RESTRICT). Un'iniziativa multi-modulo non è rappresentabile: servono N iniziative o un modulo "contenitore".
- Referenced by: `sys_user_learning_assignments.user_learning_assignment_initiative_id` (SET NULL).
- Conteggio: **0 righe** (nessun filtro tenant necessario).

## 2. Catalogo: moduli, path, steps, mapping skill→formazione

### sys_learning_modules — 987 righe
- UNIQUE: `(COALESCE(tenant_id, uuid-zero), learning_module_code)` → natural key = codice per tenant, con NULL = catalogo condiviso.
- CHECK kind: `COURSE|MICRO_LESSON|LAB|WORKSHOP|CERTIFICATION_PREP|COACHING`; CHECK delivery: `SELF_PACED|INSTRUCTOR_LED|BLENDED|ON_THE_JOB`.
- **Realtà misurata: tutti i 987 sono `COURSE` + `SELF_PACED`** (durate 15..3600 min). **Zero INSTRUCTOR_LED/WORKSHOP: la formazione d'aula NON esiste nel catalogo** — C4 dovrà crearne o riqualificare.
- Scope: RTL 564 · tenant NULL 423 (di cui `is_global=true` solo 142; **281 con tenant NULL ma is_global=false — incoerenza flag**).
- Tre ondate di creazione: 2025-12-03 → 845 (import legacy) · 2026-06-03 → 127 · **2026-07-22 → 15 `BANK-LM-*`** (`metadata.seeded_by = "banking-learning-catalog-v1"`) — è questo il "catalogo 15 moduli" (nota: creato 2026-07-22, coerente con S1025). I BANK-LM sono tenant NULL + is_global=true, titoli italiani bancari (AML, MiFID, Basilea, credito, NPL, IFRS9, ESG, cyber, tesoreria, private banking, PSD2, audit, core banking, risk, trade finance), durate 300-600 min.
- Campione: `BANK-LM-AML` "Antiriciclaggio e contrasto al finanziamento del terrorismo" 480min · `AML-102` "AML Transaction Monitoring" 720min (2026-06-03) · `ABA-TELL-001` 960min.

### sys_learning_paths — 4667 righe (rumore da import)
- UNIQUE: `(COALESCE(tenant_id, uuid-zero), learning_path_code)`.
- Scope: RTL 3219 · tenant NULL 1448. 3294 codici distinti: **1373 codici duplicati ×2** (doppione RTL+global).
- **Molte path spazzatura**: code e name = `OLDDB::course_enrollments::<uuid>` (una path per enrollment legacy). Creazione: 2025-12-03 (1324), 2025-12-19 (1492), 2026-02-28 (40), 2026-04-15 (1811).
- **sys_learning_path_steps: 124 righe, solo 20 path su 4667 hanno steps.** UNIQUE (path_id, ordinal).

### sys_skill_learning_mappings — 662 righe (il mapping skill→formazione ESISTE)
- 335 skill distinte → 142 moduli (esattamente i 142 `is_global=true`); **23 mappings puntano ai 15 BANK-LM**.
- UNIQUE (skill_id, module_id); CHECK target_proficiency `NOVICE..MASTER`.
- Campione: skill "Leadership" → modulo LEAD-xxx target PROFICIENT (join su sys_skills/sys_learning_modules).

### sys_position_learning_requirements — 1791 righe (mapping posizione→path)
- 158 posizioni × 38 path; UNIQUE (position_id, learning_path_id); `is_mandatory` bool default true; `deadline_rule` jsonb.

## 3. sys_user_learning_* — la mappa dei BUCHI

Tabelle reali trovate con `\dt sys.*learning*`: `sys_user_learning_assignments` + `sys_user_learning_evidence` (non esistono *_enrollments — gli enrollment legacy sono confluiti in assignments).

### sys_user_learning_assignments — 1990 righe
- Tutte RTL, **158 utenti distinti = 100% degli ACTIVE**.
- Status: COMPLETED 1525 · IN_PROGRESS 299 · ASSIGNED 166.
- **Scope: 100% path** (`initiative_id` e `module_id` SEMPRE NULL — il CHECK `sys_ula_scope_check` richiede almeno uno dei tre). **Nessun assignment è mai stato agganciato a un'iniziativa.**
- **`deadline` SEMPRE NULL**; `is_mandatory` true nei campioni; **tutte create 2026-06-03** (un solo giorno: import).
- Provenienza: `metadata.legacy.source_table = learning_path_enrollments | course_enrollments` (+ path_code, source_id).
- **NESSUNA natural key oltre la PK** (nessun UNIQUE (user, path)): l'idempotenza per C4 va costruita via metadata o convenzione (rischio doppioni).
- Campione: `IN_PROGRESS | PATH-rtl-bank-5 | OLDDB::learning_paths::c93f...` · `COMPLETED | CRS-rtl-bank-9 | Antiriciclaggio AML` · `COMPLETED | MIFID2-001 | MiFID II Compliance`.

### sys_user_learning_evidence — 1434 righe (RTL 1429, Heuresys System 5)
- FK NOT NULL su module (RESTRICT); `completed_at` timestamptz NOT NULL; `score` numeric(5,2) nullable (campioni 65-73, spesso NULL); **nessun UNIQUE** (indice user+module+completed_at DESC non unico).
- Range: **2024-02-27 .. 2026-04-15**. Provenienza: `metadata.legacy.source_table=course_enrollments`.
- **Copertura RTL per anno** (base 158 ACTIVE):

| anno | evidence | utenti | % utenti |
|---|---|---|---|
| 2023 | **0** | 0 | **0%** |
| 2024 | 17 | 17 | 10.8% |
| 2025 | 644 | 158 | 100% |
| 2026 | 768 | 158 | 100% |

- **Distribuzione mensile = i BUCHI di C4**: 2024-02..2025-08 = 1-2 evidence/mese (gocciolamento); densità reale solo da 2025-09 (24) e 2025-10..2026-04 (168-223/mese, 105-122 utenti/mese). **Buchi: (a) 2023-08-01..2024-01-31 zero assoluto; (b) 2024-02..2025-08 quasi vuoto (34 righe in 19 mesi); (c) 2026-04-16..2026-07-26 zero (~3.4 mesi finali).**

## 4. sys_user_certifications — 477 righe

- RTL 475 · altro tenant 2. **154 utenti** (97% dei 158). Expiry **sempre valorizzata** (no_expiry=0).
- issued 2016-01-13..2026-04-11 · expires 2021-01-11..2029-11-28. EXPIRED (a oggi) 52 · VALID 425.
- **Natural key UNIQUE**: `(tenant, user, name, issuer, COALESCE(issued_date,'0001-01-01'))` → **il rinnovo = nuova riga stesso nome, issued diverso** (46 coppie utente+cert con >1 riga).
- `credential_id` convenzione es. `RUI-E-<8HEX>`; metadata `{}`.
- Tipi (11) con stato scadenza:

| certificazione | issuer | righe | utenti | expired | valid |
|---|---|---|---|---|---|
| CAMS (Anti-Money Laundering Specialist) | ACAMS | 80 | 62 | 0 | 80 |
| Antiriciclaggio AML Specialist | AICOM | 75 | 67 | 0 | 75 |
| Chartered Financial Analyst (CFA) | CFA Institute | 56 | — | 0 | 56 |
| GDPR Data Protection Officer | TUV | 53 | — | 1 | 52 |
| Certificazione Interna Leadership | Internal | 51 | — | 0 | 51 |
| Sicurezza Base D.Lgs 81/08 | INAIL | 42 | — | 0 | 42 |
| Financial Risk Manager (FRM) | GARP | 40 | — | 0 | 40 |
| **Iscrizione RUI - Sez. E** | **IVASS** | **30** | **30** | **27** | **3** |
| EFPA European Financial Advisor (MiFID II) | EFPA Italia | 27 | — | 24 | 3 |
| ABA Bank Teller Certificate | ABA | 22 | — | 0 | 22 |
| Scrum Master Certified | Scrum Alliance | 1 | — | 0 | 1 |

- **BUCO RINNOVI IVASS: 30 righe = 30 utenti (zero seconde righe) — 27/30 scadute tra 2021 e 2024, MAI rinnovate.** Idem EFPA: 24/27 scadute. Questo è esattamente l'aggancio C4 "rinnovi IVASS/antiriciclaggio".
- I rinnovi esistenti (AML/CAMS/FRM) hanno **date incoerenti**: es. FRM issued 2025-05-28→exp 2028-08-05 poi rinnovo 2025-09-18→exp **2027-03-28** (scadenza che regredisce); CAMS rinnovi con overlap pluriennale. C4 deve fare meglio (rinnovo ~alla scadenza, expiry monotona).

## 5. sys_learning_gaps + gap_closure_* — semantica reale

- **sys_learning_gaps: 270 righe, 146 utenti.** `detected_at` 2025-11-14..2026-05-13. Severity: HIGH 118 · MEDIUM 99 · LOW 48 · CRITICAL 5.
- **`skill_id` SEMPRE NULL, required/current proficiency SEMPRE NULL**: il gap NON è agganciato al catalogo skill via FK. La semantica vive in `metadata.legacy`: `skill_gaps: [{gap:2, skill:"Leadership"},...]` + coverage_score/proficiency_score (source_table=`skill_gap_analyses`). L'aggancio "iniziative agganciate ai gap reali" per C4 passa dai **nomi skill testuali** nel metadata (o via sys_skill_learning_mappings sui 142 moduli global).
- **sys_gap_closure_plans: 36 righe, 36 utenti, tutte ACTIVE**, target_completion_date sempre NULL, milestones jsonb tipo `[{"target_job_level":"Manager","target_job_family":"Sales"}]`.
- **sys_gap_closure_actions: 440 righe — tutte `TRAINING_ASSIGNMENT` + `PROPOSED`**, due_date sempre NULL, coprono 143/270 gap. Payload = legacy `learning_recommendations`. CHECK kind: `TRAINING_ASSIGNMENT|CERTIFICATION_REQUIRED|MANAGER_INTERVENTION|PEER_COACHING|ON_THE_JOB_EXPOSURE|MENTORING`.
- **Nessuna azione è mai passata a IN_PROGRESS/COMPLETED**: C4 può chiudere il cerchio gap→azione→assignment→evidence.

## 6. Giorni TRAINING in attendance (C1) — la quadratura da costruire

- `sys_attendance` RTL: 116015 righe, 2023-08-01..2026-07-24, 158 utenti. Status: PRESENT 94455 · REMOTE 10473 · VACATION 6338 · SICK 2659 · **TRAINING 1180** · PAID_LEAVE 893 · ABSENT 17.
- UNIQUE doppia: `(tenant, natural_key)` + `(tenant, user, date)` → un solo status per giorno/utente.
- **Natural-key convention C1**: `STORIA36::C1::ATTEND::<user_uuid>::<YYYY-MM-DD>`, ore 7.50 regular, source `IMPORT`, notes/metadata vuoti — **nessun link a modulo/iniziativa** nel giorno TRAINING.
- Densità TRAINING per anno/utente:

| anno | giorni TRAINING | utenti | min | max | avg gg/utente |
|---|---|---|---|---|---|
| 2023 (ago-dic) | 164 | 103 | 1 | 4 | 1.59 |
| 2024 | 390 | 147 | 1 | 7 | 2.65 |
| 2025 | 387 | 144 | 1 | 8 | 2.69 |
| 2026 (gen-lug) | 239 | 120 | 1 | 6 | 1.99 |

- Mensile stabile 19-48 giorni/mese (outlier basso: 2025-11 = 6). Totale 1180 su tutta la finestra.
- **Quadratura oggi INESISTENTE**: solo **7/1429** evidence RTL cadono su un giorno TRAINING dello stesso utente; **1173/1180** giorni TRAINING non hanno alcuna evidence lo stesso giorno. Il mismatch è doppio: 2023-2024 hanno 554 giorni d'aula con ~17 evidence totali; 2025-2026 hanno 1412 evidence quasi tutte fuori dai giorni d'aula (plausibile per SELF_PACED, ma l'aula resta orfana).
- **Implicazione C4**: le iniziative d'aula (INSTRUCTOR_LED) vanno datate SUI giorni TRAINING esistenti (per utente/coorte), con assignments agganciati a `initiative_id` ed evidence `completed_at` = fine iniziativa; la formazione self-paced può restare fuori-aula. I 1180 giorni sono il vincolo rigido (UNIQUE user+date: non si possono aggiungere giorni TRAINING dove esiste già un altro status senza toccare C1).

## 7. Sintesi buchi che C4 deve riempire

1. **Iniziative**: tabella vuota — serve la serie annuale 2023/24/25/26 (natural key tenant+code; suggerita convenzione coerente con C1: `STORIA36::C4::INIT::<...>` o code parlante tipo `RTL-2024-AML-Q1`).
2. **Catalogo d'aula**: zero moduli INSTRUCTOR_LED/WORKSHOP — crearli o affiancarli ai 15 BANK-LM (che sono self-paced).
3. **Evidence**: buchi 2023-08..2024-01 (zero), 2024-02..2025-08 (34 righe), 2026-04-16..2026-07-26 (zero).
4. **Assignments**: initiative_id mai usato, deadline mai usata, nessun UNIQUE naturale (idempotenza da progettare, es. chiave in metadata).
5. **Certificazioni**: 27 IVASS + 24 EFPA scadute senza rinnovo; rinnovi esistenti con expiry non monotona da non imitare.
6. **Gap→formazione**: 270 gap senza skill_id; 440 azioni TRAINING_ASSIGNMENT ferme a PROPOSED senza due_date — chiudere il ciclo gap→azione→assignment(initiative)→evidence.
7. **Quadratura aula/attendance**: 7/1429 oggi — target: ogni giorno TRAINING coperto da un'iniziativa e (per i partecipanti) da evidence coerente.
