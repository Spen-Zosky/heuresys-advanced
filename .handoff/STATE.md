# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-10 (S1052 — la prima corsa presidiata ha chiuso il suo primo cluster: `Z-112` e `Z-250` chiusi).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Stato del PROCESSO gov → `.zp/GOV-DA-FARE.md`.

## Last session brief (S1052)

**Due lavoratori hanno lavorato in parallelo per la prima volta**, su due cluster di classe
A con perimetri disgiunti, con un guadagno misurato di **1,83×** sul lavoro in fila. Prima
però il freno andava sbloccato da un cerchio che si chiudeva su sé stesso — pretendeva
l'effetto prima della causa. Deciso da Enzo: il freno si chiama `autorizzato_non_presidiato`
e ora governa esattamente quello.

**`Z-112` è stato chiuso, e con lui `Z-250`** — la voce che aspettava da luglio «una corsa
presidiata conclusa con un cluster chiuso e il suo commit». Verdetto **VERDE, zero rilievi**:
cancelli tutti verdi e **le due prove su livelli diversi** che ADR-0026 pretende. Merge
`b6824e7e`. Chiusi nel piano: 43 → **46**.

**Il processo ha giudicato invece di cedere, e due volte ha detto no**: alla prima
istruttoria `Z-112` ebbe ROSSO per **una prova su due** — un lavoro tecnicamente completo
respinto perché le evidenze non bastavano — ed è servito un secondo giro del lavoratore per
registrarla. `Z-221` resta rosso per un file non committato.

**Cinque difetti strutturali emersi correndo**, invisibili a ogni batteria: il driver si
bloccava col rapporto che scrive lui, il recinto fermava il lavoro *dentro* il perimetro, il
rientro era cieco, la batteria della guardia era rossa, l'istruttoria accusava di «nessun
diario» chi ne aveva 135 righe. Tutti corretti e provati. E la documentazione è stata
riallineata al reale su cinque punti — dichiarava due modalità di sessione dove il codice ne
ha tre, uno schema ritirato, un conteggio fermo, una persona di prova che non esiste più.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Regole che questa sessione ha pagato care

**Si modifica con gli strumenti di edit, mai con script Python dentro heredoc Bash** (due
livelli di escape annidati: stringhe rotte tre volte) · **una prova che non può fallire non
è una prova** · **un conteggio che scarta in silenzio è peggio di uno assente** · **l'esito
si legge dal codice d'uscita**, mai da `head`/`tail` in coda a una pipe.

## Top priorities (prossima sessione)

1. **`#177` i revisori adversarial vivono in un workflow orfano** (~2-3h): due corse su due
   il lavoratore non ha potuto chiudere da solo, perché i verdetti stanno in un workflow che
   sopravvive alla sessione e la successiva non li ritrova. È un blocco **strutturale**, non
   di budget — finché resta, il loop dipende da un presidio, che è l'opposto del suo scopo.
2. **`#124` mascheratura, strato 1** (~1 sessione): spaccare `IDENTITY` in `IDENTITY_PRO` /
   `IDENTITY_PRIV` chiude **6 celle su 8** senza alcun meccanismo nuovo.
3. **`Z-251`** (~2h): la suite non regge la contesa sul DB condiviso — un file è caduto per
   `connect timeout` e da solo passa. Rende ambiguo ogni verdetto.

## Open questions

- **Il freno resta INSERITO per il non presidiato.** La corsa sorvegliata ora chiude cluster
  veri. Vuoi che il loop giri anche non presidiato? Decisione tua, senza scadenza — e `#177`
  suggerisce di aspettare: oggi un lavoratore non riesce a chiudersi da solo.
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
