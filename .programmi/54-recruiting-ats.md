# 54 — E/E5: recruiting / ATS (cluster `/recruiting`)

> **item**: #54 · **priorità**: P2 · **stima register**: ~5-7 sessioni (fasi con commit atomici)
> **stato**: NON AVVIATO
> **fonti**: `docs/product/DEVELOPMENT_LINES_E_EVO_VERTICALS.md` §E5

## Decisioni vincolanti (non si ri-chiedono)

- **Decisione Enzo S1018**: in coda al batch (wave W11).
- **Concept-porting dal cantiere evo, mai codice.** Il legacy è fonte di *concetti* e di
  *dati*, non di implementazione.
- **I5 vale**: nessuna RLS. L'isolamento tenant è FK + filtro nel middleware.
- ⚠ Il catalogo delle capacità latenti è **wiki-derived e descrive in parte il legacy**: ogni
  capacità che sembra «già esserci» va **ri-verificata sullo schema advanced** prima di
  entrare nel piano.

## Fasi

- [ ] **F1 — INDAGINE: leggere §E5 e misurare cosa esiste davvero sull'advanced** — fatto = elenco delle entità del dominio recruiting già presenti in `sys.*` (misurate, non dedotte dal wiki), delta rispetto a §E5, e decomposizione in fasi con commit atomici. Finché questa non è chiusa, le fasi sotto sono segnaposto · budget ~150k
- [ ] **F2 — Modello dati del dominio** (da dettagliare in F1) · budget ~250k
- [ ] **F3 — API** (da dettagliare in F1) · budget ~250k
- [ ] **F4 — Frontend + E2E con login reale** (da dettagliare in F1) · budget ~250k

## Da dove si riprende

**F1.** E la prima regola è la diffidenza verso il catalogo: quello che il wiki dichiara
presente potrebbe essere del legacy, non nostro.
