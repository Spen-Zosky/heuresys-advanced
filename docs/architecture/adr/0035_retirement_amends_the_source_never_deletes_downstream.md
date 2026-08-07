# ADR-0035 — Ritirare un oggetto: si emenda la fonte, non si cancella a valle

**Status**: Accepted (S1049, 2026-08-08)
**Contesto**: `#164` F1/F3/F4 · `#139` · complemento operativo di **ADR-0034**
**Autorità della decisione**: Claude (decisione tecnica, `feedback_claude_decides_technical`)

## Il fatto

`ADR-0034` ha dichiarato che la catena `db/migrations/*.sql` **si ri-applica per intero a
ogni deploy**, perché 166 file su 290 non trasformano il database ma lo **controllano**.

Da quella proprietà discende una conseguenza che in S1049 è costata tre tentativi sbagliati
prima di essere vista:

> **Una riga, una tabella o uno schema creati da un file della catena non si possono
> ritirare cancellandoli da un file successivo. Al deploy dopo tornano.**

Non è un'ipotesi. È stata osservata tre volte nella stessa sessione, ogni volta con una
faccia diversa:

| tentativo | cosa sembrava | cosa succedeva davvero |
|---|---|---|
| voce di menu `brownfield` | una `DELETE` in una migrazione nuova | `000050` la ricreava al giro dopo |
| 3 permessi `brownfield_adaptation:*` | una `DELETE` sui permessi | `000005` li ricreava, e le traduzioni cancellate diventavano un rosso |
| schema `brownfield` | `DROP SCHEMA` | 6 file dedicati lo ripopolavano, e altri 15 lo interrogavano |

In tutti e tre i casi la cancellazione a valle non è un ritiro: è un'**oscillazione**, che
per di più si vede solo alla **seconda** applicazione della catena — cioè in produzione, non
in prova, a meno di cercarla apposta.

## La decisione

**Per ritirare un oggetto del database si agisce sul file che lo crea. Sempre. Una
cancellazione a valle è ammessa solo *insieme* all'emendamento della fonte, mai da sola.**

Tre forme, in ordine di preferenza:

1. **Emendare il file che crea l'oggetto** — togliere la riga dall'elenco `VALUES`, la
   colonna dalla `CREATE TABLE`, la voce dall'allowlist. È la forma pulita, e vale per
   tutto ciò che è **contenuto** di una migrazione.
2. **Marcare il file `-- @migrate: once`** quando l'oggetto è un residuo di un processo
   concluso e il file esiste solo per crearlo. `migrate.sh` salta un file marcato **se e
   solo se** l'impronta coincide con quella registrata, quindi su un database nuovo gira
   comunque e la CI da zero non è toccata.
3. **Cancellare a valle** — ammesso **solo** in aggiunta a (1) o (2), per rimuovere
   l'esemplare già presente nei database esistenti. Da sola non ritira nulla.

## Come si verifica che sia davvero un ritiro

La prova generale (`db/scripts/ci-rehearsal.sh`) applica la catena **due volte**. È la
seconda passata a distinguere un ritiro da un'oscillazione: la prima le vede uguali.

Questa doppia passata esiste perché la sua assenza ha rotto la produzione lo stesso giorno
(`#165`): una tabella nuova non registrata nel registro di riconciliazione passava alla
prima applicazione e faceva cadere la catena alla successiva.

## Conseguenze

- **Ritirare costa più di aggiungere, e va preventivato.** Togliere tre permessi dalla
  fondazione auth significa toccare `000005`, `000210` e le traduzioni che vi si appoggiano:
  cinque file. Non è un lavoro «di pulizia» da mettere in coda a un altro.
- **Il costo si misura in file da emendare, non in righe da cancellare.** È la stima che va
  data prima di iniziare, e in `#164` non era stata data.
- Un item di backlog che dice «rimuovere X» è **incompleto** finché non nomina i file che
  creano X. La misura va fatta al momento della presa in carico, non della scrittura.
- Vale per righe, tabelle, colonne, funzioni, viste, permessi, voci di menu, schemi.

## Quando rivedere

Se la catena smettesse di ri-applicarsi per intero — per esempio adottando un ledger che
salta ogni file già applicato, indipendentemente dal marcatore — questa decisione decadrebbe
insieme ad `ADR-0034`. Finché il valore della catena sta nelle sue post-condizioni, la
proprietà resta e questa regola con lei.
