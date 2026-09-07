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
- [x] **F2 — Il grafo delle competenze, dai dati che abbiamo** — ✅ **CHIUSA (S1083, 2026-08-28)**:
  fonte (mig `000365`) + endpoint `GET /v1/skills/graph` + 7 test di integrazione **verdi sul
  gemello**. Prova generale VERDE sul gemello, due passate,
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

  **I due difetti che solo i test potevano trovare**, ed è la ragione per cui sono scritti
  confrontando due misure invece di chiedere «risponde 200»:
  ① `isEsco` tornava `null` invece di `false` — in SQL `NULL LIKE 'http%'` vale NULL, e le
  competenze senza URI facevano rifiutare l'**intero** payload dallo schema di risposta: un 500
  su una rotta che funzionava;
  ② `?includeGroups=false` **accendeva** i gruppi invece di spegnerli, perché
  `z.coerce.boolean()` fa `Boolean("false")`, che vale `true`. L'ha colto il test «spegnerli ne
  toglie»; leggere il codice non l'avrebbe fatto.

  *(testo originale della fase)* nessun import: la sorgente è `sys_skill_taxonomy_edges` più il catalogo skill (i conteggi **si misurano quando si apre la fase**, non si citano qui: crescono). Fatto = endpoint che serve nodi e archi con i filtri che una vista a grafo richiede (profondità, tipo di relazione, ancoraggio a una skill o a una persona), schema Zod condiviso, integration test. **Il cancello di esposizione (#79) è già soddisfatto per costruzione**: la tabella è già letta, qui le si dà una superficie a grafo · budget ~200k
- [ ] **F3 — La vista, con il componente che aspetta da sempre** — `KGGraphCanvas` di `@heuresys/ui` è stato costruito apposta e **non è mai stato usato**: qui trova il suo primo consumatore. Pagina sotto `/visualizations` (che esiste già), E2E con login reale · budget ~250k

  ### S1091 (2026-09-07) — la vista esiste, e la voce è costata molto meno del previsto

  ⭐ **Il primo atto è stato scoprire che METÀ del lavoro era già fatto, e per poco non l'ho
  duplicata.** Avevo cominciato a costruire un endpoint del grafo su `skill-taxonomy-edges` —
  schema Zod, repository con CTE ricorsiva, service, rotta. **Il typecheck l'ha fermato**: i nomi
  `SkillGraphQuery`/`SkillGraphResponse` **esistevano già** in `@heuresys/shared`, perché
  `GET /v1/skills/graph` era stato costruito da **F2** ed è più completo del mio (nodi `SKILL`
  e `GROUP`, archi `EXPLICIT` e `GROUP`, conteggi, `orgGate: "catalog"`, `skill:read`). Tutto il
  mio lavoro sull'API è stato **disfatto** con un `git checkout` dei quattro file: F3 è **solo la
  vista**, e il piano lo diceva — sono stato io a leggerlo male. Il cancello ha fatto ciò per cui
  esiste, ma la lettura di `skills/routes.ts` prima di scrivere sarebbe costata trenta secondi.

  **Cosa è stato costruito, e dove.**
  - **La pagina** `apps/web/src/app/(authenticated)/analytics/skills-graph/page.tsx`, primo e
    unico consumatore di `KGGraphCanvas` (verificato con un grep su `apps/` e `packages/` prima
    di scrivere: nessun altro). Nessun componente nuovo in questo repository — il canvas arriva
    dal design system, come vuole la regola.
  - ⚠ **Si parte sempre da una competenza, e non è una comodità dell'interfaccia**: l'endpoint
    accetta `root` assente e allora restituisce l'intero catalogo — **18.438 archi espliciti**
    misurati in produzione (`RELATED` 11.762 · `IS_A` 6.474 · `PREREQUISITE_OF` 198 · `PART_OF` 4)
    più quelli di appartenenza. Disegnarli tutti non è una vista, è un blocco del browser.
  - **La porta**: entra come **scheda** del gruppo `skill` in `section-tabs.tsx`, non come voce
    nuova di sidebar. È la regola di Enzo S1009 («le altre diventano tab dentro la pagina
    principale») ed evita una migrazione di menu. `check_pagine_raggiungibili.py`: schede da
    16 a **17**, «ogni pagina autenticata ha una porta».
  - **i18n** IT+EN completo (`shell:tabs.skill.graph`, `analytics:skillsGraph.*`) —
    `i18n:check` → **Parity OK, 3143 chiavi × 2 lingue × 10 namespace**.

  🔬 **Dimostrazione LIVE su dati reali** — `node apps/api/scripts/prova-live-50-f3-grafo.mjs`,
  login con **persona reale** `federica.marchetti@rtl-bank.org` (**HTTP 200**) contro la
  produzione:
  ```
  grafo «Assembly (programmazione informatica)» — nodi 182 · dichiarati 159 · appartenenza 166
  grafo «Java (programmazione informatica)»     — nodi 184 · dichiarati 157 · appartenenza 175
  ESITO: OK — 5 competenze con vicinato vero, lette da una persona reale
  ```
  Lo script porta un **vocabolario chiuso** e distingue `NON MISURABILE` (login non passato) da
  `VUOTO` (grafo che risponde senza vicini): un login rifiutato non è un giudizio sul grafo.
  ⚠ E la sua prima stesura **derivava la password riscrivendola a memoria** → 401 che sembrava un
  problema di credenziali. La derivazione ora si **importa** da chi la definisce.

  **Le due prove E2E sono scritte per poter fallire** (`apps/web/tests/e2e/skills-graph.spec.ts`):
  la prima non si accontenta che il canvas compaia — confronta i **numeri della pagina** con
  quelli che l'API calcola per la stessa competenza e profondità, perché un disegno con i dati
  sbagliati passerebbe un test sul solo rendering; la seconda cambia la profondità e pretende che
  il conteggio **scenda**, e sceglie apposta una competenza il cui vicinato a 1 e a 2 salti è
  diverso — su una isolata i due numeri coinciderebbero e il test sarebbe verde qualunque cosa
  accada. Nessun nome di competenza è cablato: si sceglie interrogando il catalogo vero.

  ⏳ **La corsa E2E NON è stata eseguita qui, e va detto com'è andata invece di lasciarlo capire.**
  Tentata in locale con `pnpm test:e2e:prod:node22 --grep`; il **preflight della suite** ha
  dichiarato l'ambiente inadatto prima ancora di partire, con tre avvisi: *«API NON raggiungibile
  su localhost:3001 — nessuna config Playwright la avvia»*, *«il bundle dell'API è più VECCHIO
  dell'ultimo commit di ~2 giorni: la suite proverebbe un frontend nuovo contro un'API vecchia, e
  i suoi rossi non sarebbero attribuibili»*, e *«budget dei login NON MISURABILE»*. La corsa è
  stata **fermata**, non lasciata fallire: un rosso prodotto da un ambiente sbagliato non è
  un'informazione, è rumore che poi qualcuno deve smontare.
  **La corsa vera è quella di CI**, che è il modo supportato per questa suite (D-24) ed è come
  `#219` l'ha portata al verde in S1090 — 367 passati, 0 falliti. Va lanciata dopo il push:
  `gh workflow run playwright-integrale.yml` (è manuale perché il runner è uno solo).
  Finché quella non è verde, **F3 resta aperta**: la pagina è costruita e provata sui dati veri,
  ma la prova end-to-end che la voce pretende non è stata eseguita.

  Cancelli: `typecheck` API e web puliti · `lint` 5/5 · `i18n:check` OK ·
  `check_pagine_raggiungibili` OK.

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
