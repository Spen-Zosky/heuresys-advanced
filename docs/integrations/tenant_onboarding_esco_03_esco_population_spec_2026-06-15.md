# SPEC — Popolamento ESCO (backfill gerarchia skill + import occupation→skill + classificazione)

> **Stato aggiornato S1029 (2026-07-25).** L'asse professione descritto qui è **in produzione**: migration `000206_occupation_classifications` applicata, catalogo popolato e verificato live — `ISCO_08` **619** nodi (il totale ILO previsto dal design) e `CP_2021` **1502**. L'header di stato originale («PLAN / TODO / per esecuzione successiva») è quindi storico. I conteggi vivi restano in `docs/kb/SOT_STATE.md`, non qui.


> **Status**: DESIGN — PROPOSED. Nessuna migration creata/applicata. DDL = proposta da validare prima dell'esecuzione.
> **Data**: 2026-06-15 · **Copre**: TODO T1.1, T1.2, T2.4, T3.8 · **Deriva da**: File 1 (ESCO) + report `01` §1/§5.
> **Invarianti**: I3/I4 (`sys.sys_<plural>`), I5 (tenant filter), RD-08 (varchar+CHECK), I12/ADR-0023 (no-PII synthetic). Migration next = `000118`.
> **DoD**: chiusura SOLO con dimostrazione live su tenant TEST + output reale.

---

## 0. Stato di partenza verificato (DB live 2026-06-15)

| Fatto | Valore | Implicazione |
|---|---|---|
| `sys_skills` | 21.939 | 14.011 con `skill_esco_uri`, 31 con `skill_category_id` |
| `skill_metadata->>'skill_type'` popolati | 14.036 (skill 10.797 / knowledge 3.230 / competence 8 / behavior 1) | base per classificazione (T2.4) |
| `skill_metadata->>'skill_group_uri'` / `broader_uri` | **0** | scaffold morto → blocca clustering e Skills Group Share |
| `sys_esco_occupation_mappings` | 7.675 (25 con job_role, 7.650 catalogo) | ponte ruolo↔occupation parziale |
| dump occupation→skill | 126.051 righe `REFERENCE_ONLY` mai importato | `db/seeds/brownfield/wave1/legacy_data/wave1_eskap_esco_occupation_skills.sql` |
| embeddings | skill 21.939 / occupation 3.045 / job_role 136 / user_profile 156 | pgvector già popolato |

---

## 1. T1.1 — Backfill gerarchia ESCO skill (`skill_group_uri` + `broader_uri`)

### Obiettivo
Popolare i campi gerarchia ESCO oggi a 0, per abilitare il raggruppamento per `broaderHierarchyConcept` (Skills Group Share) e il clustering.

### Approccio (conforme architettura)
Estendere il connector server-side esistente — **NON** fetch client-side.

- File: `apps/api/src/modules/reference-sync/esco-connector.ts` (oggi fa `/search?type=occupation`). Aggiungere risoluzione `/resource/skill?uri={skill_esco_uri}&language=en` per i 14.011 skill con URI, leggendo `_links.broaderHierarchyConcept[]` e `_links.broaderSkill[]`.
- Persistenza: UPDATE `sys.sys_skills SET skill_metadata = skill_metadata || jsonb_build_object('skill_group_uri', $1, 'broader_uri', $2)` per `skill_esco_uri` (NO nuova colonna — i campi sono già previsti nel jsonb scaffold).
- Watermark/idempotenza: riusare `brownfield.source_watermarks` (lock `FETCHING`, hash-skip `UNCHANGED`) come fa già il connector ESCO/ATECO. Pool concorrente max 6-8 + backoff su 429 (come da File 1 §D).
- Scheme sync: aggiungere `ESCO_SKILL_HIERARCHY` all'enum sorgenti `reference-sync.ts` (oggi `["ESCO","ATECO_2025"]`).

### Policy da fissare (da File 1 §B, decisione tecnica CLI)
- skill con più `broaderHierarchyConcept` → **primo** (default) vs più specifico. Default = primo (replica ESCO).
- bucket `skill group unavailable` per skill senza gruppo (NULL preserved).

### Test
- vitest fixture-based (seam `EscoFetcher` con fixture, no HTTP live in CI — pattern esistente).
- assert: dopo backfill su fixture, `skill_group_uri` valorizzato per le skill della fixture.

### DoD live (tenant TEST)
```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc \
 "SELECT count(*) FROM sys.sys_skills WHERE skill_metadata->>'skill_group_uri' IS NOT NULL;"   # ≫ 0
# + sample 5 skill: skill_name, skill_group_uri risolto vs portale ESCO
```

---

## 2. T1.2 — Import occupation→skill (essential/optional)

### Obiettivo
Rendere interrogabile dal DB la relazione occupation→skill (oggi solo dump legacy non importato), per skill-portfolio-da-occupation (FASE 3-ESCO) e Skills Group Share.

### Schema PROPOSED (conforme I3/I4)
```sql
-- mig 000118 (PROPOSED, idempotente) — occupation→skill relations from ESCO
CREATE TABLE IF NOT EXISTS sys.sys_occupation_skill_requirements (
    occupation_skill_requirement_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    occupation_skill_req_occupation_uri  text   NOT NULL,                 -- ESCO occupation URI
    occupation_skill_req_skill_id        uuid   REFERENCES sys.sys_skills(skill_id),
    occupation_skill_req_skill_esco_uri  text   NOT NULL,                 -- ESCO skill URI (fallback se skill_id NULL)
    occupation_skill_req_relation        varchar(16) NOT NULL
        CHECK (occupation_skill_req_relation IN ('ESSENTIAL','OPTIONAL')),  -- RD-08: varchar+CHECK, NO ENUM
    occupation_skill_req_is_global       boolean NOT NULL DEFAULT true,
    occupation_skill_req_metadata        jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_occ_skill UNIQUE (occupation_skill_req_occupation_uri, occupation_skill_req_skill_esco_uri)
);
CREATE INDEX IF NOT EXISTS sys_occ_skill_req_occ_idx   ON sys.sys_occupation_skill_requirements (occupation_skill_req_occupation_uri);
CREATE INDEX IF NOT EXISTS sys_occ_skill_req_skill_idx ON sys.sys_occupation_skill_requirements (occupation_skill_req_skill_id);
```

### Pipeline import (PROPOSED)
1. Source: `wave1_eskap_esco_occupation_skills.sql` (legacy id-based) → mappare `occupation_id`/`skill_id` legacy a URI ESCO / `sys_skills.skill_id` via `skill_esco_uri`.
2. Decisione di reclassify nel brownfield registry: `sys_position_skill_requirements` resta `REFERENCE_ONLY`; la NUOVA tabella `sys_occupation_skill_requirements` è il target IMPORT (registry: bucket A/IMPORT). **Decisione semantica = autorità Enzo** (occupation-level ≠ position-level, vedi I14 employee-centric).
3. Idempotenza: seed/migration `INSERT … ON CONFLICT (occupation_uri, skill_esco_uri) DO NOTHING`. PK derivata via `uuid_generate_v5` se serve determinismo (RFC-4122, vedi `reference_deterministic_seed_uuid_rfc4122`).
4. Registrare la nuova tabella in `sys.sys_reconciliation_registry` (0-UNCLASSIFIED invariant del `000062`).

### Test
- vitest integration: counts essential/optional = source (67.600 / 58.451 atteso, da riconfermare post-mapping); FK integrity skill_id.
- db:validate 7/7 (tenant-boundary + empty-diff twice-run).

### DoD live
```bash
psql ... -tAc "SELECT occupation_skill_req_relation, count(*) FROM sys.sys_occupation_skill_requirements GROUP BY 1;"
# + sample 1 occupazione → lista skill essential/optional verificata vs legacy
```

---

## 3. T2.4 — Classificazione skill (hard/soft/conoscenze)

### Obiettivo
Estendere la categorizzazione oltre le 31 skill attuali, sfruttando `skill_type` ESCO già presente.

### Approccio
- Derivare da `skill_metadata->>'skill_type'` (skill=10.797 / knowledge=3.230): mappa `knowledge`→categoria "Conoscenze"; `skill/competence`→ripartizione su categorie esistenti o nuova dimensione `skill_kind`.
- **NON** introdurre ENUM (RD-08). Se serve una dimensione hard/soft separata da `skill_category_id`, aggiungere `skill_kind varchar(16) CHECK (skill_kind IN ('HARD','SOFT','KNOWLEDGE','OTHER'))` come colonna o chiave jsonb. Decisione di modeling = Enzo (la tassonomia hard/soft/live/conoscenze del File 2 non ha mapping 1:1 con ESCO skill/knowledge).
- Idempotente UPDATE.

### DoD live
```bash
psql ... -tAc "SELECT count(*) FROM sys.sys_skills WHERE skill_category_id IS NOT NULL;"   # ≫ 31
```

---

## 4. T3.8 — Grafico "Skills Group Share" (File 1, server-side)

### Obiettivo
Implementare la torta occupazione→gruppi-competenze del File 1, **conforme alla dottrina LIVE-DATA** (legge dal DB, non da ESCO client-side).

### Disegno (conforme architettura repo)
1. **Shared** (`packages/shared/src/schemas/`): nuovo schema `SkillGroupShare { label; count; value }` + subpath export (NON `esco.schema.ts` standalone — integrare in `analytics.ts` o nuovo `skill-group-share.ts`). Funzione pura `buildShare()` + test Vitest (i 4 test del File 1 §J1 sono buon punto di partenza).
2. **API** (modulo `analytics` esistente): nuovo endpoint `GET /v1/analytics/skill-group-share?occupationUri=` → repository raw SQL che JOIN `sys_occupation_skill_requirements` (T1.2) × `sys_skills.skill_metadata->>'skill_group_uri'` (T1.1), aggrega per gruppo. Gate `analytics:view`. Integration test.
3. **Web** (`apps/web/src/app/(authenticated)/analytics/`): pagina/sezione che usa `EChartsCard` + `echartsPresets.pie` (verificati esistenti) + `DataTable`/`JsonTree` a11y affiancata + export via `exportCSV`/`downloadAsFile`. Nav migration. i18n it/en.
4. **E2E** Playwright PROD: login reale, naviga, asserisce % skill-per-gruppo su occupazione reale.

### Prerequisito assoluto
**T1.1 + T1.2** (senza skill→gruppo e occupation→skill nel DB, il grafico non ha dati). Fino ad allora resta `blocked-on T1.1/T1.2`.

---

## 5. Riepilogo conformità

| Regola repo | Come la spec la rispetta |
|---|---|
| I3/I4 `sys.sys_<plural>` | nuova tabella `sys.sys_occupation_skill_requirements`; campi ESCO in `skill_metadata` jsonb esistente |
| RD-08 no-ENUM | `relation`/`skill_kind` = varchar+CHECK |
| LIVE-DATA doctrine | ingestion server-side (`reference-sync`), serving `/v1/*`, no fetch client-side |
| no UI dup | grafico = composizione `@heuresys/ui` (`EChartsCard`/`echartsPresets`), 0 dip charting in `apps/web` |
| idempotenza | UPSERT + `ON CONFLICT` + watermark hash-skip |
| reconciliation 0-UNCLASSIFIED | nuova tabella registrata nel registry |
| DoD live | ogni T# chiude con output reale su tenant TEST |
