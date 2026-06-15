# SPEC — Tenant Onboarding (legame tenant→NACE/size + OU↔processi + motore generativo)

> **Status**: DESIGN — PROPOSED. Nessuna migration creata/applicata. DDL = proposta da validare.
> **Data**: 2026-06-15 · **Copre**: TODO T1.3, T2.5, T2.6, T3.7 + FASE 2 mancante · **Deriva da**: File 2 HEU-FLOW-001 + report `01` §3.
> **Invarianti**: I1 (position-centric), I3/I4, I5 (tenant filter no-RLS), RD-08, I9 (PIP = VIEW), I12/ADR-0023. Migration next = `000118`.
> **DoD**: chiusura SOLO con dimostrazione live su tenant TEST + output reale.

---

## 0. Mappa flusso HEU-FLOW-001 → realtà repo (sintesi report §3)

Lo scheletro dati esiste al ~90%. I gap reali del flusso sono **3 popolamenti + 1 motore + FASE 2 mancante**. Tutto il resto (OU, posizioni, ruoli, KPI, carriere, learning, successioni) ESISTE già con dato reale brownfield.

---

## 1. T1.3 — Valorizzare il legame tenant → NACE/ATECO + size (FASE 0)

### Stato verificato
`sys_enterprise_typing_profiles` (mig `000007:128`) esiste, ma l'unico profilo (HEURESYS) ha `industry_class_id`/`size_band_id`/`operating_model_id`/`employee_count` **tutti NULL**; RTL_BANK **non ha** profilo. Sul tenant c'è solo `tenant_industry_code` (stringa libera) + `tenant_size_band` (RTL=M, HEU=S).

### Azione (PROPOSED, idempotente)
Migration/seed `000118` che valorizza i 2 tenant TEST:
```sql
-- PROPOSED — wire enterprise typing profile (idempotente)
INSERT INTO sys.sys_enterprise_typing_profiles
    (enterprise_typing_profile_id, enterprise_typing_tenant_id,
     enterprise_typing_industry_class_id, enterprise_typing_size_band_id,
     enterprise_typing_operating_model_id, enterprise_typing_employee_count, ...)
SELECT gen_random_uuid(), t.tenant_id,
       ac.activity_classification_id,         -- FK risolto da scheme+code (es. FIN_BANKING→NACE/ATECO code)
       sb.enterprise_size_band_id,            -- da tenant_size_band
       om.operating_model_id,                 -- RETAIL per RTL_BANK
       158                                     -- employee_count reale RTL
FROM sys.sys_tenancies t
JOIN sys.sys_activity_classifications ac ON ...   -- mapping industry_code → classification
JOIN sys.sys_enterprise_size_bands sb     ON sb.enterprise_size_band_code = t.tenant_size_band
JOIN sys.sys_operating_model_catalog om   ON ...
WHERE t.tenant_code IN ('RTL_BANK','HEURESYS')
ON CONFLICT (enterprise_typing_tenant_id) DO UPDATE SET ...;
```
**Decisione semantica (Enzo)**: la mappatura `tenant_industry_code` (es. `FIN_BANKING`) → codice NACE/ATECO concreto (es. `K.64` banche) non è automatica — serve la regola di corrispondenza industry-code→classification.

### Test + DoD live
```bash
psql ... -tAc "SELECT t.tenant_code, p.enterprise_typing_industry_class_id IS NOT NULL,
  p.enterprise_typing_size_band_id IS NOT NULL
  FROM sys.sys_tenancies t LEFT JOIN sys.sys_enterprise_typing_profiles p
  ON p.enterprise_typing_tenant_id = t.tenant_id;"   # entrambi i tenant → true,true
```

---

## 2. T2.5 — Assegnazione OU ↔ processi di business (lacuna FASE 1)

### Stato verificato
Nessuna tabella di join OU↔processo. I processi vivono in `sys_blueprint_process_registry` (23 righe, tenant-less). Accoppiamento oggi solo indiretto via KPI-template.

### Schema PROPOSED (conforme I3/I4, I5)
```sql
-- mig 000118 (PROPOSED) — OU ↔ business process assignment (tenant-scoped)
CREATE TABLE IF NOT EXISTS sys.sys_organization_unit_processes (
    organization_unit_process_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_unit_process_tenant_id           uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),  -- I5
    org_unit_process_org_unit_id         uuid NOT NULL REFERENCES sys.sys_organization_units(organization_unit_id),
    org_unit_process_blueprint_process_id uuid NOT NULL REFERENCES sys.sys_blueprint_process_registry(blueprint_process_id),
    org_unit_process_role                varchar(16) NOT NULL DEFAULT 'OWNER'
        CHECK (org_unit_process_role IN ('OWNER','CONTRIBUTOR','CONSULTED','INFORMED')),  -- RACI, RD-08
    org_unit_process_metadata            jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_ou_process UNIQUE (org_unit_process_org_unit_id, org_unit_process_blueprint_process_id)
);
```
+ modulo API `organization-unit-processes` (pattern 7-step: shared schema → repository raw SQL → service scope-filtered → routes `requirePermission` + CSRF → integration test → register `app.ts` → atomic commit).

### Test + DoD live
- vitest integration + tenant-isolation (I5: un tenant non vede le assegnazioni di un altro).
- query live: join OU↔processo popolato per RTL_BANK.

---

## 3. T2.6 — Cluster skill per ruolo/OU/processo (lacuna FASE 3)

### Stato verificato
Nessuna tabella cluster/skill_group. Dipende da `skill_group_uri` (oggi 0 — vedi spec `03` T1.1).

### Approccio (PROPOSED)
- View/MV derivata: per ogni (ruolo|OU|processo) → distribuzione skill per `skill_group_uri`, riusando PSR (844) + assignment + skill→gruppo (post-T1.1).
- I9-aware: se il cluster è una proiezione → VIEW/MATERIALIZED VIEW (mai JSONB blob), coerente con PIP.
- **Prerequisito**: T1.1 (skill→gruppo). Fino ad allora `blocked-on T1.1`.

---

## 4. T3.7 — Motore "ricerca AI augmented" del reference environment (#9 WI-C)

### Stato verificato
È il pezzo realmente nuovo e bloccato. `apps/agent-gateway/src/mcp-tools.ts:86` → `// FUTURE (Phase B, WI-C): hrx_tenant_materialize — not built yet`. Modulo `tenant-materialization` inesistente (grep 0 hit in `apps/api/src/modules/`). Recommender typing→variant (D3) = **rinviato** (`docs/integrations/agent_sdk_mcp_integration_plan_2026-06-15.md:264`).

### Disegno (da PLAN #9, allineato)
- Modulo `tenant-materialization`: `POST /v1/tenant-materialization` (PLATFORM_ADMIN), lifecycle **dry-run/plan → approve → apply** (HITL, M-2 write-gate deny-by-default).
- **Phase A** (catalogo, principal=service): families/variants/processes/KPI-template/job-families/roles — endpoint esistenti.
- **Phase B** (istanza tenant, principal=user/generatore): materializza OU/positions/skill/KPI nel tenant TEST, idempotente `ON CONFLICT`, modella `db/scripts/seed-reference-bank.ts` (NON un re-import brownfield — generazione da classificazione+size).
- Edge **I9**: KPI per-position con rank → estendere la VIEW PIP `sys_position_intelligence_profiles_v` (D2 abilitato in #9).
- Recommender typing→variant (NACE+size → blueprint_variant): D3 net-new, **decisione Enzo** se includerlo o restare su seed deterministico.

### Gate (⛔ blocked-on-Enzo)
1. `ANTHROPIC_API_KEY` SDK-valida (`query()` → 401 oggi) — blocca l'agente.
2. go migration-apply (WI-C/WI-D2 DDL).
3. approval umana sulle write.

### DoD live
E2E: materializzazione di 1 tenant TEST end-to-end (generate→plan→apply) con output reale (OU/positions/skill/KPI creati, verificati via re-fetch `/v1/*`).

---

## 5. FASE 2 mancante (gap documentale)

Il File 2 annota: *"la sequenza salta da FASE 1 a FASE 3; non esiste FASE 2"*. Da decidere (autorità Enzo):
- (a) rinumerare FASE 3 → FASE 2, oppure
- (b) FASE 2 = stadio intermedio da specificare (candidato: **validazione/conferma umana del prototipo** prima dell'arricchimento skill/governance — coerente con HITL del motore T3.7).

Raccomandazione: (b) — una FASE 2 "review & approve del reference environment" si innesta naturalmente sul write-gate HITL di #9.

---

## 6. Riepilogo conformità

| Regola repo | Come la spec la rispetta |
|---|---|
| I1 position-centric | gerarchia su `position_reports_to_position_id` (esistente), non su ruoli |
| I3/I4 | nuove tabelle in `sys.sys_<plural>` |
| I5 tenant filter | `_tenant_id` FK + filtro middleware, no-RLS |
| I9 PIP = VIEW | cluster (T2.6) e KPI-rank (T3.7) come VIEW/MV, mai JSONB blob |
| RD-08 | RACI/relation = varchar+CHECK |
| idempotenza | `ON CONFLICT` + migration twice-run |
| DoD live | ogni T# chiude su tenant TEST con output reale |
| #9 alignment | T3.7 segue il PLAN `agent_sdk_mcp_integration_plan_2026-06-15.md` + gate esistenti |
