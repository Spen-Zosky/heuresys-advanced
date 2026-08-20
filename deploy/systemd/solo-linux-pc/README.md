# Unit che NON si installano da sole

Le quattro unit qui dentro girano **solo sul linux-pc**, e ci arrivano per
installazione esplicita (`scripts/provision-linux-pc.sh`), mai per deploy.

## Perché una sottodirectory

`scripts/vm-deploy.sh` installa **e abilita** ogni `*.service` / `*.timer`
trovato in `deploy/systemd/`, su ogni host che deploya — VM compresa. Il glob
non è ricorsivo, quindi una sottodirectory è ciò che le tiene fuori.

Se stessero un livello sopra, al primo deploy la VM si troverebbe:

- `heuresys-backup-pull` che prova a scaricare i backup **da sé stessa**;
- `heuresys-advanced-clonedb` che clona il database di produzione **sopra la
  produzione**.

## Perché il nome è cambiato (2026-08-20, #220 W1.5)

Si chiamava `archive/`, e quel nome ha prodotto un errore reale: il dossier
forense (rilievi F8-01 / F8-03) ha letto «archive» come «ritirato» e ne ha
concluso che il repo dichiarasse ritirate delle unit che invece **girano** —
misurate attive sul linux-pc, con dump giornalieri da ~124 MB.

Il difetto non era nelle unit, era nel nome. `solo-linux-pc/` dice il target
invece di suggerire un ritiro.

## L'utente di esecuzione

I template portano `User=ubuntu` perché è l'utente della VM, che è la
convenzione del resto di `deploy/systemd/`. Sul linux-pc l'utente è `enzo`, e
`provision-linux-pc.sh` fa la sostituzione al momento dell'installazione.

⚠ La sostituzione è un `sed` su `^User=ubuntu`. Se qualcuno cambiasse quella
riga nel template, il `sed` smetterebbe di combaciare e l'unit verrebbe
installata con un utente che sul linux-pc **non esiste** — in silenzio, perché
`sed` non fallisce quando non trova nulla. Chi tocca quella riga tocchi anche
`provision-linux-pc.sh`.

## La copia fuori sede va in PULL, e non è una mancanza

`scripts/backup-db.sh` prevede una copia off-host opzionale via `scp` in **push**
(`BACKUP_OFFHOST_SSH`). **Quella variabile deve restare vuota**, e non è una
configurazione dimenticata:

- il linux-pc sta dietro NAT sulla LAN domestica, e la VM non lo raggiunge;
- la direzione che funziona è il **pull** — è l'host di archivio a scaricare;
- così la VM non ha bisogno di alcuna credenziale verso il linux-pc. Meno
  superficie, non più.

Misurato il 2026-08-20: `heuresys-backup-pull.timer` è `enabled`, ha girato alle
04:05, e in `~/heuresys-backups/prod/` ci sono i dump giornalieri. Ogni file
scaricato viene verificato con `pg_restore --list` prima di essere considerato
buono — un dump troncato è peggio di un dump assente, perché dà falsa sicurezza.
