# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-16 (S1064).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1064 «Le cose che non avevano una porta»)

**L'epica dei domini è chiusa**: dieci fasi su dieci, dalla definizione fino alla verifica dal
lato dell'utente con cinque login reali. Con lei è caduta l'ultima delle **sei liste di nomi di
ruolo** che decidevano cosa una persona vede — l'etichetta del cruscotto ora si deriva, e al tier
di squadra risponde con un *dominio*, perché lì il perimetro non lo giustifica un ruolo.

Il filo della sessione è stato lo stesso in tutte le voci: **una cosa che qualcuno doveva
ricordarsi diventa una cosa che una macchina misura.** Il rendiconto delle chiusure non sapeva di
quale sessione parlasse; il diario si scriveva solo se me ne ricordavo; le pagine orfane erano un
censimento a mano in un file fuori dal repo. Ora sono tre cancelli — e un quarto ha chiuso, poche
ore dopo, il buco che l'epica aveva lasciato **dichiarato**: non era «una voce nuova potrebbe
sfuggire», era il **60% delle resource** che nessuno guardava.

**Due volte la prova mi ha dato torto, ed è il motivo per cui era costruita così.** La prova
generale ha respinto la migrazione dei cruscotti **tre volte** — un mio conteggio sbagliato, una
post-condizione di un file precedente, e un grant a tappeto che regala ogni permesso nuovo a
`PLATFORM_ADMIN` a ogni deploy. L'E2E nuovo è andato rosso al primo giro su una persona vera, e
la misura ha detto che la correzione ovvia avrebbe tolto l'organigramma a 117 persone su 161:
non l'ho fatta, è una decisione di prodotto ed è tua (`#193`).

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **`#142` F3b — i dati dentro le viste**. ⚠ **La stima va rifatta**: avevo scritto ~140k, ma
   sono **27 viste** e il progetto vieta i segnaposto — o si implementano tutte, o nessuna.
   Misurata come lavoro vero: **~250-400k**, cioè una sessione piena o due. La modalità di ogni
   vista è **già decisa** da `modalitaDellaVista`: F3b la legge, non la ricalcola ·
   `.programmi/142-cruscotti-per-tipologia.md`
2. **`#143` F2 — modello dati «una squadra è un progetto»** (~1 sessione): oggi `sys_teams` non sa
   dire scopo, obiettivo, date né avanzamento · `.programmi/143-squadra-come-progetto.md`
3. **`#159` F2 — il ponte gateway↔pagine web** (~3-4 sessioni, nessuna migrazione)

## Open questions

- **`#193` è la decisione più vicina**: l'organigramma aziendale resta visibile a chiunque, o solo
  a chi ha un dominio? La tua direzione del 5 agosto sulla «rubrica aziendale» punta al *restare*,
  ma `/users` — stessa materia — oggi è riservata. Le due sono governate in modo opposto.
- **Le altre due che sbloccano lavoro pronto**: *(a)* si apre il ciclo di valutazione dell'azienda?
  · *(b)* `#156`, quale superficie aprire per prima all'agente fra le 83 idonee.
- **`#169`** — separare password e secondo fattore: l'impianto di esenzione MFA **esiste già nel
  database ed è vuoto**, è quella la strada.
- **`D-69`**: la condizione di riapertura si è verificata. Smontare l'ETL è ~3-4h, nessuna urgenza.

## Verification

```bash
python docs/kb/tools/session_start.py               # menu + salute, un colpo solo
python docs/kb/tools/check_pagine_raggiungibili.py  # NUOVO: ogni pagina ha una porta?
python docs/kb/tools/check_istruzioni.py            # le istruzioni combaciano col reale?
python docs/kb/tools/handoff_lint.py                # cancello di coerenza, bloccante
bash scripts/verifica-deploy.sh                     # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
```

⚠ **La verifica lunga si esegue sul linux-pc, non qui** (standard S1054):
```bash
ssh linux-pc 'source ~/.nvm/nvm.sh; nvm use 22; cd ~/heuresys-advanced/apps/api && pnpm exec vitest run'
```
