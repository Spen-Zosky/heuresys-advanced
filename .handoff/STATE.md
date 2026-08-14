# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-15 (S1061).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1061)

Sessione a mandato aperto: *«processa tutti i punti di P1, P2, P3 e anche i debiti, in
autonomia, senza presidio»*. Il menu vale più di quanto entri in una sessione, quindi il ciclo
è stato diviso a monte in due metà **entrambe consegnate**: ciò che si poteva chiudere è stato
chiuso, e ciò che resta ha la sua ripresa scritta in un file — nessuna voce lasciata aperta a
memoria.

**I due debiti aperti sono a zero** e tre voci sono chiuse. Le lacune formative non sapevano
dire a quale posizione si riferissero: la scelta era posta come «o si inventa la posizione, o
si toglie la colonna», e misurando è saltato fuori che **nessuna delle due andava bene** —
quella colonna si può scrivere via API, toglierla avrebbe reso invisibile una lacuna futura.
Si è registrato il dato e corretta la superficie, che mostrava agli utenti otto caratteri di un
codice interno.

La parte più grossa è **la completezza dei dati personali**: ventidue tabelle descrivevano una
persona senza che quella persona potesse leggerle. Diciotto sono state escluse **una per una
con la ragione scritta**, e quattro sono diventate pagine vere — fra cui i **rapporti di
mentoring reali**, che il portale non mostrava affatto: si vedeva chi si *potrebbe* avere come
mentore, non chi si ha davvero.

**Il tema della sessione**: la misura ha smentito i registri **sei volte**, e due di quelle
smentite riguardavano il mio stesso lavoro — una verifica verde che non poteva fallire, e uno
strumento che dichiarava «zero pagine» senza protestare. Due decisioni, invece, **non sono
state chieste a Enzo perché le aveva già prese** altrove, su voci sorelle.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **Verificare com'è finito il deploy armato in chiusura**: `bash scripts/verifica-deploy.sh`.
   Se dice `CI-ROSSA` è un errore da correggere subito, non da riportare a Enzo.
2. **`#92` F6 — frontend del ciclo di valutazione**, ~200k: è la voce che questa sessione ha
   **deciso di non aprire** per non lasciarla a metà, non una che si è arenata. Pagina
   manageriale + pagina ESS, i18n in parità · `.programmi/92-*.md`
3. **`#99` F6 — i quattro domini nuovi** (mentore, delega, approvatore, pari), ~250k. Parte
   avvantaggiata: il dominio «mentore» ha già dato e superficie da F5, gli resta il perimetro
   · `.programmi/99-*.md`

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
