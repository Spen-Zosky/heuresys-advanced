# Fase 4 — Forense frontend per-superficie · S1025 · 2026-07-22

> Kickoff: `docs/kb/NEXT_SESSION_DB_FRONTEND_FORENSICS_KICKOFF.md` §4. Eseguito DOPO le
> Fasi 1-3 (fix dati) e dopo il deploy i18n, come impone la sequenza. Bersaglio: PROD
> (`www.heuresys.com`) con login reali (admin, federica TENANT_ADMIN, paolo MANAGER,
> tommaso USER).

## §1 Inventario superfici (104 route — derivato da `apps/web/src/app`, 2026-07-22)

- **Admin SPA (autenticate)**: dashboard · users(+detail) · positions(+detail/kpis/skills/learning)
  · organization(+org-chart) · skills · kpis · goals · okrs · gaps · learning(+training-initiatives)
  · career-succession · compensation-intelligence · talent-review · time-off · approvals(+detail)
  · engagement(+detail) · insights(+skill-gap/succession-readiness) · analytics (9 viste)
  · blueprints(+variant) · tenants(+detail/enterprise-typing) · processes · process-owner
  · org-director · content(+detail) · visualizations(+detail) · system-health · provenance
  · seed-acquisition/runs · brownfield-adaptation · admin/roles · admin/mfa-policy · dev/agent · evidence/whistleblowing se presenti
- **ESS `/me/*` (18)**: me · analytics · approvals · career(+target) · certifications · documents
  · gaps · handbook(+detail) · inbox · kpis · learning(+catalogue) · matching · org-chart
  · positions · profile · security · skills(+self-assessment) · surveys(+detail) · team
- **Pubbliche**: `/` · /login · /demo · /investors · /privacy · /app
- **Showcase in-app** (18 route design) + sito statico `apps/showcase` (GitHub Pages)

## §2 Metodo (per pagina)

Checklist dal kickoff: codici/chiavi illeggibili dove serve la descrizione · testi non
intellegibili o mock/hardcoded · formati (date, valute, numeri) · mix IT/EN · link e
navigazioni rotte · dataset poveri dove il DB ha di più · errori console/network.
Strumento: chrome-devtools/Playwright su PROD, login per ruolo. Esito: scheda finding
per pagina → piano chirurgico (API-first se manca il dato; fix UI se è presentazione).

## §3 Schede findings (sweep S1025 — 68 pagine × 3 profili, build prod + DB PROD)

### Corretti in-sessione (verificati con re-run catena a11y+census)

| # | Superficie | Finding | Fix |
|---|---|---|---|
| F4-01 | `/me/career` | bottone timeline DENTRO il `<dl>` (axe `definition-list` serious ×4) — emerso coi goal reali | prop `footer` di `ProfileSection` fuori dal `<dl>` |
| F4-02 | `/me/inbox` | `--warning #F59E0B` su chiaro = 2.15:1 (axe `color-contrast` serious) — emerso con le notifiche MEDIUM reali | light → amber-700 `#B45309` (4.7:1), dark ripristina `#F59E0B` |
| F4-03 | `/organization/org-chart` | bottone picker `bg-primary text-white`: in dark 2.75:1 (bianco su `#5E9DF5`) | `text-[color:var(--color-primary-fg)]` (ink per-modo S982: light 5.2:1, dark 6.5:1) |
| F4-04 | header (ogni pagina) | badge ruolo col codice RBAC raw (`PLATFORM_ADMIN`, `USER`) | label umane `shell:roles.*` IT/EN (12 ruoli) |
| F4-05 | `/me/skills/self-assessment` | select proficiency con codici raw (`ADVANCED_BEGINNER`) | opzioni tradotte `ess:selfAssessment.levels.*` |
| F4-06 | `/organization/org-chart` | copy IT in inglese ("Org chart", "← Organization"), "grafici ORG_CHART" col codice, empty-state che cita un file seed (leak interno) | copy IT/EN riscritta, seed hint rimosso dalla UI |
| F4-07 | `/system-health` | "Loading system health…" hardcoded EN | `t("common:loading")` |

### Registrati (non bloccanti, prossima passata)

- **"Loading" transitorio EN** su alcune pagine durante il bootstrap i18n (fallback EN
  prima del caricamento risorse IT) — visibile solo per un frame; valutare preload
  del namespace `common` per il locale attivo.
- **`/admin/roles`**: la matrice mostra i codici ruolo (semi-legittimo in una pagina
  di amministrazione RBAC); valutare colonna "Nome" con le label `shell:roles.*`.
- **`ATECO_2025` / `ESCO_SKILL_HIERARCHY`** su `/brownfield-adaptation` e
  **`IT_ME_FFDEECF5`** su `/approvals` (primo run census): codici sorgente/richiesta
  esposti — pagina tecnica platform-only, priorità bassa; scheda al prossimo giro.
- **Pagine ESS sottili al primo paint**: falso positivo di cattura (soglia >50ch
  fotografava la shell pre-dati); la spec ora attende la stabilizzazione del testo.
  Cross-check DB: tommaso ha 11 learning, 5 documenti, 4 goal, 2 cert, 3 cedolini →
  le pagine POPOLANO. Un pass qualitativo per-pagina resta utile (P2).

### Worklist P2 (census secondo giro, cattura stabilizzata — 35 pagine con segnali)

Cluster per tipo di intervento (la fonte piena è `qa_artifacts/runs/f4-sweep/`):

1. **Layer label per gli enum di stato** (il cluster più grosso — un pattern, tante pagine):
   `ON_TRACK`/`IN_PROGRESS`/`NOT_STARTED` (goals, me/career) · `MODERATE_GAP` (inbox) ·
   `READY_NOW`/`NOT_READY` (talent-review) · `MANAGER_ASSESSMENT` (me/skills) ·
   `DELTA_VS_TARGET`/`LINEAR_SCORE`/`CAPPED_120`/`LINEAR_DEFAULT` (kpis) ·
   `CONTRACT_REFERENCE` (me/documents). Piano: mappa i18n `status.*`/`enums.*` +
   componente label riusabile.
2. **UUID/codici tecnici renderizzati**: skill con suffisso UUID (me/skills,
   self-assessment, skills, learning — probabile `ESCO::<uuid>` mostrato come codice) ·
   documenti (uuid grezzo) · `LEGACY_CP`/`LEGACY_BP` (career-succession,
   compensation-intelligence) · `IT_ME_FFDEECF5` (approvals/instance code) ·
   `IT_TI_A00EDC19_BAD_FAC` (training-initiatives — nome sospetto anche lato DB).
   Piano: mostrare nome/descrizione, codice solo come meta secondaria.
3. **Codici piattaforma semi-legittimi** (pagine admin tecniche, priorità bassa):
   `RTL_BANK` (tenants/system-health/mfa-policy) · `REGIONAL_RETAIL_BANK_MEDIUM`
   (blueprints) · `RTL_ORG_CHART` (visualizations) · `ATECO_2025`/`ESCO_SKILL_HIERARCHY`
   (brownfield) · matrice ruoli (aggiungere colonna label).
4. **Pagine ESS ancora sottili post-settle** (~460-575ch): me/analytics, approvals,
   gaps, handbook, kpis, org-chart, positions, surveys — verifica per-pagina se
   empty-state legittimo o dato DB non esposto (tommaso ha gap=1, surveys asseg.,
   posizione attiva → almeno gaps/positions/org-chart dovrebbero rendere di più).

## §4 Stato

- [x] Inventario derivato dal codice (104 route)
- [x] Sweep meccanica completa e stabilizzata (68 route × 3 personas, spec `f4-sweep` riusabile)
- [x] 7 fix chirurgici applicati e verificati (F4-01…07), catena 152/152 verde
- [x] Worklist P2 clusterizzata (4 piani chirurgici sopra)
- [ ] Esecuzione P2 (label-layer enum → codici tecnici → pagine sottili) + pass qualitativo
      "a occhio" (formati, realismo dei contenuti) + showcase/pubbliche
- [ ] Preload i18n `common` (transitorio EN)
- [x] **Requisito Enzo (S1025): l'ITALIANO è la lingua di default** — verificato live
      (config `DEFAULT_LOCALE='it'` + fallback IT; 0 flag EN sulle 68 pagine autenticate
      al census finale; le 5 pubbliche servono `lang="it"` in SSR senza cookie) e reso
      PERMANENTE con la spec di regressione `tests/e2e/default-locale.spec.ts` (suite
      normale: contesto vergine → lang=it + copy IT su /login, EN solo da toggle esplicito)
