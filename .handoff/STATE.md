# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-09 (S1052 — il processo gov ha imparato a dire di no, e poi ha detto di sì).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`. Stato del PROCESSO gov (non del progetto) → `.zp/GOV-DA-FARE.md`.

## Last session brief (S1052)

**Il lavoro di un lavoratore è entrato in main dopo un verdetto verde sull'intera suite** —
il primo trasferimento che gov abbia mai autorizzato. Ci sono volute tre corse, e la lezione
sta lì: **il lavoratore aveva ragione dall'inizio, mentivano gli strumenti**. Il cancello dei
test chiedeva a un lavoratore in sola lettura di far girare test che scrivono; il verdetto era
muto perché `pnpm -s` sopprime l'output; e non veniva nemmeno scritto.

**La plancia è diventata la console di volo di gov**, sette voci su sette: due ritmi, cinque
viste, i lavoratori coi loro diari in diretta, la composizione dei cluster, e la
configurazione modificabile con guardie, coerenza e rollback provato su un caso vero.

**I tre lavori minori sono chiusi, e nessuno era ciò che il registro diceva.** Il cancello
delle evidenze non era «poco severo»: era **cieco**, puntato su due posti sbagliati.
E il registro delle corse **aveva 16 righe e ne venivano lette 4** — dodici spezzate a
metà scrittura e scartate in silenzio, con una spesa mostrata che era quella di un quarto
dei dati e sembrava vera.

**Il freno resta inserito**: Enzo ha autorizzato di toglierlo, lo strumento ha rifiutato
perché `Z-250` è aperto (i test che servono non risultano eseguiti). La strada è obbligata e nell'ordine giusto.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Regola su ogni lavoro che tocca il database (S1049-S1052)

Prova generale su linux-pc prima di applicare · si emenda il file che crea (ADR-0035), mai
una `DELETE` a valle · un seed si prova su una copia usa-e-getta (porta `COMMIT` propri).

## Regola nuova (S1052) — una prova che non può fallire non è una prova

Tre cancelli erano **verdi per costruzione**: passavano sempre, e tacevano. Un controllo
mai visto rosso va **provato rompendolo di proposito**. E un conteggio che scarta in
silenzio ciò che non sa leggere è peggio di uno assente: sembra vero.

## Top priorities (prossima sessione)

1. **`Z-250` — la corsa presidiata che esegue i test mancanti** (~1 sessione): bootstrap,
   freno a metà lavoro, troncamento da budget, frontiere della description. **Sblocca il
   freno**, oggi l'unica cosa che separa dalla corsa vera a due lavoratori (`#173`).
2. **`#124` mascheratura, strato 1** (~1 sessione): spaccare `IDENTITY` in `IDENTITY_PRO` /
   `IDENTITY_PRIV` chiude **6 celle su 8** senza alcun meccanismo nuovo.
3. **`#168` cancellare una persona cancella la storia delle sue approvazioni** (~2-3h):
   le tre righe perse sono ri-derivate, **la causa no**. Serve il censimento dei `CASCADE`.

## Open questions

- **Il verdetto verde di `w1` è stato dato con il cancello evidenze cieco.** Ora che
  funziona, quel lavoro avrebbe un rilievo: ha **una** prova, ne servono **due** su livelli
  diversi. È già su main. Lo ri-istruiamo (`bash scripts/gov-chiudi.sh 1`) o lo si accetta?
- **`.zp/GOV-DA-FARE.md` non è versionato** e **esiste in una sola copia su questa
  macchina**: contiene le tue regole d'ingaggio gov (`#176`). Va spostato nel repo?
- **`#169`**: password e secondo fattore nascono dalla stessa chiave madre. Non urgente
  finché la chiave sta solo qui; lo diventa quando arriverà su VM e linux-pc (`#147`).

## Verification

```bash
python docs/kb/tools/session_start.py                                    # menu + salute, un giro
python docs/kb/tools/gov_rientro.py                                      # stato del processo gov
pnpm plancia:zp                                                          # :8477 — cockpit gov
ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh' # prova generale
```
