# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-10 (S1052 — la prima corsa presidiata è avvenuta, e ha rotto cinque cose che nessuno vedeva).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Stato del PROCESSO gov → `.zp/GOV-DA-FARE.md`.

## Last session brief (S1052)

**Due lavoratori hanno lavorato in parallelo per la prima volta**, su due cluster di classe
A con perimetri disgiunti, con un guadagno misurato di **1,83×** sul lavoro in fila. Prima
però il freno andava sbloccato da un cerchio che si chiudeva su sé stesso — pretendeva
l'effetto prima della causa. Deciso da Enzo: il freno si chiama `autorizzato_non_presidiato`
e ora governa esattamente quello.

**Il valore della corsa non sono i cluster chiusi — sono zero — ma i cinque difetti
strutturali che ha fatto emergere**, invisibili a ogni batteria: il driver si bloccava con
il rapporto che scrive lui, il recinto fermava il lavoro *dentro* il perimetro, il rientro
era diventato cieco, la batteria della guardia era rossa, l'istruttoria accusava di «nessun
diario» chi ne aveva 135 righe. Tutti corretti e provati.

**Il processo ha giudicato invece di cedere**: entrambi i lavoratori hanno preso ROSSO per
ragioni vere (prove insufficienti · lavoro non committato), e uno si è rifiutato di
dichiarare chiuso un lavoro completo perché non aveva potuto far girare i revisori.

**Prima della corsa la documentazione è stata riallineata**: diceva due modalità di sessione
mentre il codice ne ha tre, prescriveva uno schema ritirato, un conteggio fermo dove il
database dice altro, e una persona di prova che non esiste più.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Regole che questa sessione ha pagato care

**Si modifica con gli strumenti di edit, mai con script Python dentro heredoc Bash**: due
livelli di escape annidati hanno rotto le stringhe tre volte (`AUTONOMY_R23_PROJECT.md`).
**Una prova che non può fallire non è una prova**: tre cancelli erano verdi per costruzione.
**Un conteggio che scarta in silenzio ciò che non sa leggere** è peggio di uno assente.
**L'esito si legge dal codice d'uscita**, mai da `head`/`tail` in coda a una pipe.

## Top priorities (prossima sessione)

1. **Chiudere `Z-112`** (~30min): il lavoro è completo, committato e valido (perimetro
   rispettato, cancelli verdi). Manca **la seconda prova** su un livello diverso (ADR-0026).
   Registrata quella, `bash scripts/gov-chiudi.sh 1` e il cluster chiude — **e con lui
   `Z-250`**, che aspetta solo un cluster chiuso con il suo commit.
2. **`#124` mascheratura, strato 1** (~1 sessione): spaccare `IDENTITY` in `IDENTITY_PRO` /
   `IDENTITY_PRIV` chiude **6 celle su 8** senza alcun meccanismo nuovo.
3. **`Z-251`** (~2h): la suite non regge la contesa sul DB condiviso — un file è caduto per
   `connect timeout` e da solo passa. Rende ambiguo ogni verdetto.

## Open questions

- **Il freno resta INSERITO per il non presidiato.** Ora che la corsa sorvegliata ha
  funzionato, vuoi che il loop giri anche non presidiato? Decisione tua, senza scadenza.
- **`.zp/GOV-DA-FARE.md` non è versionato** ed esiste in una sola copia su questa macchina:
  contiene le tue regole d'ingaggio gov (`#176`).
- **`#175`**: il verdetto verde di `Z-230` fu dato con il cancello evidenze cieco. Il lavoro
  è già su main. Si ri-istruisce o si accetta?

## Verification

```bash
python docs/kb/tools/session_start.py                       # menu + salute, un giro
python docs/kb/tools/gov_rientro.py                         # stato del processo gov
bash scripts/test/gov-worker-guard-tests.sh                 # recinto e diario
python docs/kb/tools/zp_selftest.py                         # impianto zp
bash scripts/zero-pending-driver.sh --lane full-presidiata --dry-run   # corsa sorvegliata
```
