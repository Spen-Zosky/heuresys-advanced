---
paths:
  - "db/**"
---

# Migrazioni database

File SQL numerati in `db/migrations/000001_*.sql..` — il buco `000035` è cosmetico e documentato. **Il conteggio esatto non è hardcoded da nessuna parte**: sta in `docs/kb/SOT_STATE.md`, ri-derivato ogni sessione con `ls db/migrations/*.sql`.

Ogni migrazione è **idempotente** — `CREATE TABLE IF NOT EXISTS`, `INSERT … ON CONFLICT DO NOTHING` e simili — e l'esecuzione dell'intero set due volte produce un diff `pg_dump` vuoto (dimostrato e registrato).

Quando aggiungi una migrazione, segui il pattern esistente: numero sequenziale successivo, un solo file descrittivo, corpo idempotente, **nessuna operazione distruttiva**.

## Prima di applicare: la prova generale (obbligatoria)

```bash
ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'
```

Copia `heuresys_ci` e applica la catena **due volte**, poi interroga le sentinelle. ~26 secondi contro i 20-30 minuti di un giro di CI. **La seconda passata non è un lusso**: è l'unica che vede i difetti in cui un file crea qualcosa che un file di numero **minore** deve conoscere (registro di riconciliazione, mappa GDPR, allowlist) — la prima passata li dichiara verdi. Un difetto di quella classe ha rotto la produzione in S1049.

## Ritirare un oggetto: si emenda la fonte (ADR-0035)

**La catena si ri-applica per intero a ogni deploy** (ADR-0034: 166 file su 290 non trasformano, *controllano*). Quindi:

> Una riga, una tabella o uno schema creati da un file della catena **non si ritirano cancellandoli da un file successivo**. Al deploy dopo tornano.

Tre forme, in ordine:

1. **Emendare il file che crea l'oggetto** — togliere la riga dall'elenco `VALUES`, la voce dall'allowlist. È la forma pulita.
2. **Marcare il file `-- @migrate: once`** se esiste solo per creare un residuo di un processo concluso. Viene saltato **solo** se l'impronta coincide con quella registrata: su un database nuovo gira comunque.
3. **Cancellare a valle** — ammesso **solo in aggiunta** a (1) o (2), per rimuovere l'esemplare già presente. Da sola non ritira nulla, oscilla.

⚠️ **Non marcare `once` un file che porta guardie vive**: quelle devono rigirare a ogni deploy. Va emendato, non spento.

## Ogni scrittura di massa porta quattro cose

(a) la **misura prima**, dal vivo · (b) una **guardia** che ri-verifica la precondizione al momento dell'esecuzione, mai ereditata dalla misura di ieri · (c) una **post-condizione che protegge ciò che NON doveva cambiare** (`storia36_calendar` c'è ancora? le persone vere ci sono ancora?), non solo ciò che doveva · (d) un **rollback dichiarato**: un giornale `staging.<item>_undo` popolato **prima** della scrittura + la funzione che lo applica, oppure la ragione scritta per cui non esiste. **Elenco esplicito, mai un carattere jolly**, quando si cancella.

## Vincoli di schema che valgono qui

Dagli invarianti non negoziabili del `CLAUDE.md`:

- **I3/I4** — le tabelle business vivono in `sys.sys_<plural>`. Gli schemi ausiliari sono `staging`, `reference_sync`, `audit`. **Mai** `usr_*` / `br_*`. ⚠️ `brownfield` è **RITIRATO** (#164 F4, mig. `000297`): le tre tabelle vive sono traslocate in `reference_sync`. Misurato S1052: `brownfield` **non esiste più** nel database (0 schemi), `reference_sync` sì.
- **I5** — l'isolamento tenant è FK più filtro nel middleware API. **Mai RLS**: Postgres RLS non è usato da nessuna parte.
- **I7** — l'auth è separata da `sys.sys_users`: 11 tabelle dedicate `sys.sys_auth_*`.
- **I9** — il PIP (Position Intelligence Profile) è una VIEW o MATERIALIZED VIEW, mai un blob JSONB (ADR-0008).
- **RD-08** — campi categoriali = `varchar(N) + CHECK`. **Mai ENUM PostgreSQL.** I valori enum-like sono discriminatori lato TS.
- **RD-09** — `date` per le colonne di sola data; `timestamptz` solo dove serve precisione all'orario.
- **I13** — PostgreSQL 16 **nativo, niente Docker** (ADR-0004). Il runtime è sulla VM OCI via tunnel SSH (ADR-0010 opzione B / RD-25).

## Script

`db/scripts/` contiene coppie PS1 + SH: create / migrate / reset / validate / seed. I PowerShell sono il canonico su Windows, i `.sh` servono per l'uso via SSH sulla VM. **Ognuno è idempotente e sicuro da rieseguire.**

`pnpm db:reset` è distruttivo: **chiedi all'utente prima di lanciarlo.**
