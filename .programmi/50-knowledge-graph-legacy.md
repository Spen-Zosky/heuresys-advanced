# 50 — D/D4: legacy knowledge graph (`kg_nodes` / `kg_edges`, 139k)

> **item**: #50 · **priorità**: P3 · **stima register**: ~2-3 sessioni
> **stato**: IN CORSO
> **fonti**: `docs/product/DEVELOPMENT_LINES_D_WAVE2_LEGACY_DATA.md` §D4

## Decisioni vincolanti (non si ri-chiedono)

- Il register dice una cosa sola e va rispettata: **richiede il disegno della destinazione
  PRIMA dell'import**. Importare 139k nodi/archi senza sapere dove atterrano produce una
  tabella che nessuno legge — e il **cancello di esposizione (#79)** la respingerebbe.
- Il legacy è **fonte di dati autoritativa** (I12/ADR-0023), ma lo schema advanced resta
  **l'autorità strutturale**: è il legacy che si adatta.

## Fasi

- [x] **F1 — INDAGINE: cosa contengono davvero i 139k nodi/archi** — FATTO 2026-08-14 (S1058). **Esito: i dati non esistono nella fonte.** Vedi sotto.
- [ ] **F2 — Disegno della destinazione** ⛔ **SOSPESA** — non c'è nulla da far atterrare finché non si trova la sorgente · budget ~150k
- [ ] **F3 — Import + esposizione + dimostrazione live** ⛔ **SOSPESA** · budget ~250k

## ⚠ Esito di F1 — l'item poggia su un dato che non c'è

Misurato il 2026-08-14 sulla **fonte legacy autoritativa** dichiarata dal `CLAUDE.md`
(container `heuresys_evo_platform_db`, database `heuresys_platform`, sulla VM OCI):

- **`kg_nodes`, `kg_edges` e `mv_occupation_similarity` NON ESISTONO.** Ricerca per espressione
  regolare `(^kg|node|edge|graph|similarity)` su **tutte** le tabelle di **tutti** i database del
  container: 5 riscontri, e sono `onet_knowledge`, `onet_occupation_knowledge`,
  `rag_knowledge_bases`, `v_dei_demographics`, `v_tenant_demographics` — nessun grafo.
- **Controprova, senza la quale lo zero non dimostrerebbe niente**: quel database ha **703
  tabelle, 270 dipendenti, 274 utenti**. È popolato, ed è quello giusto.

Il documento di prodotto §D4 dichiara «kg_edges **139.451** + kg_nodes **17.260** (+
mv_occupation_similarity **69.182**)». Quei numeri **non trovano riscontro**. È esattamente il
rischio che il `CLAUDE.md` nomina per `docs/product/`: il catalogo delle capacità latenti è
**wiki-derived e descrive in parte il legacy**, e va ri-verificato prima di impegnarlo in
roadmap. Qui la verifica lo smentisce.

**Lato advanced**, per completezza (misurato lo stesso giorno): `sys_visualization_graphs` ha
**2 righe**, entrambe `ORG_CHART` — e sono **due versioni** dello stesso organigramma RTL, non
un duplicato (l'unicità è su `tenant+code+version` e l'API legge per `graph_id`: falso allarme
scartato). `sys_skill_taxonomy_edges` ha **18.420** archi, non 11.965 come dice il documento.
La pagina `/visualizations` esiste.

## Da dove si riprende — proposta a Enzo, non decisione mia

**#50 va proposto come `WON'T-DO`**, oppure riscritto: la sua premessa — «139k nodi e archi da
importare» — non è verificabile sulla fonte che abbiamo. Le due strade alternative, se Enzo
vuole tenerlo vivo:

1. **trovare la sorgente vera** (un altro dump, un altro ambiente): allora F1 riparte da lì;
2. **cambiare oggetto**: `sys_skill_taxonomy_edges` ha già 18.420 archi e il componente
   `KGGraphCanvas` di `@heuresys/ui` è stato costruito apposta e **non è mai stato usato** —
   un grafo delle competenze si può fare **con i dati che abbiamo**, senza alcun import.
   Questa è la strada che spenderei io, e non è più «D4»: è una voce nuova.
