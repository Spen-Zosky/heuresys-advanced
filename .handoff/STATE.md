# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-10 (S1053 — la modalità di sessione parallela è stata ritirata).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1053)

**Enzo ha deciso di ritirare la modalità di sessione parallela** e di tornare a due sole
modalità: `canonical` e `lab`. Il ritiro è stato eseguito nell'ordine obbligato — prima
inertizzare, poi smontare, poi cancellare — perché le prove di quel codice erano state
messe *dentro* il cancello di verifica apposta perché una batteria mancante facesse
fallire il giro.

**Cosa è uscito**: 9 file (~2.300 righe), i due hook che sorvegliavano comandi e diario,
le 4 etichette di sessione tornate a 2, il driver tornato a una sessione sola, tre comandi
di `zp_state`, la sezione della configurazione, la vista della plancia. **I sei piani non
sono stati cancellati**: stanno in `docs/archive/modalita-gov-ritirata/`, perché sono il
resoconto di cosa è stato tentato e perché è stato abbandonato.

**Il comando ritirato non fallisce**: non fa più match, quindi degrada a `canonical`.

**La chiusura leggera ora è un comando**: `python docs/kb/tools/chiudi_leggero.py`. Misura le
tre mosse che determinano il menu di domani — tutto committato, registro allineato, vista
rapida di oggi — e **rifiuta di chiudere se una manca**. Non scrive registro né vista rapida:
quel contenuto richiede giudizio, e uno strumento che lo inventasse produrrebbe un menu
plausibile e falso. Non pusha. Provato nei due sensi (esce 1 con la vista rapida vecchia,
0 quando è a posto), e alla prima esecuzione ha detto **no** segnalando se stesso.

**Due difetti trovati dai cancelli, non da me**: una riga orfana che uccideva `zp_state` a
ogni invocazione (Python compilava: `bash -n` non l'avrebbe vista), e un comando che
passava ancora due parametri rimossi — visto dalle prove shell e non dal selftest interno,
che prova le funzioni e non la riga di comando. Due batterie con angoli diversi.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## ⚠ Cosa resta aperto del ritiro

1. **I 4 rami `gov/*` e i 2 alberi di lavoro** non sono stati toccati — contengono **473
   righe mai entrate in main** (`#182`), di cui 317 sono il versante E2E di `Z-112`.
   Recuperarle o archiviarle è **decisione di Enzo**.
2. **Il ruolo di database `gov_worker`** esiste ancora, in sola lettura, insieme al suo
   segreto locale. Lo script che lo ricreava è stato cancellato: se si decide di
   rimuoverlo, va fatto sapendo che non c'è più il modo automatico di rifarlo.
3. **Il registro**: le voci `#173` `#175` `#179` `#180` vanno chiuse come WON'T-DO con la
   motivazione, e `Z-250` (chiuso) cita una corsa presidiata di un impianto che non esiste
   più — va aggiunta la riga che lo dice.
4. **Il freno del cancello di verifica è INSERITO** (`.zp/verify-off`): il messaggio rosso
   era diventato continuo su un verdetto vecchio. Finché quel file c'è, **il cancello dice
   sempre verde**. Si toglie con `rm .zp/verify-off`, poi `python docs/kb/tools/verify_gate.py run`.

## ⚠ Un errore di questa sessione, da sapere prima di toccare i test

Il commit `27c6025d` ha **inghiottito 174 righe che non erano sue**: le correzioni su
`drift-check` (`#181`), che erano lavoro in corso non committato. Un `git add -u` ha preso
tutti i file modificati invece dei soli file del ritiro. **Non sono perse, ma non sono state
provate** — quel codice gira come teardown della suite di integrazione, e la suite non è
stata eseguita. Prima di lavorare su `#181`, farla girare e vedere se regge.

## Top priorities (prossima sessione)

1. **Chiudere il ritiro**: i tre punti qui sopra, più la riverifica finale.
2. **`Z-251`** (~2h, **P1**): la suite non regge la contesa sul DB condiviso — è la voce che
   rende ambiguo ogni verdetto. È classe D: serve un'autorizzazione per lotto di Enzo.
3. **`#181`** (~2-3h): i 7 rilievi sul controllo di drift, di cui uno confermato da due
   revisori. Le correzioni iniziate giacciono non committate nel working tree.
4. **`#124` mascheratura, strato 1**: spaccare `IDENTITY` chiude 6 celle su 8.

## Open questions

- **I due rami recuperati**: recuperare le 473 righe o archiviarle dichiarandolo?
- **Il ruolo `gov_worker`**: si revoca o resta?
- **`#175`**: il verde di `Z-230` fu dato col cancello evidenze cieco — e ora sappiamo che
  quel lavoro non è nemmeno in main.

## Verification

```bash
python docs/kb/tools/session_start.py                       # menu + salute, un giro
python docs/kb/tools/chiudi_leggero.py                      # il cancello della chiusura leggera
sh scripts/hooks/hook.sh selftest                           # guardia e parser (83 prove)
bash scripts/test/run-shell-tests.sh                        # prove shell (148)
python docs/kb/tools/zp_selftest.py                         # impianto zp (20)
bash scripts/zero-pending-driver.sh --dry-run               # il loop, a una sessione
```
