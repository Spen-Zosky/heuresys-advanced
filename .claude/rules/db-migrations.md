---
paths:
  - "db/**"
---

# Migrazioni database

File SQL numerati in `db/migrations/000001_*.sql..` — il buco `000035` è cosmetico e documentato. **Il conteggio esatto non è hardcoded da nessuna parte**: sta in `docs/kb/SOT_STATE.md`, ri-derivato ogni sessione con `ls db/migrations/*.sql`.

Ogni migrazione è **idempotente** — `CREATE TABLE IF NOT EXISTS`, `INSERT … ON CONFLICT DO NOTHING` e simili — e l'esecuzione dell'intero set due volte produce un diff `pg_dump` vuoto (dimostrato e registrato).

Quando aggiungi una migrazione, segui il pattern esistente: numero sequenziale successivo, un solo file descrittivo, corpo idempotente, **nessuna operazione distruttiva**.

## Vincoli di schema che valgono qui

Dagli invarianti non negoziabili del `CLAUDE.md`:

- **I3/I4** — le tabelle business vivono in `sys.sys_<plural>`. Gli schemi ausiliari sono `staging`, `brownfield`, `audit`. **Mai** `usr_*` / `br_*`.
- **I5** — l'isolamento tenant è FK più filtro nel middleware API. **Mai RLS**: Postgres RLS non è usato da nessuna parte.
- **I7** — l'auth è separata da `sys.sys_users`: 11 tabelle dedicate `sys.sys_auth_*`.
- **I9** — il PIP (Position Intelligence Profile) è una VIEW o MATERIALIZED VIEW, mai un blob JSONB (ADR-0008).
- **RD-08** — campi categoriali = `varchar(N) + CHECK`. **Mai ENUM PostgreSQL.** I valori enum-like sono discriminatori lato TS.
- **RD-09** — `date` per le colonne di sola data; `timestamptz` solo dove serve precisione all'orario.
- **I13** — PostgreSQL 16 **nativo, niente Docker** (ADR-0004). Il runtime è sulla VM OCI via tunnel SSH (ADR-0010 opzione B / RD-25).

## Script

`db/scripts/` contiene coppie PS1 + SH: create / migrate / reset / validate / seed. I PowerShell sono il canonico su Windows, i `.sh` servono per l'uso via SSH sulla VM. **Ognuno è idempotente e sicuro da rieseguire.**

`pnpm db:reset` è distruttivo: **chiedi all'utente prima di lanciarlo.**
