# 50 — D/D4: legacy knowledge graph (`kg_nodes` / `kg_edges`, 139k)

> **item**: #50 · **priorità**: P3 · **stima register**: ~2-3 sessioni
> **stato**: NON AVVIATO
> **fonti**: `docs/product/DEVELOPMENT_LINES_D_WAVE2_LEGACY_DATA.md` §D4

## Decisioni vincolanti (non si ri-chiedono)

- Il register dice una cosa sola e va rispettata: **richiede il disegno della destinazione
  PRIMA dell'import**. Importare 139k nodi/archi senza sapere dove atterrano produce una
  tabella che nessuno legge — e il **cancello di esposizione (#79)** la respingerebbe.
- Il legacy è **fonte di dati autoritativa** (I12/ADR-0023), ma lo schema advanced resta
  **l'autorità strutturale**: è il legacy che si adatta.

## Fasi

- [ ] **F1 — INDAGINE: cosa contengono davvero i 139k nodi/archi, e a quale domanda servono** — fatto = censimento dei tipi di nodo/arco sul legacy vivo + la domanda d'uso a cui il grafo risponde. Senza la domanda d'uso non esiste disegno di destinazione · budget ~150k
- [ ] **F2 — Disegno della destinazione** — tabelle `sys.*` di atterraggio, e **la superficie API che le espone** dichiarata insieme al modello, non dopo (#79) · budget ~150k
- [ ] **F3 — Import + esposizione + dimostrazione live** — idempotente, con provenance · budget ~250k

## Da dove si riprende

**F1**, e la domanda che la governa non è tecnica: *a quale domanda dell'utente risponde questo
grafo?* Se non ha risposta, l'item va proposto a Enzo come candidato `WON'T-DO` invece che
eseguito.
