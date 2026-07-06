# curated-template.md — ATLAS_CURATED: struttura e regole di aggiornamento

## Struttura canonica (12 sezioni — vedi l'istanza live docs/kb/atlas/ATLAS_CURATED.md)
1 Colpo d'occhio (SOLO rimandi ai conteggi ri-derivabili) · 2 Mappa d'oro tabelle vuote ·
3 Capacita' dormienti nel codice · 4 Gap/opportunita' API · 5 Web/UX pattern e gap ·
6 Design system inutilizzato · 7 DB health · 8 Legacy (residuo + cantiere) ·
9 Wiki e grafi (viste parallele) · 10 Incoerenze minori (debt candidates) ·
11 Drift documentali rilevati · 12 Semi tematici per linee di sviluppo.

## Regole di aggiornamento (refresh)
- Il curated NON si rigenera da zero: si fa MERGE per sezione dei notables nuovi (con evidenza)
  sopra l'esistente; i rilievi superati si BARRANO con data e motivo (mai cancellati silenziosamente).
- Header obbligatorio: data ultimo sweep + quali layer erano nel delta (i layer NON ri-sweepati
  restano marcati con la loro data precedente — onesta' della freschezza per sezione).
- I numeri sono EVIDENZA DATATA, mai SoT: per i conteggi correnti rimanda a SOT_STATE / build_atlas.
- OUTPUT RULE S1011 vincolante su ogni testo.
- Chiusura file: nota "Aggiornare SOLO con un nuovo sweep verificato o correzioni puntuali datate."
