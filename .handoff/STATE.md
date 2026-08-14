# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-14 (S1060).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1060)

Sessione di porte lasciate aperte. **Il deploy era fermo da un giorno** per un solo test su 241:
un permesso nato la sera prima era arrivato all'amministratore di tenant senza essere dichiarato
dove la politica lo esige. Corretto, e la produzione è tornata a ricevere il codice nuovo.

Poi il lavoro vero, e in tutti e due i casi il difetto era **più grande della descrizione**.
La regola che protegge la retribuzione dei vertici esisteva, era provata da sette verifiche verdi
— e **due superfici su tre non la chiamavano**. Il direttore del personale leggeva dalla scheda
della persona la busta paga di un vertice, e dal grafico delle retribuzioni un punto che, essendo
l'unico al suo livello, non era una statistica ma una persona. Entrambe chiuse: `#99` **F4 è
chiusa**, e il vaglio delle superfici è stato meccanico, non a memoria.

Le lacune formative non sapevano dire di che competenza parlassero, su tutte le righe. Il nome
c'era, scritto in due formati diversi ereditati dal vecchio sistema: ora le due schermate lo
mostrano, **area personale compresa** — che era la messa peggio, proprio dove il pavimento ESS
dovrebbe funzionare meglio.

**Tema della sessione, e vale oltre questa**: tre verifiche sono nate verdi, quindi le ho sabotate
per vederle fallire prima di fidarmene; e una mia conclusione sui permessi — tratta da **un solo
caso** — è stata smentita da Enzo che riceveva il prompt che io avevo dichiarato impossibile.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **Verificare com'è finito il deploy armato in chiusura**: `bash scripts/verifica-deploy.sh`.
   Alla chiusura era **IN-VOLO** (4 corse verdi, 2 in corso, 0 rosse). Se dice `CI-ROSSA` è un
   errore da correggere subito, non da riportare a Enzo.
2. **`#99` F5 — completezza di `self`** *(passo 6)*, ~200k: ogni tabella che referenzia una
   persona è raggiungibile self-scope **o** la sua esclusione è dichiarata e motivata una per una.
   Chiude anche la voce gemella **`#117`**. F4 non va riaperta · `.programmi/99-*.md`
3. **Tre decisioni di Enzo sbloccano lavoro già pronto**, nessuna tecnica: *(a)* si apre il ciclo
   di valutazione dell'azienda? (senza, l'autovalutazione è una funzione senza casi) · *(b)* le
   squadre seguono il nuovo organigramma? (unico residuo di `#123`) · *(c)* `#156`, quale
   superficie aprire per prima all'agente.

## Open questions

- **`D-69`**: la sua condizione di riapertura si è verificata (capitolo import chiuso). Smontare
  l'impianto ETL è ~3-4h; nessuna urgenza (720 kB, zero righe, spento in produzione).
- **`X5c` e `X7a` restano cieche per sempre?** Entrambe non sanabili e ora lo dichiarano con la
  causa. Se un ciclo di valutazione viene aperto, X7a torna falsificabile da sé.
- **La prova generale del database non esegue la suite di test**: una guardia che vive in un test
  le sfugge per costruzione, ed è ciò che in S1059 ha lasciato passare il difetto costato un
  giorno di deploy fermo. Vale la pena spostare quel controllo dentro la catena?

## Verification

```bash
python docs/kb/tools/session_start.py        # menu + salute, un colpo solo
python docs/kb/tools/handoff_lint.py         # cancello di coerenza, bloccante
python docs/kb/tools/db_health.py            # sentinelle: attese 17/17 a zero
python docs/kb/tools/verifica_incrociata.py  # 36 verifiche; X5c/X7a cieche DICHIARATE
bash scripts/verifica-deploy.sh              # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
```
