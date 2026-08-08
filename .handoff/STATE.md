# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-08 (S1051 — il fascicolo di un'azienda esiste, e la prova che conta è passata).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1051)

**`#131` Tenant Builder P1 chiuso su tutti e otto i task.** RTL Bank ha finalmente il
documento che descrive com'è configurata — e non l'ha scritto qualcuno: è stato costruito
leggendo la configurazione reale e poi *riconfrontato* con essa, senza differenze, poi
sottoposto e firmato dal vivo passando dalle API con il login di una persona.

**Il piano dava per fatta una regola che non esisteva.** Doveva bastare «dall'ATECO si
risale alla famiglia di modelli»: misurato prima di scrivere, quel legame non aveva su
cosa poggiare — i due codici coincidevano solo perché scritti a mano uguali. Ora esiste
davvero, e si vede dal fatto che un'assicurazione NON trova un modello di banca.

**La custodia della storia RTL era rotta da giorni** (`#153`): cercava un account rimosso
a luglio. Sistemato quello, ne sono emersi altri due che il tempo aveva prodotto e che
nessuno vedeva — cinque abilitazioni scadute e mai rinnovate, sei azioni formative ferme.

**Tre difetti li hanno trovati le prove, non io** — il più serio era mio: firmando un
fascicolo, la conferma spariva prima che si potesse leggere.

**Ho rotto io la CI, e l'ho riparata.** Per provare dei seed li ho eseguiti sul database
della CI dentro `BEGIN…ROLLBACK`, ma quei file contengono un `COMMIT` proprio: hanno
scritto davvero. Clone ricostruito, suite verde al rilancio. La lezione è in memoria.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, errori aperti. Doppia
verifica e review adversarial; le decisioni tecniche sono di Claude.

## Regola su ogni lavoro che tocca il database (S1049, confermata da S1050 e S1051)

**Prima di applicare**: `ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'`.
**Per ritirare qualcosa**: si emenda il file che lo crea (ADR-0035), mai una `DELETE` a valle.
**Per PROVARE un seed**: su una copia usa-e-getta, MAI su `heuresys_ci` — quei file portano
`COMMIT` interni e il tuo `ROLLBACK` non li annulla (costato la CI rossa in S1051).

## Top priorities (prossima sessione)

1. **`#124` mascheratura, strato 1** (~1 sessione): spaccare `IDENTITY` in `IDENTITY_PRO` /
   `IDENTITY_PRIV` chiude **6 celle su 8** senza bisogno di alcun meccanismo nuovo — è il
   pezzo più a valore del residuo. Il meccanismo `mask` esiste già ed è applicato a
   stipendi e valutazioni.
2. **`#168` cancellare una persona cancella la storia delle sue approvazioni** (~2-3h):
   le tre righe perse sono state ri-derivate, **la causa no**. Serve il censimento dei
   vincoli `CASCADE` verso `sys_users` e una decisione per famiglia.
3. **`#99` domini gerarchici e funzionali** (~6-8 sessioni): il pezzo grosso, con la
   scoperta già in mano che il resolver gira sull'albero sbagliato.

## Open questions

- **`#173` «gov»**: la proposta di orchestrazione parallela è ingerita e completa di
  sette decisioni già prese. Manca solo il tuo via a scrivere il piano.
- **`#169`**: password e secondo fattore nascono dalla stessa chiave madre. Non urgente
  finché la chiave sta solo qui; lo diventa quando arriverà su VM e linux-pc (`#147`).

## Verification

```bash
python docs/kb/tools/session_start.py                                    # menu + salute, un giro
ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh' # prova generale
bash db/scripts/storia36.sh custodia                                     # custodia RTL (verde)
py docs/kb/tools/check_identita_azienda.py --autoprova                   # identità aziende
cd apps/api && pnpm exec tsx ../../db/scripts/ricostruisci-fascicolo-rtl.ts  # 23/23, 7/7, 0 diff
```
