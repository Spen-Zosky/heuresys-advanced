# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-15 (S1061).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1061)

Sessione a mandato aperto: *«processa tutti i punti di P1, P2, P3 e anche i debiti, in
autonomia, senza presidio»*. Il menu vale più di quanto entri in una sessione, quindi il ciclo
è stato diviso a monte in due metà **entrambe consegnate**: ciò che si poteva chiudere è stato
chiuso, e ciò che resta ha la sua ripresa scritta in un file — nessuna voce lasciata aperta a
memoria.

**I due debiti aperti sono a zero** e tre voci sono chiuse. La parte più grossa è **la
completezza dei dati personali**: ventidue tabelle descrivevano una persona senza che quella
persona potesse leggerle. Diciotto sono state escluse **una per una con la ragione scritta**,
e quattro sono diventate pagine vere — fra cui i **rapporti di mentoring reali**, che il
portale non mostrava affatto: si vedeva chi si *potrebbe* avere come mentore, non chi si ha
davvero.

**Il tema della sessione**: la misura ha smentito i registri **sei volte**, e due di quelle
smentite riguardavano il mio stesso lavoro — una verifica verde che non poteva fallire, e uno
strumento che dichiarava «zero pagine» senza protestare. Due decisioni, invece, **non sono
state chieste a Enzo perché le aveva già prese** altrove, su voci sorelle.

**Poi la sessione è proseguita su richiesta** («continua con #92 F6», e l'istruzione che ne è
nata: *quando il guardiano dice `✓ si continua` si va avanti automaticamente*). Chiuso per
intero il **ciclo di valutazione**, che ora ha le sue due pagine e le sue prove con login
reale, e la fase dei **domini funzionali**, delega compresa — quella non esisteva affatto, né
come tabella né come istituto.

**Tre volte una prova è stata scoperta incapace di fallire** (il lato mentore, la compilazione
scambiata per difetto, la revoca che si auto-saltava): ogni volta il difetto era del test, non
del prodotto.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **Verificare com'è finito il deploy armato in chiusura**: `bash scripts/verifica-deploy.sh`.
   Se dice `CI-ROSSA` è un errore da correggere subito, non da riportare a Enzo. ⚠ Questo
   giro porta in produzione **due migrazioni** (`000313` voci di menu, `000314` deleghe) e
   due pagine nuove: vale la pena guardarlo.
2. **`#99` F7 — dashboard derivate dalla matrice**, ~250k: è la penultima fase del programma.
   La sovrapposizione con `#142` è già sciolta e non va ridiscussa — **F7 dà il meccanismo**,
   `#142` dà il catalogo, ed è per questo che `#142` F2/F3 sono `GATED` su questa fase
   · `.programmi/99-*.md`
3. **`#54` F2 — modello dati del recruiting** (~250k) oppure **`#159` F2 — il ponte**, che ora
   è un'**estrazione** e non una costruzione: le 300 righe di `/dev/agent` sono già un ponte
   funzionante nel posto sbagliato.

## Open questions

- **Tre decisioni di Enzo sbloccano lavoro già pronto, e nessuna è tecnica**: *(a)* si apre il
  ciclo di valutazione dell'azienda? Senza, l'autovalutazione è una funzione senza casi su cui
  mostrarla · *(b)* `#143`, il modello «una squadra è un progetto» a due entità: il censimento
  e i reperti sono chiusi, resta solo la domanda · *(c)* `#156`, quale superficie aprire per
  prima all'agente — decide su quale delle **83 schede idonee** mostrarlo.
- **`D-69`**: la condizione di riapertura si è verificata (capitolo import chiuso). Smontare
  l'impianto ETL è ~3-4h; nessuna urgenza (720 kB, zero righe, spento in produzione).
- **La prova generale del database non esegue la suite di test**: una guardia che vive in un
  test le sfugge per costruzione. Vale la pena spostare quel controllo dentro la catena?

## Verification

```bash
python docs/kb/tools/session_start.py            # menu + salute, un colpo solo
python docs/kb/tools/handoff_lint.py             # cancello di coerenza, bloccante
python docs/kb/tools/check_completezza_self.py   # atteso: SCOPERTE 0
python docs/kb/tools/check_idoneita_agente.py    # atteso: 83 idonee su 115
python docs/kb/tools/programmi.py --verifica     # atteso: 7 programmi, nessun difetto
bash scripts/verifica-deploy.sh                  # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
```
