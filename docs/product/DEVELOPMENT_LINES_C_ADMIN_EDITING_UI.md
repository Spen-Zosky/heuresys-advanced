# Development Lines — Serie C: admin editing UI (da console di lettura a strumento di gestione)

> **Stato**: PROPOSTO — selezione = Enzo. **Provenienza**: atlas + sweep S1016. Regola T2.
> **La tesi**: l'admin SPA è al 83% read-only (**9/53 pagine con mutation**, sweep web:admin); **zero CRUD UI** su users/tenants/positions/skills/kpi/learning/goals/okrs/org-units. MA le API di scrittura ESISTONO già per quasi tutte queste entità (moduli con POST/PATCH/DELETE + permission + CSRF, atlas). Il gap è quasi solo frontend: oggi l'amministrazione dati reale passa da SQL/seed.

## Le linee

### C1 — People & Org editing
- **API già pronte**: users (PATCH field-level + role grants), positions (CRUD completo + skill/KPI sub-CRUD), organization-units (CRUD).
- **Webapp**: `/users/[userId]` (form edit + gestione ruoli — API grants c'è) · `/positions/[positionId]` (edit + requirements) · `/organization` (create/edit/move OU). Componenti `@heuresys/ui` pronti e MAI usati: FormWizard, tier6 form avanzati.
- **Effort**: ~2 sessioni.

### C2 — Cataloghi (skills, KPI, learning, job)
- **API già pronte**: skills (create/update; DELETE non esiste — vedi G), kpi-definitions, learning-modules/paths/steps, job-families/roles (write PLATFORM_ADMIN nel service).
- **Webapp**: `/skills` (create/edit + gestione tassonomia: families/categories/edges/aliases/proficiency — 6 moduli API senza alcuna UI) · `/kpis` (edit) · `/learning` (edit moduli/path) · **NUOVA: `/job-catalog`** (job-families + job-roles + mapping ESCO: 2 moduli API oggi senza NESSUNA pagina).
- **Effort**: ~2-2,5 sessioni.

### C3 — Tenant & piattaforma
- **API già pronte**: tenants (create/patch/soft-archive), blueprint-activations, tenant-materialization (plan/apply), mfa-policy (già con UI mutation).
- **Webapp**: `/tenants` (create/archive + wizard materializzazione da archetipo — oggi il generatore WI-C è API/MCP-only) · `/blueprints` (activate/override UI).
- **Effort**: ~1,5.

### C4 — Fondamenta trasversali (prerequisito qualità delle altre)
- **Paginazione server-side reale** nelle list page (oggi `?limit=200` hardcoded in ~20 pagine; viz cap 500).
- **Shared-types refactor**: 62/87 schemi senza consumer web tipizzato — sostituire le interface locali duplicate (anti-pattern vs dottrina MVP-2a, rischio drift coi CHECK server).
- **apiFetch FormData** (oggi upload media bypassa il client con fetch raw).
- **Effort**: ~1,5-2 (spalmabile: farla per-pagina insieme a C1-C3).

## Webapp impattate (riepilogo serie)

| Pagina | Linee | Nuova? |
|---|---|---|
| /users/[userId], /positions/[positionId], /organization | C1 | no |
| /skills, /kpis, /learning | C2 | no |
| **/job-catalog** | C2 | **SÌ** (2 moduli API oggi orfani di UI) |
| /tenants, /tenants/[tenantId], /blueprints | C3 | no |
| ~20 list page (paginazione) + tutte (types) | C4 | no |

## Note di design

- Ogni mutation UI riusa le permission/CSRF già enforce-ate lato API — nessuna nuova superficie di sicurezza.
- Dove il service ha gate hardcoded PLATFORM_ADMIN non deducibile dalla matrice RBAC (taxonomy skill, job-*), l'UI deve riflettere il gate reale → occasione per sanare le permission proxy (rimando a Serie G4).
- DoD live E2E: ogni form dimostrato con una modifica reale su RTL Bank (ruolo dati: customer-example) e re-fetch.

## Sequenza raccomandata

C4-paginazione insieme a C2 (le liste cataloghi sono le più lunghe) → C1 → C3. Totale ~6-8 sessioni se tutto.
