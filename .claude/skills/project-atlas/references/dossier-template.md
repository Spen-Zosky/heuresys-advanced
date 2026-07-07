# dossier-template.md — linee di sviluppo: dal brainstorming al register

## Pre-check (bloccante)
- Eta' ATLAS_CURATED vs `thresholds.curated_stale_{warn,block}_days`:
  warn ⇒ dichiarare la data all'inizio del dossier; block ⇒ STOP, proporre refresh prima.

## Struttura dossier `docs/product/DEVELOPMENT_LINES_<SERIE>_<TEMA>.md`
- Header: Stato PROPOSTO (selezione = Enzo, PM owns WHAT) · Provenienza (atlas+sweep, data) ·
  regola T2 (numeri = evidenza datata, non SoT) · Perimetro esplicito.
- §1 Tesi (il perche', con i numeri chiave datati).
- §2 Le linee — per OGNI linea: **Dati** (righe live + data) · **Costruire** (cosa, riuso pattern/componenti) ·
  **Vincoli** (data-class/orgGate ADR-0027, DoD ADR-0026) · **Effort** (in sessioni/ore, forma R20:
  derivato da repliche osservate, mai a impressione) · **Valore**.
- §2-bis Webapp impattate: tabella linea → pagine esistenti → pagine/tab NUOVE (dall'atlas `web`).
- §3 Vincoli trasversali (riferimenti, mai ricopiati).
- §4 Sequenza raccomandata COMPONIBILE (mai aut-aut — feedback_no_forced_exclusive_choice).
- §5 Correzioni SoT emerse scrivendo il dossier.
- §6 Prossimo passo (selezione Enzo → register).

## Conversione in Action register (dopo selezione di Enzo)
Formato blocco (canonico: vocabolario/campi verificati da handoff_lint S2/H1; la forma a due bullet dei GATED segue i blocchi live #39/#40):

```
- **#<id> <serie>/<linea> — <titolo>** · status: ACTIVE|GATED
  - priority: P1|P2|P3 · effort: ~Xh · doc: docs/product/DEVELOPMENT_LINES_<...>.md §<linea>
  - note: <sintesi con evidenza>
  [se GATED, aggiungere due righe separate:]
  - blocker: <dipendenza reale>
  - unblock-trigger: {kind: manual|query|file-exists} — <condizione>
```

Procedura: (1) id = max esistente + 1; (2) inserire nella sezione `🗂 Action register` di
`docs/kb/SOT_BACKLOG.md`; (3) `python docs/kb/tools/handoff_lint.py` DEVE uscire 0;
(4) `python docs/kb/tools/build_menu.py` per mostrare il menu risultante a Enzo.
Governance: la skill prepara e valida; commit secondo le regole correnti del repo
(atomici pre-autorizzati; push MAI senza ok esplicito). handoff resta l'unico riscrittore di STATE/SOT.
