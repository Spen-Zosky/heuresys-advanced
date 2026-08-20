# Configurazione del server PostgreSQL di produzione

Quello che non sta in una migrazione: parametri del server e identità di
connessione. Vive qui perché **prima non viveva da nessuna parte** — misurato il
2026-08-20, `postgresql.auto.conf` sulla VM era vuoto e nel repo non c'era alcuna
configurazione di server: chi leggeva il repo non poteva sapere com'era
configurata la produzione.

| file | cosa fa | come si applica |
|---|---|---|
| `parametri-server.sql` | logging, query lente, `track_functions` | `ssh oracle-vm-default 'sudo -u postgres psql -f -' < deploy/postgres/parametri-server.sql` poi `pg_reload_conf()` |
| `ruoli.sql` | crea `heuresys_app` e `heuresys_ro` e assegna i privilegi | `ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_advanced -f -' < deploy/postgres/ruoli.sql` |
| `assegna-password-app.sh` | dà la password a `heuresys_app` e la deposita nel `.env` | `ssh oracle-vm-default 'bash -s' < deploy/postgres/assegna-password-app.sh` |
| `prova-identita-app.sh` | verifica che l'identità dell'app possa il giusto e **non** il resto | `ssh oracle-vm-default 'bash -s' < deploy/postgres/prova-identita-app.sh` |

## Le tre identità (#223 F3)

| ruolo | cosa può | chi lo usa |
|---|---|---|
| `heuresys` | **tutto**: possiede gli oggetti, applica le migrazioni | `migrate.sh`, `verify_gate`, il PC di sviluppo |
| `heuresys_app` | legge e scrive le **righe**; nessun `CREATE` su alcuno schema | l'API in produzione |
| `heuresys_ro` | legge e basta, e **non** vede le sei superfici sensibili | interrogazioni manuali |

Il codice sceglie da sé: `apps/api/src/db/client.ts` usa `POSTGRES_APP_USER` dove
c'è, e ricade su `POSTGRES_USER` dove non c'è. Per questo il PC di sviluppo, i
test e la CI **non cambiano comportamento** e non serve toccare i loro `.env`.

### Perché l'applicazione deve poter scrivere in `audit` e `staging`

I trigger installati da `000339` girano con i privilegi di **chi esegue
l'operazione** — non esistono funzioni `SECURITY DEFINER` in questo database, ed
è una disciplina da mantenere. Se `heuresys_app` non potesse inserire in
`audit.catalog_changes`, ogni modifica a un catalogo fallirebbe. Non è un
privilegio di troppo: è la condizione perché l'audit funzioni.

### La prova che conta

Non è «l'API si è avviata»: quella si avvia anche con la separazione nominale.
È che `CREATE TABLE` venga **respinto**. `prova-identita-app.sh` verifica
entrambi i versi — le quattro cose che devono funzionare e le due che devono
fallire — ed esce diverso da zero se una qualsiasi non torna.

## ⚠ Cosa resta da fare, e perché non l'ho fatto

`.env.example` **non è stato aggiornato** con `POSTGRES_APP_USER` /
`POSTGRES_APP_PASSWORD`. Non è una dimenticanza: la lettura di `.env*` è negata
dal guard degli strumenti, quindi non posso né leggerlo né modificarlo. Le due
variabili sono documentate qui e in `ruoli.sql`; aggiungerle all'esempio richiede
una mano umana.

Le password non stanno in nessun file versionato, e non devono starci. Vengono
generate sulla macchina da `assegna-password-app.sh` e scritte direttamente nel
`.env` (che è gitignored e reale). Rieseguire quello script **ruota** la
password: è il comportamento voluto per una rotazione.
