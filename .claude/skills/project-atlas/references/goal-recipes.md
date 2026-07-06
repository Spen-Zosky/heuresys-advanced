# goal-recipes.md — condizioni /goal misurabili (Claude Code ≥2.1.139)

Dottrina: la condizione deve essere verificabile SENZA interpretazione (un valutatore esterno
legge il transcript e decide si'/no). Comandi con exit code o output esatto.

## refresh --full
/goal Il full-sweep atlas e' completo: `python docs/kb/tools/build_atlas.py` esce 0 due volte
consecutive con `git diff --stat docs/kb/atlas` vuoto al secondo run; il coverage check del
planner riporta 0 frammenti mancanti; `python docs/kb/tools/handoff_lint.py` esce 0.

## refresh (delta)
/goal I layer stale <elenco> sono ri-sweepati: i frammenti attesi esistono tutti; build_atlas
rigenerato esce 0; ATLAS_CURATED.md ha header aggiornato con data odierna per quei layer;
handoff_lint esce 0.

## dossier
/goal Il file docs/product/DEVELOPMENT_LINES_<X>.md esiste; ogni linea contiene le sottosezioni
Dati/Costruire/Vincoli/Effort; la tabella webapp e' presente; `python docs/kb/tools/handoff_lint.py` esce 0.

Uso: la skill PROPONE la riga pronta (il comando /goal lo attiva l'utente); in esecuzione
autonoma la stessa condizione e' il contratto di uscita interno del modo.
