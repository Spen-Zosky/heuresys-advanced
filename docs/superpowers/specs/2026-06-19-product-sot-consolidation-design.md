# Design — Consolidamento della SoT di prodotto (guida-alla-verifica funzionale)

> **Data**: 2026-06-19 · **Stato**: design approvato (Enzo, S998+) — pronto per `writing-plans`
> **Owner**: Claude Code CLI (esecutore) · **Autorità prodotto (cosa)**: Enzo
> **Scopo**: definire come consolidare *tutta* la documentazione di prodotto in una Source of Truth unica, tutta in markdown, il cui cuore è una **guida-alla-verifica** delle funzionalità implementate ↔ latenti/scoperte implementabili. Questa SoT è il prerequisito del piano + todo di sviluppo funzionale (fase successiva, separata).

---

## 1. Contesto e problema

### 1.1 Corpus di prodotto attuale (ri-analisi 2026-06-19)

Tutto in `docs/product/`:

| # | Documento | Ruolo | Formato | Note |
|---|---|---|---|---|
| 1 | `BUSINESS_SCOPE_AND_PRD.md` | PRD master: natura, ICP, posizionamento, moat, personas, gap G1-G6, roadmap, metriche, rischi | md | completo, 2026-06-17 |
| 2 | `COMPETITIVE_SCORECARD.md` | benchmark 27-vendor, adjudicazione dei 4 differenziatori | md | completo |
| 3 | `LATENT_CAPABILITY_CATALOG.md` | 13 capability latenti (VRIO, MLCE, Maturity, RCL, AI Advisor…) | md | ⚠ **wiki-derived, in parte legacy `heuresys-evo`** |
| 4 | `WORKITEM_GAP1_PERSPECTIVES_AND_SCORECARD.md` | piano esecutivo Gap #1 (2 Porte + MLCE + Maturity) | md | proposta |
| 5 | `WORKITEM_GAP1_PHASE0_VERIFICATION.md` | **verifica LIVE sul DB reale** dei building-block di Gap #1 | md | eseguita 2026-06-19 — è il *modello* del metodo di verifica |
| 6 | `PRD_heuresys-advanced_2026-06-17.docx` | bundle Word di #1+#2+#3 | docx | = #1+#2+#3 (verificato word-stream, ratio ≥0.91); niente di nuovo |

**Fonti correlate** (altri domini — da *referenziare*, non duplicare): `docs/kb/SOT_STATE.md` (SoT tecnica: conteggi moduli/endpoint/migration/tabelle, architettura), `docs/due-diligence/` (SoT investor), wiki esterni in `C:\Users\enzospenuso\wiki-space\` (`heuresys-wiki` = fonte di #3; `heuresys-advanced-wiki`/`-graph`).

### 1.2 Le quattro tensioni che il consolidamento deve risolvere

- **T1 — formato**: il `.docx` è l'unico non-markdown del dominio prodotto ed è una copia derivata. Normalizzazione = ritirarlo come fonte; rigenerabile da markdown via pandoc on-demand.
- **T2 — drift dei conteggi**: l'inventario funzionale del PRD (§2.5) ripete numeri (75 moduli / ~399 endpoint / 130 migration / 180 tabelle) che vivono in `SOT_STATE.md`. Il principio del repo (CLAUDE.md → "single SoT per dominio, do not duplicate") impone che il prodotto *referenzi* o *ri-derivi live* quei numeri, mai li hardcodi.
- **T3 — wiki vs codice advanced**: il catalogo latente (#3) sovrastima perché descrive in parte il legacy. La Phase-0 (#5) ha già corretto il tiro per Gap #1 verificando sul DB reale (es. event-sourcing dichiarato presente → **assente** sull'advanced). La SoT-guida deve riportare lo stato **verificato sull'advanced**, non quello dichiarato dal wiki.
- **T4 — il pezzo mancante**: oggi **non esiste** un inventario funzionale unificato che allinei, con stato verificato + evidenza, *tutte* le funzionalità implementate **e** le latenti/scoperte implementabili. È il cuore di questa SoT e l'input del piano di sviluppo.

## 2. Obiettivo e criteri di successo

**Obiettivo**: una SoT di prodotto consolidata, tutta in markdown, con al centro un **Functional Capability Ledger** che funge da guida-alla-verifica e da input del piano di sviluppo funzionale.

**Criteri di successo**:
1. Ogni voce funzionale (implementata / latente / scoperta) ha uno **stato verificabile** con evidenza concreta.
2. Le funzionalità implementate sono ri-verificate **LIVE** (codice `file:line` + query/count sul DB reale) — non su dichiarazioni del wiki (decisione Enzo: *verifica totale live*).
3. Zero duplicazione di numeri/architettura già di proprietà di `SOT_STATE.md`/`due-diligence` (T2) → solo reference o ri-derivazione live.
4. Zero file non-markdown nel dominio prodotto (T1).
5. Il Ledger è strutturato per alimentare direttamente `writing-plans` (backlog candidato = voci non-✅ ad alto valore).

## 3. Decisioni prese

- **D1 — Profondità**: *verifica totale live* dell'intero inventario (≈75 moduli + Platform + 13 latenti + caccia scoperte). Coerente col DoD "live-data only" del repo. (Enzo, 2026-06-19.)
- **D2 — Struttura**: gerarchia consolidata dentro `docs/product/` con entry-point, **non** un monolite, **non** i file sparsi attuali. Disgiunta da `docs/kb/` e `docs/due-diligence/`.
- **D3 — Strategia non sciolta qui**: la decisione strategica (tesi "Organizational Intelligence" → riposizionare; verticale primo) resta **open-question registrata nel PRD**; è di Enzo e non blocca la guida funzionale.

## 4. Design

### 4.1 Architettura documentale (`docs/product/`)

| File | Destino | Ruolo |
|---|---|---|
| `README.md` *(nuovo)* | crea | entry-point/indice del dominio prodotto: cosa c'è, come si legge, link incrociati, regola anti-duplicazione |
| `BUSINESS_SCOPE_AND_PRD.md` | resta + ripulito | doc **strategico** (vision/ICP/posizionamento/moat/roadmap); §2.5 conteggi → reference a `SOT_STATE.md` (T2) |
| `COMPETITIVE_SCORECARD.md` | resta | benchmark competitivo (invariato) |
| **`FUNCTIONAL_CAPABILITY_LEDGER.md`** *(nuovo)* | crea — **il cuore** | guida-alla-verifica: ogni funzionalità con stato verificato + evidenza live |
| `LATENT_CAPABILITY_CATALOG.md` | assorbito → ritirato | il contenuto diventa la sezione "Latenti" del Ledger, **verificata sull'advanced**; il file storico è archiviato o ridotto a redirect |
| `WORKITEM_GAP1_PERSPECTIVES_AND_SCORECARD.md` | resta | primo work-item derivato (esempio del metodo) |
| `WORKITEM_GAP1_PHASE0_VERIFICATION.md` | resta | verifica live di riferimento; il Ledger ne riusa righe ed evidenze |
| `PRD_heuresys-advanced_2026-06-17.docx` | **ritirato** | rigenerabile da markdown via pandoc on-demand; non più fonte (T1) |

### 4.2 Schema del `FUNCTIONAL_CAPABILITY_LEDGER.md`

**Tassonomia dello stato** (un solo stato per voce):

| Stato | Significato | Evidenza minima richiesta |
|---|---|---|
| ✅ **IMPLEMENTATO-VERIFICATO** | codice + endpoint + test + dato live presenti | `file:line` (migration/module/route) + query live + count/risultato reale |
| 🟡 **PARZIALE** | building-block sì, ma orchestration/UI mancante | `file:line` di ciò che c'è + nota su ciò che manca |
| 🔵 **LATENTE — design-pending** | progettato (spec/schema), non costruito | esito absence-check live + reference alla spec/ADR |
| ⚪ **LATENTE — idea** | abbozzo, nessun building-block | reference fonte (catalogo/wiki) |
| 🆕 **SCOPERTO** | capability emersa dalla verifica live del codice advanced, non catalogata prima | `file:line` + query live |
| ❌ **ASSENTE/SOVRASTIMATO** | dichiarato dal wiki ma assente sull'advanced | absence-check live (0 match) + nota discrepanza |

**Colonne per voce**: `Capability · Dimensione · Stato · Evidenza (file:line + query+risultato live) · Valore di mercato · Effort/Implementabilità · Dipendenze · Discrepanza wiki↔advanced · Fonte`.

**Struttura del file**: una sezione per dimensione (vedi §4.3), ogni sezione con la tabella delle sue voci; più una sezione finale "Discrepanze wiki↔advanced" (come Phase-0 §3) e una "Candidati di sviluppo" (le voci non-✅ ordinate per valore/effort → ponte verso il piano).

### 4.3 Metodo di verifica live

Estende il pattern di `WORKITEM_GAP1_PHASE0_VERIFICATION.md`: per ogni voce, **cartografia codice** (`db/migrations` + `apps/api/src/modules` + `packages/shared` + `apps/web/src/app`, con `file:line`) **+ count/absence-check LIVE** sul DB reale (tunnel `:5433` → OCI VM `:5432`, già attivo dal boot hook).

**Raggruppamento in work-group** (parallelizzabili, uno per subagent — R12 + token hygiene):

1. **Process** — blueprint families/variants/processes, activation, org-unit-processes (RACI), activity-classification, approval-runtime
2. **Structure** — org-units, positions, PIP VIEW, tenants + enterprise-typing, teams
3. **Role** — job-families/roles (ESCO-mapped), career-paths, succession (pools/candidates/readiness)
4. **Competence** — skill taxonomy ESCO, occupation-skill requirements, learning, assessment, gap+closure, mentorship, skills-crosswalk
5. **Performance** — KPI, compensation intelligence, engagement/surveys, predictions, flight-risk, reviews, attendance, goals/OKR
6. **Platform** — auth+MFA, RBAC, multi-tenant, audit/lineage, export CSV/XLSX/PDF, inbox/notifications, semantic matching kNN, agent-gateway, visualization, analytics views, a11y
7. **Latenti + Scoperte** — le 13 capability del catalogo (ri-verificate su advanced) + caccia attiva a capability emerse dal codice non catalogate

**Contratto di output di ogni subagent** (deterministico, R5): per ogni capability del suo gruppo, una riga Ledger compilata con stato + `file:line` + il comando/query eseguito + il risultato reale. Nessuna affermazione senza evidenza; ogni claim negativo ("assente") richiede un absence-check eseguito (0 match) citato.

### 4.4 Normalizzazione markdown + anti-drift

- **T1**: ritiro il `.docx` dal dominio prodotto. Deliverable Word resta rigenerabile da markdown (script pandoc bundle dei file strategici, on-demand).
- **T2**: i conteggi funzionali vivono solo in `SOT_STATE.md`; PRD §2.5 e il Ledger li **referenziano o ri-derivano live**, mai hardcoded duplicati. Il `README.md` enuncia questa regola.
- **T3**: il Ledger riporta lo stato **verificato-advanced**; dove il wiki sovrastima, la colonna "Discrepanza wiki↔advanced" lo segnala in chiaro.

### 4.5 Output verso il piano di sviluppo

La sezione "Candidati di sviluppo" del Ledger (voci 🟡/🔵/⚪/🆕 ad alto valore + effort + dipendenze) è l'input diretto di `writing-plans`. Il primo work-item già esiste come esempio end-to-end (Gap #1 → `WORKITEM_GAP1_*`). Il piano + todo di sviluppo funzionale è la **fase successiva**, fuori dallo scope di questa spec.

## 5. Alternative considerate e scartate

- **Monolite unico `PRODUCT_SOT.md`** — scartato: file enorme, viola "doc focalizzati per dominio", difficile da mantenere e da verificare a sezioni.
- **Lasciare i 6 file sparsi + solo un indice** — scartato: è di fatto lo stato attuale; non produce la guida-verifica unificata (T4 resterebbe aperta).
- **Verifica mirata / solo consolidamento documentale** — scartate da Enzo a favore della *verifica totale live* (D1).
- **Fondere prodotto + tecnica + DD in un'unica SoT** — scartato: viola il principio "single SoT per dominio, domini disgiunti" del CLAUDE.md; si referenziano, non si fondono.

## 6. Confini / non-goals

- Non si scioglie la decisione strategica (tesi OI / verticale) — resta open-question del PRD (D3).
- Non si scrive il piano/todo di sviluppo — fase successiva (`writing-plans`).
- Non si modifica codice, schema DB o test — questa SoT è documentale; la verifica è **read-only** (query di sola lettura + lettura codice).
- Non si toccano `docs/kb/` né `docs/due-diligence/` se non per aggiungere reference incrociati.

## 7. Open questions registrate (autorità: Enzo)

- **OQ1** — Tesi "Organizational Intelligence": riposizionare (raccomandazione PRD §1.5) o difendere? Condiziona la priorità delle latenti nel futuro piano, non la guida.
- **OQ2** — Verticale primo: banking mid-market (immediato) vs PA (richiede RCL).
- **OQ3** — Le 5 domande al founder del PRD §2.11 (pricing, IP, full-time, hiring) restano fuori dalla guida funzionale.

## 8. Rischi

- **R-A — Tunnel DB giù durante la verifica**: mitigazione = check `Test-NetConnection localhost -Port 5433` prima di ogni work-group; riavvio tunnel se serve.
- **R-B — Effort della verifica totale live**: è il pezzo più grosso; mitigazione = subagent paralleli per work-group + quantificazione/slice nel piano di implementazione.
- **R-C — Sovra/sotto-stima del wiki nelle latenti**: mitigazione = T3, ogni latente ri-verificata sull'advanced con absence-check.
- **R-D — Drift futuro dei conteggi**: mitigazione = regola anti-duplicazione nel `README.md` + handoff skill che ri-deriva i counts.

## 9. Definition of Done della SoT

1. `README.md` + `FUNCTIONAL_CAPABILITY_LEDGER.md` creati; `LATENT_CAPABILITY_CATALOG.md` assorbito; `.docx` ritirato; PRD §2.5 ripulito dai counts.
2. Ogni voce del Ledger ha stato + evidenza conforme alla §4.2 (le ✅/🟡/🆕 con `file:line` + query live + risultato; le ❌ con absence-check).
3. Tutti i work-group (§4.3) coperti, nessuna dimensione saltata; copertura dichiarata esplicitamente (no truncation silenziosa).
4. Zero numeri funzionali hardcoded che duplichino `SOT_STATE.md`.
5. Tutto in markdown; nessun file non-markdown nel dominio prodotto.
6. La sezione "Candidati di sviluppo" è pronta come input di `writing-plans`.
