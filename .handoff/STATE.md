# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-14 (S1059).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1059)

Sessione di sblocco e di limiti. **La CI era rossa dal 13 agosto e teneva fermo il deploy**: il
contratto dell'API non seguiva un vincolo messo nel database due sessioni prima. Corretto e
verde — e misurando sono venuti fuori due difetti in più della diagnosi, fra cui una pagina web
già rotta in produzione, nascosta da una forzatura che impediva ai controlli di vederla.

**Tre limiti al mandato HR ora sono presidiati** (i «qualificatori di cella» di ADR-0036): le
valutazioni non si leggono finché non sono comunicate; la retribuzione dei vertici è visibile
solo a chi sta al loro livello o più in alto — il direttore HR smette di vedere lo stipendio del
CEO; le segnalazioni riservate reggevano già l'isolamento, ma **senza prova**, e ora ce l'hanno.

**Il perimetro gerarchico gira sull'albero delle unità**, come l'architettura dichiarava da tempo.
I due alberi davano lo stesso identico risultato, quindi nessun test sui dati di oggi poteva
distinguerli: la prova **fabbrica** la divergenza dentro una transazione.

**Mandato di Enzo eseguito**: nessuno lavora più con un contratto scaduto, e adesso c'è una
sentinella che se ne accorge da sola — serviva, perché lo stesso problema era già stato sistemato
l'8 agosto ed era tornato in una settimana.

**Tema della sessione**: quattro volte la prova generale del database ha fermato in 12 secondi
difetti che la verifica automatica avrebbe mostrato 25 minuti dopo. E due miei errori li ha
trovati Enzo leggendo: un'affermazione che contraddiceva un numero appena misurato (da lì una
regola nuova nel `CLAUDE.md`), e un'unità di misura scambiata — «142 persone» che erano
appartenenze a squadre.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **Tre decisioni di Enzo sbloccano lavoro già pronto** — nessuna è tecnica:
   *(a)* **si apre il ciclo di valutazione dell'azienda?** Senza, l'autovalutazione resta una
   funzione senza casi (548 valutazioni tutte chiuse, zero cicli) e la pagina manageriale di
   `#92 F6` governerebbe un processo fermo. Le API per aprirlo esistono già.
   *(b)* **le squadre seguono il nuovo organigramma?** 142 appartenenze su 174 (133 persone su
   159) stanno in una squadra di un'unità diversa dalla propria — era il 12%, è l'83%, ed è
   l'effetto della riorganizzazione, non una scelta. È l'unico residuo di `#123`.
   *(c)* `#156` quale superficie aprire per prima all'agente.
2. **`#99` F4, il residuo dichiarato**: la soglia di catena è innestata su 2 punti di
   `compensation`, ma i moduli che mascherano sono **18** — vanno guardati uno per uno (molti non
   espongono importi per persona). Poi F5 · `.programmi/99-*.md`
3. **La superficie delle lacune formative serve 270 righe senza competenza e senza posizione**:
   `learning-gaps/repository.ts:109-110` legge due colonne vuote. Il nome sta nel metadata e si
   può mostrare **senza** inventare l'aggancio al catalogo — cantiere nuovo, contenuto.

## Open questions

- **`D-69`**: la sua condizione di riapertura si è verificata (capitolo import chiuso). Smontare
  l'impianto ETL è ~3-4h; nessuna urgenza (720 kB, zero righe, spento in produzione).
- **`X5c` e `X7a` restano cieche per sempre?** Entrambe non sanabili e ora lo dichiarano con la
  causa. Se un ciclo di valutazione viene aperto, X7a torna falsificabile da sé.

## Verification

```bash
python docs/kb/tools/session_start.py        # menu + salute, un colpo solo
python docs/kb/tools/handoff_lint.py         # cancello di coerenza, bloccante
python docs/kb/tools/db_health.py            # sentinelle: attese 17/17 a zero
python docs/kb/tools/verifica_incrociata.py  # 36 verifiche; X5c/X7a cieche DICHIARATE
bash scripts/verifica-deploy.sh              # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
```
