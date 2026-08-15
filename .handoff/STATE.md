# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-15 (S1063).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1063 «Il ciclo di redenzione»)

Eseguito per intero il **mandato di autocoscienza** che S1062 aveva lasciato aperto. Il
reperto: **tre skill di questo repo descrivevano il progetto legacy** — una raccomandava
RLS, che l'invariante I5 vieta ovunque, e si sarebbe attivata da sola sulla prossima voce
del menu. Erano lì da due mesi e nessun controllo le guardava, perché **tutti i cancelli
del progetto guardano codice e dati, nessuno guardava le istruzioni**. Ora ce n'è uno, e
gira a ogni avvio.

**La parte che conta è il verdetto, ed è sfavorevole**: misurando le regole nate da un
richiamo di Enzo, **quattro su cinque sono state violate di nuovo** — una a tre giorni, una
due volte nella stessa sessione, una intercettata da Enzo e non dai miei controlli. Le
regole diventate *meccaniche* non hanno recidive. È il motivo per cui il rinforzo di oggi è
un cancello eseguibile e non un paragrafo in più.

**Poi `#189`, e la prova mi ha dato torto** — che è la ragione per cui era costruita così.
L'item diceva «problema di ordine»; corretto quello, la catena superava il punto di rottura
e mi sarei fermato lì. Il controllo successivo ha mostrato che la funzione attesa non era
mai stata creata: la causa vera era un **disallineamento di firma**, e il seed falliva
*sempre*, anche a database perfettamente popolato. Verificata poi l'intera superficie, non
solo la riga rotta: nessun altro caso.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **`#142` F2 — modello dei cruscotti** (~180k), sbloccata da `#99` F7. Leggere prima i tre
   reperti nel register: la derivazione **restringe e non concede**, il permesso per cruscotto
   serve ancora, e nel modulo `dashboard` ci sono due residui da correggere lì · `.programmi/142-*.md`
2. **`#191` — il rendiconto delle chiusure non sa di quale sessione parla** (~30 min): quasi
   tutte le righe dicono `S?` perché nessuno esporta la variabile · `scripts/close-log.sh`

## Open questions

- **Due decisioni di Enzo sbloccano lavoro già pronto**: *(a)* si apre il ciclo di valutazione
  dell'azienda? · *(b)* `#156`, quale superficie aprire per prima all'agente fra le 83 idonee.
- **`#169`** — separare password e secondo fattore: `deriveTotpSecret` è usato da una parte estesa
  della suite, e l'impianto di **esenzione MFA esiste già nel database ed è vuoto**: è quella la strada.
- **Il diario di sessione non scrive**: `.handoff/session-journal.ndjson` è vuoto dal 10 agosto.
  Stessa famiglia di `#191` — strumenti di registrazione che non registrano.
- **`D-69`**: la condizione di riapertura si è verificata. Smontare l'ETL è ~3-4h, nessuna urgenza.

## Verification

```bash
python docs/kb/tools/session_start.py            # menu + salute, un colpo solo
python docs/kb/tools/check_istruzioni.py         # NUOVO: le istruzioni combaciano col reale?
python docs/kb/tools/handoff_lint.py             # cancello di coerenza, bloccante
python docs/kb/tools/db_health.py                # sentinelle
bash db/scripts/storia36.sh custodia             # atteso: VERDE
bash scripts/verifica-deploy.sh                  # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
```

⚠ **La verifica lunga si esegue sul linux-pc, non qui** (standard S1054):
```bash
ssh linux-pc 'source ~/.nvm/nvm.sh; nvm use 22; cd ~/heuresys-advanced/apps/api && pnpm exec vitest run'
```
