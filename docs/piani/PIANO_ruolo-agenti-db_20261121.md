# Piano B2 — ruolo PostgreSQL limitato per gli agenti (2026-11-21)

Obiettivo: gli agenti scrivono nel database di produzione con un ruolo che non può fare DROP, TRUNCATE né ALTER; il database rifiuta questi comandi per qualunque strada. Le migrazioni passano solo dal proprietario `heuresys` (script di rilascio).

## Misure (2026-11-21, sola lettura)

- Ruoli esistenti: `heuresys` (proprietario, migrator), `heuresys_app` (API, LOGIN), `heuresys_ro` (NOLOGIN), `heuresys_backup`, `heuresys_datastore_ro`. Nessuno è superuser tranne `postgres`.
- `heuresys_app` ha SELECT/INSERT/UPDATE/DELETE su 505 tabelle, nessun TRUNCATE, nessun CREATE, non è proprietario: già soddisfa il requisito, ma lo usa l'API, non gli agenti.
- Gli script e gli strumenti degli agenti (`scripts/*.sh`, `docs/kb/tools/*.py`) usano `POSTGRES_USER` del `.env`, cioè il proprietario `heuresys`: è questo il buco.

## Voci

| id | cosa | chi | fatta quando |
|---|---|---|---|
| B2.1 | `deploy/postgres/ruolo-agenti.sql`: crea `heuresys_agenti` (NOLOGIN finché non ha password), stessi privilegi di riga di `heuresys_app`, niente TRUNCATE/REFERENCES/TRIGGER, niente CREATE, non proprietario; post-condizioni nel file | io | file nel repo, eseguito, post-condizione verde |
| B2.2 | `deploy/postgres/assegna-password-agenti.sh`: genera la password, la scrive solo in `~/.config/claude-agenti/db-agenti.env` (modo 600), mai stampata | io | file nel repo, eseguito |
| B2.3 | `deploy/postgres/psql-agenti.sh`: wrapper che carica quel file e lancia `psql` come `heuresys_agenti`; gli agenti usano questo | io | file nel repo, collegamento provato |
| B2.4 | `deploy/postgres/prova-ruolo-agenti.sh`: prova DROP/TRUNCATE/ALTER/CREATE rifiutati su una tabella temporanea creata dal proprietario in uno schema di prova, e SELECT/INSERT/UPDATE/DELETE ammessi | io | exit 0 con output |
| B2.5 | PR in bozza | io | PR aperta |

## Simulazione (prima di eseguire)

- Deve già essere vero: backup verificato < 24 h (`bash ~/.claude/tools/backup-verificato.sh heuresys_advanced`); `sudo -u postgres` funziona sulla VM (misurato: sì).
- Strumento: `sudo -u postgres psql -d heuresys_advanced -f ruolo-agenti.sql`, come `ruoli.sql`; idempotente; solo `CREATE ROLE`/`GRANT`, nessuna tabella reale toccata.
- Portare il risultato altrove: i file stanno nel repo; il segreto resta sulla VM. Propagare alle altre macchine non è in questo ciclo (decisione di Enzo).
- Serve Enzo? No per la creazione (permesso permanente con backup). Sì se si vuole togliere al proprietario l'accesso degli agenti: vedi sotto.
- Distruttiva? No. La prova di DROP/TRUNCATE gira solo su una tabella creata apposta in uno schema `prova_agenti_<id>` e poi eliminata dal proprietario; mai su tabelle reali.

## Cosa non si chiude in questo ciclo

1. Spostare ogni script esistente da `heuresys` a `heuresys_agenti`: molti fanno DDL legittimo (migrazioni, seed). Va deciso script per script.
2. Impedire fisicamente che un agente usi la password del proprietario: oggi lo fanno solo `enzo-guard` e il blocco di lettura del `.env`; il database non può distinguere chi sta dietro `heuresys`. Soluzione piena (decisione di Enzo): la password del proprietario esce dall'ambiente degli agenti e resta al solo script di rilascio.
3. Propagazione ai PC.
