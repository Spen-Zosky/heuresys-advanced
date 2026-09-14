# K — ruoli senza titolare e direzione del dato

Questa cartella e' lo stato committato del **mandato K v2** (`.programmi/mandati/K-mandato-v2.md`): leggerlo per intero prima di toccare qualunque cosa qui dentro.

- `STATO.md` — una riga per voce; l'ordine delle righe e' l'ordine di esecuzione. E' l'unica fonte di «dove siamo» (sezione 3 del mandato).
- `tools/dove_siamo.py` — la procedura di ripresa R2: risposte di Enzo non applicate, voci aperte, prima PRONTA, migrazioni prenotate (file / `-- FINE` / effetto), workflow orfani, guardiano.
- `tools/misura_k.py` — TUTTE le misure di partenza in `evidenze/baseline_<ts>.txt`, ciascuna col comando che l'ha prodotta.
- `tools/q.py` — l'unica via al database per gli agenti dei workflow: rifiuta tutto cio' che non e' SELECT/WITH (F0.5).
- `evidenze/` — un file per passo che produce numeri; le cartelle `wf_*` dei workflow (con `_LANCIO.txt`, e `_VERIFICATO.txt` solo quando la sessione principale ha verificato).
- `esiti/` — i deliverable delle indagini e i rapporti per Enzo; `esiti/RISPOSTE_ENZO.md` e' dove Enzo (o Cowork sotto dettatura) risponde alle voci in `ATTESA_ENZO`.
- `workflows/` — gli script `.js` dei workflow W0..W5, copiati dal mandato (F0.7).

Regole che valgono sempre: niente cancellazioni (V1), comandi corti e messaggi di commit in un file (V2), `git add <path>` poi `git commit -F <msg> -- <gli stessi path>` (V3), ritirare non e' cancellare (V5), `pg_dump` e numero prenotato prima di ogni migrazione (V6), guardiano all'inizio di ogni voce e sotto il 50% prima di ogni workflow (V4).
