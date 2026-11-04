# Piano dei pacchetti Git su Drive e del .env del datastore in copia (2026-11-04)

Mandato di Enzo (4/11/2026, «sì» alla raccomandazione del controllo di commit, push e copie): rinnovo notturno dalla VM dei pacchetti Git di advanced e datastore, e `.env` del datastore nelle copie cifrate. Rapporto del controllo: https://claude.ai/artifact/JvqAoTpr11jt3Db5n8p3q4

Non si chiude in questa sessione: la verifica della prima corsa notturna di cron (voce P5), e HDD-01, che richiede la macchina avviata con Debian. Le altre discrepanze del rapporto restano fuori da questo ciclo.

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| P1 | `scripts/pacchetti-git-drive.sh`, installato in `~/backup-hr/bin/` | Claude | la guardia si vede rossa su una destinazione locale di prova, poi verde | fatta |
| P2 | Prima corsa vera verso Drive per i due repository | Claude | impronta riscaricata da Drive uguale; `git bundle list-heads` dà l'`origin/main` di GitHub | fatta |
| P3 | `.env` del datastore in `backup_restic_hr.sh`, con potatura per host e tag | Claude | nell'istantanea su VM e Drive, impronta uguale all'originale, nessuna istantanea orfana | fatta |
| P4 | Riga in crontab alle 02:45 UTC | Claude | `crontab -l` la mostra; prova in ambiente ridotto come quello di cron | fatta |
| P5 | Prima corsa notturna | Claude, in una sessione successiva | `log/pacchetti_git_esito.txt` dice OK con la data del 5/11 | non si chiude qui |

## Simulazione

**P1, P2.** Prerequisiti: `gdrive-hr` funziona, `git fetch` funziona con l'ambiente di cron (provato il 4/11 con `env -i`). Effetto: `git bundle create --all` dopo una fetch. Sostituisce il pacchetto su Drive solo dopo verifica; il precedente resta come `.precedente`. Portata: il file su Drive è la copia fuori sede, nessun'altra macchina deve riceverlo. Serve Enzo: no.

Caso limite distruttivo: un repository danneggiato produrrebbe un pacchetto piccolo che sostituisce quello buono. Guardie: `git bundle verify`, `origin/main` presente nel pacchetto, peso almeno metà del pacchetto in carica, impronta riscaricata da Drive. Se una fallisce, la destinazione resta com'era e scatta l'allarme. La prima corsa manda il pacchetto del datastore del 21/10 a `.precedente` e il vecchio `.precedente` nel cestino di Drive: tutti i suoi commit sono su GitHub.

Formato: il pacchetto resta in chiaro su Drive, come quello esistente del datastore (decisione D4 di quel progetto). I `.env` non stanno nei pacchetti, perché non sono in Git.

**P3.** Prerequisiti: il file esiste; il controllo `-s` ferma la corsa se manca. Effetto: un secondo percorso nel `restic backup`, che lo legge direttamente senza copie in chiaro.

Trappola trovata leggendo lo script: `restic forget` raggruppa per host e percorsi, quindi un percorso nuovo creerebbe un secondo gruppo e le istantanee vecchie non verrebbero più potate. Si aggiunge `--group-by host,tags`. Prima della prova si misura il numero di istantanee, dopo si ricontrolla la regola di conservazione (VM 2 giornaliere).

Consumatori: `ultimo_esito.txt` e `impronte_stage.txt` non cambiano formato; le impronte dei `.env` vanno in un file a parte, `log/impronte_env.txt`, solo impronte.

**P4.** A quell'ora il restic è finito nei casi normali (02:18 nelle ultime notti); le due corse non dipendono l'una dall'altra. Rollback: togliere la riga di crontab.

## Esito del 4/11/2026

- **P1.** Destinazione locale con un finto pacchetto da 2 GB: uscita 1, «non sostituisco», destinazione con impronta invariata. Poi uscita 0 e pacchetto sostituito, con il vecchio come `.precedente`.
- **P2.** Corsa delle 14:53 UTC in ambiente ridotto come quello di cron. Riscaricati da Drive, entrambi coincidono con l'impronta registrata, superano `git bundle verify`, si clonano, e la loro `origin/main` è uguale a `git ls-remote` su GitHub (53b81dd4 e f4e4975b).
- **P3.** Corsa delle 14:55 UTC, esito VM=0 Drive=0. I due `.env` e tre file di controllo hanno impronta uguale in entrambi gli archivi. Le istantanee restano 2 sulla VM e 15 su Drive, quindi anche quelle col vecchio elenco di percorsi vengono potate.
- **P4.** `crontab -l` mostra la riga delle 02:45. Il primo tentativo era fallito senza toccare niente, perché `crontab` non ha accettato il file nello scratchpad: installata da standard input e controllata con `diff`, una riga in più.

`backup_restic_hr.sh` non è versionato: la modifica sta sulla VM, in `~/backup-hr/bin/`.

Controllo per P5: `cat ~/backup-hr/log/pacchetti_git_esito.txt`.

## Registro di ciò che esce dal ciclo

- `log/ALLARME.txt` non ha lettori fra gli script cercati: un allarme dei backup oggi non arriva a nessuno.
- Le altre discrepanze del rapporto (punti da 4 a 12).
