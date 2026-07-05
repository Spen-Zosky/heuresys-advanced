# Development Lines — Serie B: attivare il codice dormiente

> **Stato**: PROPOSTO — selezione = Enzo. **Provenienza**: atlas + full-sweep S1016 (2026-07-05), evidenza `file:line` in `docs/kb/atlas/ATLAS_CURATED.md` §3. Regola T2: i numeri sono evidenza datata.
> **Perimetro**: funzionalità GIÀ COSTRUITE (codice+test) ma spente/incomplete: flag OFF, chassis senza trasporto, engine senza dati, endpoint senza motore. Complementare alla Serie A (che espone dati); qui si accende codice.

## Le linee

### B1 — Free-text semantic search (flag OFF)
- **Evidenza**: endpoint completo, testato, rate-limited, dietro `MATCHING_FREETEXT_ENABLED` default OFF (`semantic-matching/service.ts:152`, `routes.ts:112-119`). Substrato pgvector live: 25.276 embeddings.
- **Attivare**: flip del flag + query-time embedding (richiede chiamata Voyage a runtime → **gated su decisione credenziale VOYAGE**, oggi dormiente per scelta S996).
- **Webapp**: `/me/matching` (aggiungere search box libero) · `/skills` (ricerca semantica nel catalogo). Nessuna pagina nuova.
- **Effort**: ~0,5 (post-decisione credenziale). **Valore**: la feature AI più percepibile dall'utente finale.

### B2 — Reward-gate engine sui calcoli esistenti
- **Evidenza**: `sys_variable_pay_calculations` **121** righe vive, ma `sys_reward_gates`/`gate_results`/`payout_curves` = 0 (catalogo 7) — i calcoli girano SENZA gate engine (ATLAS_CURATED §2).
- **Attivare**: motore di valutazione gate (catalogo→gates→results) + curve payout; collegarlo ai 121 calcoli.
- **Webapp**: `/compensation-intelligence` (pannello "Reward gates" + esiti per calcolo). Nessuna pagina nuova.
- **Effort**: ~1,5-2 (è il più "engine" della serie). **Valore**: chiude il ciclo KPI→reward promesso dallo schema.

### B3 — Approval effects: nuovi handler
- **Evidenza**: registry effects con UN solo handler (`tenant-activation.ts:26`); runtime approvals costruito, `sys_approval_requests` = 0 (mai usato).
- **Attivare**: 2-3 handler naturali — `TENANT_MATERIALIZATION` (modulo pronto, seam dichiarato), approvazione time-off (se Serie E/L8 evolve al write), approvazione goal/comp change.
- **Webapp**: `/approvals` + `/approvals/[id]` (già live, si popolano da soli) · `/me/approvals` (track-only esistente).
- **Effort**: ~0,5-1 per handler. **Valore**: il BPM smette di essere vuoto — primo flusso approvativo REALE in prod.

### B4 — EMAIL: digest + EMAIL_OTP (sbloccato da #8)
- **Evidenza**: digest CLI = "chassis until SMTP is provisioned" (`digest-cli.ts:8-11`); transport pronto; `sys_notification_preferences` = 0. Register #8 WAIT-INPUT (app-password Outlook).
- **Attivare**: SMTP config → digest live + EMAIL_OTP come 2° fattore; UI preferenze notifiche (tabella vuota = anche flusso UI mai usato).
- **Webapp**: `/me/security` (EMAIL_OTP enrollment, già predisposta) · `/me/inbox` (preferenze digest). Nessuna pagina nuova.
- **Effort**: ~0,5 post-input. **Valore**: notifiche vive; unico item che dipende SOLO da un input di Enzo.

### B5 — Visualization: versioning + export engine
- **Evidenza**: `graph_version` a schema ma nessun endpoint crea versioni >1 (`visualization-graphs/service.ts:49`); exports = registro senza motore né download (`visualization-exports/service.ts:3`); layouts/styles/exports tutte a 0.
- **Attivare**: endpoint di versionamento + render/download reale dell'export (PNG/SVG/JSON dal renderer già live).
- **Webapp**: `/visualizations/[graphId]` (selettore versione + bottone export funzionante) · `/visualizations` (lista export). Nessuna pagina nuova.
- **Effort**: ~1-1,5. **Valore**: il sottosistema viz diventa prodotto completo (oggi 9 renderer, 1 grafo vissuto).

### B6 — Inbox push (SSE)
- **Evidenza**: polling 30s con commento "post-MVP-3 enhancement" (`me/inbox/page.tsx:41-46`).
- **Webapp**: `/me/inbox` + badge header. Nessuna pagina nuova.
- **Effort**: ~1. **Valore**: reattività percepita dell'intero portale.

### B7 — Observability completa
- **Evidenza**: 4 sezioni system-health droppate per assenza backend (log tail, slow-query, incident timeline, KPI time-series — `SystemHealthLive.tsx:16-22`); `pg_stat_statements` è GIÀ installato nel DB; nessun endpoint Prometheus.
- **Attivare**: `/v1/observability/metrics` (Prometheus) + slow-query endpoint su pg_stat_statements + time-series ring.
- **Webapp**: `/system-health` (riaccendere le 4 sezioni). Nessuna pagina nuova.
- **Effort**: ~1-1,5. **Valore**: gestione prod matura; input per capacity planning.

## Webapp impattate (riepilogo serie)

| Pagina | Linee | Nuova? |
|---|---|---|
| /me/matching, /skills | B1 | no |
| /compensation-intelligence | B2 | no |
| /approvals, /approvals/[id], /me/approvals | B3 | no |
| /me/security, /me/inbox | B4, B6 | no |
| /visualizations, /visualizations/[graphId] | B5 | no |
| /system-health | B7 | no |

**Zero pagine nuove**: la serie B accende funzioni dentro pagine già shipped — il valore/effort è il migliore del portafoglio dopo la Serie A.

## Sequenza raccomandata

B4 (appena arriva l'app-password) → B3 (primo flusso approvativo reale) → B7 → B5 → B6 → B2 → B1 (gated credenziale). Totale ~5-7 sessioni se tutto.
