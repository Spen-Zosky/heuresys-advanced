# Heuresys Advanced — QA Forense E2E (S1006)

> Documento di raccolta problemi (audit-first). Ambiente: **PROD live** `https://www.heuresys.com`.
> Esecuzione: Chrome MCP (sessione loggata), audit visivo manuale elemento-per-elemento.
> Metodo: per ogni voce di sidebar → navigo, ispeziono ogni oggetto/controllo/tab/filtro/overlay nel content pane → registro.
> **Fase corrente = OSSERVAZIONE (read-only sul prodotto). Remediation in fase 2, dopo OK piano.**

## Ambiente / note operative
- MFA disattivato in sessione: `.env` VM `MFA_ENFORCEMENT_ENABLED=false` (REVERSIBILE — backup `.env.bak.mfa-*` su VM). **DA RIATTIVARE a fine lavori.**
- Login admin: `admin@heuresys.com` (PLATFORM_ADMIN) — dati live tenant RTL Bank + Heuresys System.
- Severità: 🔴 alta (rotto/illeggibile/dato sbagliato) · 🟡 media (UX/leggibilità degradata) · 🟢 bassa (cosmetico).
- Tipo: BUG · I18N · LEGGIBILITÀ(dark/contrasto) · WIRING(link/relazione morta) · LAYOUT · DATO · A11Y · COPY.

---

## ISSUE GLOBALI / TRASVERSALI (valgono su tutta la piattaforma)

| ID | Sev | Tipo | Problema | Evidenza |
|---|---|---|---|---|
| **G-01** | 🔴 | I18N | i18n dei **dati testuali**: con IT i contenuti devono essere IT, con EN in EN. Oggi mescolati (UI chrome è ok via i18next; i CONTENUTI dal DB/ingest/ESCO no). Tema architetturale. | KPI: "AUM Growth Rate" (EN) vs "Aderenza cronogramma" (IT) — ss_72651uinm |
| **G-02** | 🟡 | LEGGIBILITÀ | **Codici tecnici grezzi** come identità primaria negli elenchi, invece di descrittori leggibili (codice → secondario/tooltip) | KPI col CODICE `BP-009-KPI-02` |
| **G-03** | 🟡 | LAYOUT | **Toggle lingua duplicato** (header + sidebar) → tenere SOLO header, sidebar più pulita | tutti gli screenshot |
| **G-04** | 🟢 | LAYOUT | **Tab perspective PET** in griglia 2×2 → devono stare su **una riga** | sidebar |
| **G-05** | 🔴 | BUG | **Persistenza perspective**: la scelta torna sempre a "Tutte" (non persiste su navigazione) | osservato (Talent→/me torna a Tutte) |
| **G-06** | 🔴 | WIRING | **Elementi che sembrano link ma non aprono nulla** → si perdono le caratteristiche relazionali/semantiche dei dati. Problema diffuso. | es. "Vedi RACI" in /process-owner (Enzo) |
| **G-07** | 🟡 | LEGGIBILITÀ | **Dark-theme reso male**: barre scure su sfondo scuro, testo scuro su sfondo scuro; le opzioni cromatiche ricche dei componenti `@heuresys/ui` non vengono applicate | infografiche varie (Enzo) |
| **G-08** | 🟡 | LEGGIBILITÀ | **Orgchart**: nodi con codici `N_<uuid>` invece di nomi posizione/persona/OU (alcuni leggibili → incoerenza) | ss_08173fblp |
| **G-09** | 🟡 | FEATURE | **Manca vista organigramma top-down** ad albero (oggi solo grafo di rete) | /visualizations org-chart |

---

## BUG LOCALIZZATI (root-cause già trovata)

| ID | Sev | Pagina | Root-cause | Fix candidato |
|---|---|---|---|---|
| **B-01** | 🔴 | /brownfield-adaptation | `page.tsx:42` `e.capturedAt.slice(0,19)` senza `?.` → crash pagina (error boundary). API 200, dati ok. | `e.capturedAt?.slice(0,19) ?? none` (come riga 61); + capire perché `capturedAt` undefined nel payload |

---

## AUDIT PER PAGINA (tracker — riempito man mano)

Stato: ⬜ TODO · 🔄 in corso · ✅ fatto · ⛔ bloccato

### Gruppo: Core / Overview
- ✅ `/` landing pubblica · ✅ `/login` · ⬜ `/dashboard` (visto, da forense) · ⬜ `/app` · ⬜ `/system-health`

### Gruppo: People / Org
- ⬜ `/users` · ⬜ `/users/[id]` · ⬜ `/organization` · ⬜ `/organization/org-chart` · ⬜ `/positions` · ⬜ `/positions/[id]` (+kpis/skills/learning) · ⬜ `/tenants` · ⬜ `/tenants/[id]` (+enterprise-typing) · ⬜ `/org-director`

### Gruppo: Skills / Learning
- ⬜ `/skills` · ⬜ `/learning` · ⬜ `/learning/training-initiatives` · ⬜ `/gaps` · ⬜ `/career-succession`

### Gruppo: KPI / Compensation
- 🔄 `/kpis` (codici+i18n già notati) · ⬜ `/compensation-intelligence`

### Gruppo: Analytics (9)
- ⬜ `/analytics/workforce` · ⬜ `/analytics/kpi` · ⬜ `/analytics/attendance` · ⬜ `/analytics/compensation` · ⬜ `/analytics/overtime` · ⬜ `/analytics/skills` · ⬜ `/analytics/skills-by-category` · ⬜ `/analytics/skills-group-share` · ⬜ `/analytics/org-network`

### Gruppo: Insights (3)
- ⬜ `/insights` · ⬜ `/insights/succession-readiness` · ⬜ `/insights/skill-gap`

### Gruppo: Visualizations
- 🔄 `/visualizations` · 🔄 `/visualizations/[graphId]` (org-chart: G-08/G-09)

### Gruppo: BPM / Process
- ⬜ `/processes` · ⬜ `/process-owner` (G-06 Vedi RACI) · ⬜ `/approvals` · ⬜ `/approvals/[id]` · ⬜ `/blueprints` · ⬜ `/blueprints/[variantId]`

### Gruppo: Content
- ⬜ `/content` · ⬜ `/content/[id]`

### Gruppo: Engagement / Goals
- ⬜ `/engagement` · ⬜ `/engagement/[surveyId]` · ⬜ `/goals` · ⬜ `/okrs`

### Gruppo: Brownfield / Seed
- 🔄 `/brownfield-adaptation` (B-01) · ⬜ `/seed-acquisition/runs`

### Gruppo: Admin
- ⬜ `/admin/roles` · ⬜ `/admin/mfa-policy` · ⬜ `/dev/agent`

### Gruppo: ESS /me/* (19)
- 🔄 `/me` (vuoto per admin di sistema) · ⬜ `/me/profile` · ⬜ `/me/positions` · ⬜ `/me/skills` · ⬜ `/me/skills/self-assessment` · ⬜ `/me/gaps` · ⬜ `/me/kpis` · ⬜ `/me/learning` · ⬜ `/me/learning/catalogue` · ⬜ `/me/certifications` · ⬜ `/me/career` · ⬜ `/me/career/target` · ⬜ `/me/team` · ⬜ `/me/matching` · ⬜ `/me/handbook` · ⬜ `/me/handbook/[id]` · ⬜ `/me/security` · ⬜ `/me/inbox` · ⬜ `/me/surveys` · ⬜ `/me/surveys/[surveyId]` · ⬜ `/me/documents`

---

## DETTAGLIO PER PAGINA (sezioni aggiunte man mano)

### /dashboard — 🔄
- Render: ok (card KPI 162 utenti/162 posizioni/26 OU/2 tenant/270 gap/1 blueprint). Trend "—0.0% vs settimana prec." su tutte → **CONFERMATO placeholder** (vedi consolidamento, DATA L-dashboard).
- (forense completo da fare: contrasto sparkline, link card, "Gap critici" cliccabili?)

---

# CONSOLIDAMENTO CLI — S1006 continuazione (74 pagine, verifica multi-livello)

> Eseguito da Claude Code CLI in autonomia (PROD `https://www.heuresys.com`, read-only, fase OSSERVAZIONE). Copertura **74/74 route autenticate** + le 21 ESS sotto **persona dipendente reale** (`paolo.caputo@rtl-bank.org`). Metodo: batch headless Playwright (CORE1-6) → ri-verifica pulita con re-login (anti token-TTL) → pass ESS-employee → scansioni perf/a11y/security → **review visivo multi-agent (17 unità, 98 findings confermati su 104, verifica adversariale)**. Dettaglio tecnico in `FORENSIC-NOTES-S1006-cli.md`; lista macchina-leggibile completa in `_visual-confirmed.json`. Sintesi: **58/74 pagine con ≥1 finding confermato**.

## A) REGISTRO BUG VERIFICATI (blocking / alta priorità)

| ID | Sev | Pagina/Area | Problema (verificato) | Root-cause / Fix |
|---|---|---|---|---|
| **B-01** | 🔴 | `/brownfield-adaptation` | **Mis-wiring del contratto**, non un `?.` mancante. Tab **Inventory** crasha ("This page couldn't load") perché legge `capturedAt/sourceSystem/rowCount`, l'API serve `retrievedAt/name/sizeBytes`; tab **Mapping** ha colonne Source/Status vuote (`sourceTable`→`sourceTableId`, `status`→`approvalStatus`); tab **Run** ok. Confermato codice+schema+runtime live (`js_error: reading 'slice' of undefined`). | Sostituire i type locali con i type condivisi (`BrownfieldSourceExport`, `BrownfieldTableMapping`) e riscrivere le colonne sui campi reali. `page.tsx:12-18,42`. |
| **B-03** | 🔴 | ESS `/me/*` (10+ pagine) | **Dipendenti con ruoli funzionali (MANAGER/TEAM_LEADER/TEAM_MEMBER) senza ruolo `USER` ricevono 403 sul PROPRIO ESS**: profile, skills, kpis, gaps, certifications, positions, career, documents, inbox, learning. `user_profile:read:self` (+ siblings `*:read:self`) è mappato solo a `PLATFORM_ADMIN/READ_ONLY/TENANT_ADMIN/USER`, **non ai ruoli funzionali**. Verificato HTTP 403 live + dati RBAC + assegnazione ruoli di `paolo.caputo` (TEAM_LEADER,TEAM_MEMBER,MANAGER — no USER). | **Decisione di modello (PM)**: (a) ogni dipendente porta anche `USER` (ruoli additivi), oppure (b) `TEAM_MEMBER` (ruolo-base dipendente) riceve il set di permessi self-scope. |
| **B-04** | 🔴 | `/analytics/kpi` | **Gauge "Raggiungimento medio target KPI" mostra `4300370281`** (~4,3 mld) invece di una % 0-100. Le barre per-KPI sottostanti sono % corrette (0-100) → l'aggregato è un errore di calcolo/scala/formato (somma non normalizzata). | Aggregatore KPI: dividere per il conteggio / scalare a percentuale. |
| **B-05** | 🔴 | charts dark-theme (~9 pagine) | **G-07 confermato e diffuso**: le serie dei grafici non applicano la palette dark → rese in **nero su sfondo scuro, invisibili**. Caso peggiore `/analytics/overtime` (donut "Richieste per stato" interamente nero, dati 221 invisibili); anche org-network, attendance (linee), skills (heatmap), compensation, workforce, org-chart edges, visualizations. | Token colore serie chart theme-aware (collegato a [[project_tailwind_dark_media_based]] / `reference_apps_web_color_tokens`). |
| **B-06** | 🔴 | tabelle "colonne vuote" (B-01-class) | **WIRING**: colonne vuote per **ogni** riga perché leggono campi inesistenti nel contratto — `/gaps` (POSIZIONE/SKILL/RICHIESTO/ATTUALE), `/positions/[id]/skills` (CODICE/SKILL su 5 righe), `/positions/[id]/kpis` (CODICE/KPI; TEMPLATE dumpa JSON grezzo), `/learning` (NOME), `/organization` (PARENT troncato a UUID). Stessa classe di B-01. | Riallineare colonne ai campi reali degli schemi condivisi; verificare ogni `DataColumn` cell-accessor. |
| **B-07** | 🔴 | `/organization/org-chart`, `/visualizations/[graphId]` | **G-08 confermato**: nodi org-chart = pallini **senza etichetta** o codici grezzi **`N_<uuid>`** invece di nome posizione/persona/OU. | Risolvere label nodi da nome leggibile (già parziale → incoerente). |
| **B-02** | 🟡 | `/login` | **Sicurezza**: submit pre-hydration / no-JS → **GET con credenziali nell'URL** (`/login?email=…&password=…`) → leak in history/log/referer. | `method="post"` + handler no-JS, o submit disabilitato fino a hydration. |

## B) TEMI SISTEMICI (confermano/estendono i G-01…G-09 di Enzo)

| G-id Enzo | Tema | Stato | Pagine confermate |
|---|---|---|---|
| **G-01** | I18N dei **dati** (contenuto EN in UI IT) | ✅ confermato, **18 findings** | skills, kpis, engagement, processes, process-owner, career-succession, goals, okrs, blueprints, me/matching (ESCO), me/skills/self-assessment (enum), me/surveys, me/learning/catalogue, analytics/skills-by-category, … |
| **G-02** | Codici tecnici grezzi come **identità** di riga | ✅ confermato, **21 findings (READABILITY)** | career-succession (UUID), gaps (hex userId), learning (UUID), skills (UUID), organization (PARENT UUID), positions/[id] (tutti i campi relazionali UUID), positions/[id]/kpis (JSON grezzo), kpis (POLARITÀ enum), goals/okrs (enum), insights/skill-gap, blueprints, … |
| **G-03** | **Toggle lingua duplicato** (header + sidebar) | ✅ confermato, **12 findings (LAYOUT)** | dashboard, system-health, content, content/[id], approvals, seed-acquisition/runs, engagement, me, me/inbox, attendance, positions/[id]/skills, visualizations |
| **G-05** | Perspective non persiste | ✅ root-caused | `layout.tsx:97` `useState("ALL")` senza storage |
| **G-06** | Elementi "sembrano link ma morti" / colonne morte | ✅ in parte = **B-06** | organization (PARENT non-cliccabile, troncato) + le colonne vuote |
| **G-07** | Dark-theme reso male | ✅ = **B-05** (vedi sopra) | 9 pagine |
| **G-08** | Org-chart con codici invece di nomi | ✅ = **B-07** | org-chart, visualizations |
| **G-09** | Manca vista organigramma top-down | (feature, non ri-verificata) | — |

**DATA placeholder/incoerenti (20 findings)** — oltre a B-04: dashboard (tutti i trend "—0.0%" placeholder), career-succession ("Test Auth Path" placeholder + difficoltà vuota), insights (tutte le righe collassano a "Medio"), insights/succession-readiness (righe duplicate near-identical), me/profile (Nome visualizzato vuoto per "Paolo Caputo"), positions/[id] (PESO ECONOMICO/IN VIGORE em-dash), positions/[id]/skills (PROFICIENCY tutte "—"), content/[id] (fixture seed "[me-media-it]…"), me/learning/catalogue (badge 3219 incoerente), me/surveys (sondaggio "0 domande" compilabile), **me/security (sessione con IP `127.0.0.1/32` in PROD → collegato a debt D-28 TRUST_PROXY: l'API dietro nginx non fida X-Forwarded-For → tutti gli IP sessione = loopback)**.

## C) SCANSIONI CTX (pagine rappresentative, auth fresca, PROD)

- **Security (header app-wide)** 🟡: mancano `content-security-policy` + `permissions-policy`. Presenti: HSTS, x-frame-options, x-content-type-options, referrer-policy. SRI: warn 🟢. (Niente probe XSS/redirect attivi su PROD — R18.)
- **A11y (axe + WCAG2.2)** 🟡: `/dashboard` FAIL = 1 serious + 3 moderate + **9 tap-target <24px**; `/users`, `/analytics/workforce`, `/login` PASS. Contrasto-axe OK (il "dark-on-dark" dei chart è sulle serie, non catturato da axe → vedi B-05).
- **Perf**: CWV **eccellenti** (dashboard LCP 360ms / CLS 0 / TTFB 128). Budget FAIL = **peso risorse**: 2.38 MB transfer di cui 2.35 MB JS, incl. chunk singolo **1.68 MB** → code-splitting.
- **SCA**: INCONCLUSIVO (retire.js offline) — da rifare con tool disponibile.

## D) NON-BUG / FALSI POSITIVI (registrati per non confonderli con findings)

- **~45 pagine "401 Unauthorized" del batch lungo = ARTEFATTO** (JWT TTL 15-min scaduto a metà run su storage-state congelato). Ri-verificate pulite (401:0) con re-login periodico. NON è un bug di prodotto.
- `/approvals/[id]` 404 = tabella `sys_approval_requests` vuota (id-fallback). Non testabile senza dati.
- `/engagement/surveys/[id]/results` 404 su survey esistente = **candidato** (o "no-results dovrebbe essere 200-vuoto non 404", o scoping) — da verificare con survey con risultati.
- **MFA è DISATTIVATO sulla VM** (`MFA_ENFORCEMENT_ENABLED=false`, backup `.env.bak.mfa-*`) per l'audit → **RIATTIVARE alla chiusura**.

> Lista completa dei 98 findings confermati (con evidenza per-pagina e note di verifica adversariale): `audit/_visual-confirmed.json`. Le 2 voci `uncertain` (heatmap grigia analytics/skills-by-category; edge org-graph) restano da giudicare a vista.
