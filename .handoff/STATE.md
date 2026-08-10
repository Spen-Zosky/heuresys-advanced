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

## ⚠ COSA E' IN VOLO IN QUESTO MOMENTO (leggi PRIMA di agire)

**Il cancello di verifica sta rieseguendo `test-api`** (lanciato 12:38, ~43 min attesi).
Il verdetto in `.zp/verify-verdict.json` e' ancora quello VECCHIO e ROSSO: si aggiorna da
solo quando la corsa chiude. **Prima cosa da fare in sessione nuova**:

```bash
python -c "import json;d=json.load(open('.zp/verify-verdict.json'));print(d['verdict'], d['generated_at'])"
```

Se `generated_at` e' **dopo le 13:20 del 2026-08-10**, e' il verdetto nuovo: leggilo.
Se e' precedente, la corsa non aveva ancora chiuso — rilancia
`python docs/kb/tools/verify_gate.py run`.

**Il rosso NON e' una regressione**, e ci sono tre misure indipendenti:
- 00:54 — 1509 test passati, **1 solo file** caduto (`seed-acquisition`), verde da solo;
- 11:13 — 1511 passati, **1 solo file** caduto (`webauthn`, DIVERSO), verde da solo;
- 11:19 — corsa **interrotta dalla rete**: colta mentre accadeva (processo a 0 CPU, log
  fermo, transazione `idle in transaction` da 345s che bloccava due UPDATE, poi
  `Connection refused` sul DB e `Connection timed out` verso la VM). Esito: 58 file
  caduti in blocco, 549 test mai eseguiti, 78 minuti invece di 43.

Un difetto vero colpisce sempre lo stesso punto; questo cambia bersaglio a ogni corsa e
segue lo stato dell'infrastruttura. E' **`Z-251`**, registrato nel backlog con le misure.

## Top priorities (prossima sessione)

1. **`Z-251`** (~2h, **P1**): la suite non regge la contesa sul DB condiviso. È la voce che
   rende ambiguo **ogni** verdetto e che oggi ha imposto tre riesecuzioni da 43 minuti. La
   causa è dichiarata nel `vitest.config.ts` — «ogni file rifà i login da zero e Argon2id è
   lento» — e la cura è condividere le sessioni fra file. **Tocca `apps/api`: da assegnare a
   un lavoratore, non da fare in gov.**
2. **Provare `#177` sul campo**: `zp_review.py` è corretto e ha 13 prove, ma **nessun
   lavoratore l'ha ancora usato** — serve una corsa che arrivi davvero al passo dei revisori.
3. **`#124` mascheratura, strato 1** (~1 sessione): spaccare `IDENTITY` in `IDENTITY_PRO` /
   `IDENTITY_PRIV` chiude **6 celle su 8** senza alcun meccanismo nuovo.

## Open questions

- **Il freno resta INSERITO per il non presidiato.** Vuoi che il loop giri anche non
  sorvegliato? `#177` suggerisce di aspettare: oggi un lavoratore non chiude da solo.
- **`.zp/GOV-DA-FARE.md` non è versionato**, esiste in una sola copia qui (`#176`).
- **`#175`**: il verde di `Z-230` fu dato col cancello evidenze cieco. Si ri-istruisce?

## Verification

```bash
python docs/kb/tools/session_start.py                       # menu + salute, un giro
python docs/kb/tools/gov_rientro.py                         # stato del processo gov
bash scripts/test/gov-worker-guard-tests.sh                 # recinto e diario
python docs/kb/tools/zp_selftest.py                         # impianto zp
bash scripts/zero-pending-driver.sh --lane full-presidiata --dry-run   # corsa sorvegliata
```
