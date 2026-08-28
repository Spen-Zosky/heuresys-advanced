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
- [ ] **F2 — Il grafo delle competenze, dai dati che abbiamo** — ⚙️ **LA FONTE È FATTA (S1083,
  2026-08-28, mig `000365`); resta l'endpoint.** Prova generale VERDE sul gemello, due passate,
  27/27 sentinelle.

  ⭐ **E la premessa di questa fase era sbagliata: la sorgente NON è `sys_skill_taxonomy_edges`
  soltanto.** Misurato oggi lavorando su `#227` F2, stessa sessione: **4.464 competenze su 14.033
  (31,8%) non hanno un solo arco** in quella tabella. Un grafo costruito sui soli archi
  mostrerebbe un terzo del catalogo come polvere di nodi scollegati — brutto, e **falso**: di
  quelle 4.464, **4.383 (98,2%) hanno un `skill_group_id`**, e tutte stanno in un gruppo con un
  padre nell'albero ESCO (`sys_skill_groups`: 640 gruppi, 636 con padre, l'albero europeo intero).
  Non sono isolate nella tassonomia: lo sono nel solo grafo competenza→competenza. Le competenze
  davvero senza collocazione sono **81**, lo 0,58%.

  Quindi il grafo ha **due famiglie di arco**: `EXPLICIT` (`IS_A`, `RELATED`, `PREREQUISITE_OF`,
  `PART_OF`) e `GROUP` (competenza→gruppo, gruppo→gruppo padre). L'effetto è misurato, non
  argomentato: **18.420 archi espliciti → 32.703 accendendo i gruppi**, su 14.673 nodi.

  Il contratto è pensato per come una vista a grafo interroga davvero:
  `sys.fn_skill_graph_nodes(root, depth, include_groups)` e
  `sys.fn_skill_graph_edges(root, depth, kinds, include_groups)` — camminata in ampiezza **non
  orientata** (chi guarda un grafo vuole il vicinato, non i discendenti), `include_groups`
  **acceso di default** perché il difetto da evitare è proprio il grafo che sembra bucato.
  ⚠ **Funzioni e non viste**, e non è stile: `db_health` raccoglie ogni `sys.v_*` e pretende zero
  righe; una vista che serve un grafo ne ha decine di migliaia e sarebbe rossa a ogni avvio.

  **Resta da fare**: le rotte `/v1/*` con schema Zod condiviso e gli integration test — sono
  `apps/api`, e in S1083 la corsa E2E integrale di `#219` era in volo sugli stessi processi.

  *(testo originale della fase)* nessun import: la sorgente è `sys_skill_taxonomy_edges` più il catalogo skill (i conteggi **si misurano quando si apre la fase**, non si citano qui: crescono). Fatto = endpoint che serve nodi e archi con i filtri che una vista a grafo richiede (profondità, tipo di relazione, ancoraggio a una skill o a una persona), schema Zod condiviso, integration test. **Il cancello di esposizione (#79) è già soddisfatto per costruzione**: la tabella è già letta, qui le si dà una superficie a grafo · budget ~200k
- [ ] **F3 — La vista, con il componente che aspetta da sempre** — `KGGraphCanvas` di `@heuresys/ui` è stato costruito apposta e **non è mai stato usato**: qui trova il suo primo consumatore. Pagina sotto `/visualizations` (che esiste già), E2E con login reale · budget ~250k

## ⚠ CORREZIONE dell'esito di F1 (stessa sessione, dopo aver cercato ancora)

**La prima conclusione era vera ma incompleta, e la ragione cambia la decisione.** Avevo scritto
«l'item poggia su un dato che non c'è». Vero *oggi* nel container, ma il motivo non è che il dato
sia andato perduto: è che **era un derivato, e la decisione di non importarlo era già stata presa
durante l'analisi brownfield.**

L'inventario legacy (`docs/brownfield/_inspection_artifacts/tables_inventory.csv`) le registra
entrambe, coi numeri esatti del documento di prodotto:

```
kg_edges,139451,True,False,EXCLUDE,"ESKAP: Knowledge Graph edges (skill↔skill, skill↔occupation, employee↔skill, role↔process)."
kg_nodes,17260,True,False,EXCLUDE,"ESKAP: Knowledge Graph nodes (ESCO catalog + tenant projection)."
```

E il `BROWNFIELD_EXCLUSION_REPORT.md` dà la motivazione, per entrambe:

> `kg_edges` — Knowledge graph **derivato** · **ricomputabile da `esco_*`**
> `kg_nodes` — idem

**Quindi non c'è nessuna sorgente da ritrovare, e non c'è nulla da importare.** Il grafo è una
proiezione dei dati ESCO, che in advanced **ci sono già**: 14.039 skill in catalogo e
**18.420 archi** in `sys_skill_taxonomy_edges` — che *è* il grafo, già ricomputato.

**Decisione di Enzo (2026-08-14): #50 si mantiene.** Riorientato di conseguenza: non «importa il
grafo legacy» ma **«usa il grafo che abbiamo»**, che è ciò che l'esclusione brownfield prevedeva
fin dall'inizio.

## Esito originale di F1 — la misura che ha portato alla correzione

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

## Da dove si riprende

**F2.** L'item non è più «D/D4 — importa il knowledge graph legacy»: quell'import **non deve
avvenire**, e non per un ostacolo ma per una decisione già presa e ora ritrovata. È
**«dai una vista a grafo al grafo che abbiamo già»**.

Il titolo dell'item nel register andrebbe cambiato di conseguenza: continuare a chiamarlo
`kg_nodes/kg_edges 139k` farebbe ricominciare da capo la stessa indagine fra sei mesi.
