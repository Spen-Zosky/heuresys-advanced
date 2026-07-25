# Modi `close` e `report`

## Quando chiudere

Chiudi quando si verifica una di queste, e chiudi **prima** di aprire un cluster nuovo, non a meta' di uno. Sono tutte condizioni **osservabili**: nessuna richiede di stimare il contesto residuo, che non e' misurabile dall'interno (vedi `operations.md` §Budget).

- hai chiuso il numero di cluster previsto per questa iterazione (`clusters_per_iteration`, default 1);
- `.zp/STOP` presente (Enzo ha premuto il freno da remoto);
- fine dell'ondata corrente;
- nessun cluster eleggibile nella corsia corrente;
- una precondizione di sistema non recuperabile (tunnel giu' e solo cluster non-A rimasti).

Non tentare di indovinare quanto contesto ti resta per decidere se «ce ne sta un altro». Con un cluster per iterazione la domanda non si pone, e i tetti veri — turni e spesa — li impone il driver dall'esterno.

Chiudere in anticipo e' sempre preferibile a essere troncati: una chiusura ordinata lascia il repo pulito, un troncamento lascia un `INTERRUPTED` da ricostruire.

## La procedura, nell'ordine

Non improvvisare l'ordine: ogni passo assume che il precedente sia andato a buon fine.

**1. Gate.** Esegui i gate per tutte le aree toccate nella sessione (`gates.md`). Rosso → si corregge, non si chiude.

**2. Consolida il lavoro.** Spunta le caselle nel piano con la nota di chiusura e l'evidenza. Prepara i blocchi per l'Action register — item chiusi, item nuovi scoperti strada facendo, item `INTERRUPTED` con `resume-from`, debiti nuovi — e fai validare tutto da `handoff_lint.py`.

**3. Delega a `handoff`.** La riscrittura dello stato e' sua, non tua: `.handoff/STATE.md`, `SOT_STATE.md` con i conteggi ri-derivati, il register, il registro debiti, l'indice dei path, il consolidamento del journal, il lint bloccante, il commit e il push. Invocala e lasciala lavorare — duplicarne un pezzo qui significherebbe due writer sullo stesso file.

Prima di invocarla, assicurati che `.zp/PROGRESS.md` sia aggiornato: viene committato con il resto, ed e' il modo in cui Enzo legge lo stato dal telefono.

**4. Propagazione.** `handoff` esegue lo Step 4b, cioe' `scripts/close-propagate.sh --delta --resilient --auto-deploy`: repo e payload gitignored, ecosistema Claude, deploy della VM, clone del DB su linux-pc. **Non prefissare `MSYS_NO_PATHCONV=1`** — lo script lo gestisce per singola chiamata ssh, e un export globale rompe lo staging dei path locali di `align-claude-ecosystem`.

**In non presidiato il deploy e' vietato, e il divieto non e' questa frase.** `--auto-deploy` significa `git reset --hard` piu' restart dei systemd `api`/`web` su `www.heuresys.com`: eseguito a ogni chiusura di ciclo, di notte, e' la cosa piu' pericolosa dell'intero impianto — e per un giro era esattamente cio' che accadeva, perche' il filtro per classe governa la *selezione* del cluster e non il rito di chiusura. Adesso il driver esporta `HEURESYS_CLOSE_NODEPLOY=1` e il veto e' applicato dentro `close-propagate.sh`, dove **vince sui flag**: se qualcuno passasse `--auto-deploy` lo script lo disattiva e lo scrive su stderr. Non rimuovere quell'export dal driver per «far arrivare il lavoro in produzione»: il deploy di cio' che il loop ha chiuso e' un'operazione presidiata, e si fa quando c'e' qualcuno che guarda.

In una corsa **presidiata** il deploy resta parte del ciclo normale. Se in sessione e' finito qualcosa di classe C, verifica dopo il deploy che le migrazioni siano allineate fra locale e remoto prima di dichiarare chiuso.

**5. Verifica live.** Non fidarti dell'uscita degli script: controlla.

```bash
curl -s -o /dev/null -w "%{http_code}" https://<host>/api/readyz
curl -s -o /dev/null -w "%{http_code}" https://<host>/login
MSYS_NO_PATHCONV=1 ssh oracle-vm-default 'systemctl is-failed heuresys-advanced-api heuresys-advanced-web'
```

Un host non raggiungibile e' `skip + warn` e non blocca la chiusura. Un servizio `failed` su un host raggiungibile e' un errore: diventa il primo cluster della sessione successiva, con priorita' HARD.

**6. Segnala al driver.** Scrivi `.zp/last-outcome.json` con `{"outcome": "session-closed", "pushed": "<sha>", "next": "restart"}`, oppure `"next": "stop"` se la condizione primaria e' raggiunta o `.zp/STOP` esiste. Il driver legge questo file, non la prosa.

## Il perimetro del push

L'autorizzazione al push in questo loop e' implicita e dichiarata in `zp.config.yaml`, ed e' una deroga consapevole alla regola di progetto secondo cui una sessione nuova torna a chiedere. La deroga vale **solo** dentro questo perimetro:

- destinazione `origin main`, e nessun'altra;
- mai `--force`, in nessuna circostanza;
- mai con un gate rosso o con `handoff_lint.py` rosso;
- sempre `git pull --rebase origin main` + ri-lint prima del push;
- ogni push finisce nel run-record con lo SHA.

Fuori da questo perimetro l'autorizzazione non c'e'. Si azzera togliendo la chiave dalla config.

## Modo `report`

Sola lettura, non tocca niente, si puo' invocare anche a loop fermo. Rigenera `.zp/PROGRESS.md` e riportane il contenuto. Deve contenere, in italiano e leggibile su un telefono:

- ondata corrente e quanti cluster restano per ondata;
- cosa e' stato chiuso nell'ultima iterazione, con una riga di evidenza per cluster;
- il **vassoio bloccati-su-Enzo**: cosa serve esattamente, per ciascuno;
- il **lotto presidiato**: i cluster di classe D in attesa di autorizzazione;
- gli `INTERRUPTED` aperti con la ragione;
- spesa cumulata contro il tetto, e iterazioni usate;
- i prossimi cinque candidati;
- **la data del piano** su cui tutto questo si basa.

L'ultima voce non e' burocrazia. Quando il loop arriva a zero, la frase corretta non e' mai «zero pendenze» ma **«zero pendenze rispetto al piano del \<data\>»**. Il loop conosce solo cio' che il censimento ha trovato: se nel frattempo Enzo ha sviluppato fuori dal loop, quello zero e' vero e obsoleto insieme. Scriverlo senza data significa consegnare una rassicurazione falsa — ed e' il modo piu' rapido per far perdere fiducia a tutto l'impianto la prima volta che si scopre una pendenza che il piano non conosceva.

Le ultime due voci sono quelle che permettono a Enzo di decidere se alzare i tetti o fermare tutto, e sono il motivo per cui il file esiste. Se non ci sono, il report e' inutile.
