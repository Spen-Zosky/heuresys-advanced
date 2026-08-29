# 236 — I lavori remoti si armano, non si appendono alla sessione

> **item**: #236 · **priorità**: P1 · **stima**: ~1 sessione
> **stato**: IN CORSO — F1 e **F2 FATTE**; restano F3 (`verifica-cloni.sh`) e F4 (ecosistema)
> **nasce-da**: S1083 (2026-08-28), domanda di Enzo durante la chiusura: *«mi confermi che le
> clonazioni sono processi indipendenti che arrivano a conclusione anche se chiudo la sessione?»*
> La risposta misurata è **no**, e una delle tre è pure distruttiva.

## Il fatto, letto nel codice e non supposto

`scripts/close-propagate.sh:258` lancia il rifacimento del clone così:

```bash
MSYS_NO_PATHCONV=1 ssh -o BatchMode=yes linux-pc "cd '$REPO' && bash scripts/clone-vm-db.sh"
```

Nessun `nohup`, nessun `setsid`, nessun `&`, nessuna sessione staccata. Il processo gira **sul
gemello**, ma è figlio di un `ssh` che vive **nella sessione CLI**: se la sessione si chiude,
l'`ssh` muore, il canale si chiude e il remoto riceve `SIGHUP`.

**E dentro c'è un'operazione distruttiva.** `scripts/clone-vm-db.sh:148`:

```bash
pg_super -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS \"$s\" CASCADE"
```

Gli schemi (`sys`, `audit`, `staging`, `reference_sync`) vengono **droppati in place** *prima* del
`pg_restore`. Fra quel `DROP` e la fine del ripristino c'è una finestra — misurata oggi in **diversi
minuti**, con `193 altri oggetti` elencati in cascata — in cui il clone del gemello **non esiste**.
Chiudere la CLI in quella finestra non lo lascia «indietro»: lo lascia **rotto**, e il gemello è il
database su cui girano la CI e la verifica lunga di chiusura.

⚠ **Lo script conosce metà del problema.** Le righe 154-160 portano già una guardia scritta per il
caso *«se ssh/pg_dump muore a metà (disco pieno sulla VM, LAN caduta), `pg_restore` ha già
eseguito…»*, con un `FATAL` esplicito. Quella guardia intercetta la morte del **lato sinistro**
della pipe. Non può intercettare la morte di **entrambi i lati insieme**, che è esattamente ciò che
fa un `SIGHUP` sulla sessione.

## Cosa invece è davvero armato, e perché la memoria di Enzo è giusta a metà

Enzo ricorda di essersi sentito dire *«puoi chiudere, le attività sono armate, poi verifichi con un
comando»*. È vero — ma vale **solo per il deploy**:

| lavoro | come gira oggi | sopravvive alla chiusura? |
|---|---|---|
| **deploy in produzione** | `heuresys-advanced-deploy-watch.timer` — timer systemd **sulla VM** | ✅ **sì** |
| `align-clones` / ecosistema Claude | comando remoto via `ssh` in primo piano | ❌ no → **F4** |
| `clone-vm-db` | ~~`ssh` in primo piano~~ → **innescato su systemd** (`arma-clone.sh`, F2) | ✅ **sì, dal 2026-08-29** — provato uccidendo ogni ssh a metà corsa |

Il comando che Enzo non ricordava è **`bash scripts/verifica-deploy.sh`**, e legge lo stato del
solo deploy con vocabolario chiuso: `DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO ·
NON-VERIFICATO`.

## Il modello da estendere — non c'è niente da inventare

Il deploy risolve già questo problema, e `#165` ne racconta il perché: *«prima il cancello CI stava
dentro il deploy e il deploy dentro la chiusura, quindi la sessione restava aperta a guardare la
CI: 20-30 minuti»*. La cura fu **sganciare l'esecuzione dalla sessione**, in quattro pezzi:

1. **l'armamento è atomico e istantaneo** — la sessione scrive un riferimento (`origin/prod` → sha)
   e ritorna. Non esegue: dichiara *cosa* va fatto;
2. **l'esecuzione la fa la macchina** — un timer systemd chiede ogni 5 minuti «c'è qualcosa di
   armato?». Non è figlio di nessuna sessione, quindi nessun `SIGHUP` lo raggiunge;
3. **il fallimento è visibile da sé** — `OnFailure=heuresys-unit-failure@%n.service`, perché
   *«è l'unica unit che tocca la PROD senza che nessuno stia guardando»*;
4. **`Persistent=true`** — recupera l'occorrenza persa dopo uno spegnimento: *«un deploy armato non
   deve restare armato per sempre solo perché la macchina era giù»*.

## Fasi

- [x] **F1 — Lo swap atomico** — **FATTO 2026-08-29 (S1083)**, e la prova è l'interruzione.

  Il clone non droppa più niente: ripristina in `<nome>_stage`, verifica **lì**, e solo se tutto
  torna scambia i due nomi con `ALTER DATABASE … RENAME`.

  🔬 **La prova, eseguita sul gemello** — `timeout -s KILL 15 bash scripts/clone-vm-db.sh` → exit
  **137**. `SIGKILL` è la forma più brutale, che nemmeno un `trap` intercetta: peggio del `SIGHUP`
  che si voleva neutralizzare. Subito dopo, il clone rispondeva **164 utenti · 315 posizioni · 240
  tabelle**, intatto. Con lo script precedente lo stesso segnale lo avrebbe lasciato vuoto.
  🔬 **E la corsa sana**, perché i casi negativi da soli sarebbero soddisfatti anche da uno script
  che non scambia mai: `164/164 · 315/315 · 119.773/119.773 · censimento 13 voci identiche · 4
  schemi come la sorgente` → scambio eseguito, exit 0, **nessun residuo** `_stage` o `_old`.

  **Due difetti trovati solo perché la corsa è stata fatta davvero:**
  ① `pg_app` si connette come utente applicativo, e `.pgpass` lega la credenziale al **nome del
  database** — che ora è nuovo. `psql` è rimasto **26 minuti** fermo su una richiesta di password
  che nessuno avrebbe mai letto, senza un errore. Curato con `PGPASSWORD` e, soprattutto, con
  **`-w` su ogni psql**: in una corsa non presidiata un comando che *chiede* è peggio di uno che
  fallisce.
  ② Il pre-controllo sulle connessioni era **una misura ereditata**: chiedeva «c'è qualcuno?» e poi
  rinominava, e ha bloccato uno scambio per **una** connessione anonima che si stava già chiudendo,
  lasciata dalle verifiche appena concluse. Tolto: il rinomino **è** la misura, e quello che serve
  non è un controllo prima ma una **diagnosi dopo** — l'errore di PostgreSQL dice che il database è
  in uso e non dice da chi.

  **Batteria**: 10 casi verdi, di cui **cinque negativi** (dump interrotto, censimento divergente,
  conte non misurabili, primo e secondo rinomino falliti) che pretendono tutti che lo scambio
  **non** avvenga. I due casi storici di D-86 — «lo schema ritirato viene droppato», «`public` non
  si tocca» — sono stati **sostituiti**, non cancellati: quelle proprietà ora sono vere *per
  costruzione*, e al loro posto si prova che il database di scena nasce da zero.

- [x] **F2 — L'armamento del clone** — **FATTO 2026-08-29 (S1084)**, e non è nato il timer che
      questa riga prevedeva: **c'era già**.

  ### ⭐ Quello che non serviva inventare

  Il piano diceva «sul gemello nasce `heuresys-clone-watch.timer`». Prima di scriverlo ho guardato
  cosa c'è davvero sul gemello, e c'era **`heuresys-advanced-clonedb.service`** — viva dal 2026
  (Z-022), con *tutto* ciò che il modello di `#165` pretende: `OnFailure=heuresys-unit-failure@%n`,
  `Persistent=true` sul timer, `TimeoutStartSec=900`, e in più lo stop di `api`+`web` prima del
  ripristino con un `ExecStopPost` che li riaccende **sempre**, anche quando il clone fallisce.

  Mancava **una cosa sola: un innesco su richiesta.** Il timer la esegue la domenica alle 08:00, e
  fra una domenica e l'altra l'unico modo di rinfrescare il gemello era il comando appeso alla
  sessione. Scrivere un secondo sorvegliante avrebbe duplicato un meccanismo collaudato da mesi.

  ### L'atto è una riga: `systemctl start --no-block`

  `scripts/arma-clone.sh` (nuovo) innesca l'unità sul gemello e **ritorna**. Il `--no-block` è
  tutto il punto: senza, `systemctl start` *attende* la fine del one-shot e si sarebbe daccapo —
  appesi all'ssh, con in più un livello. Con, systemd prende in carico l'unità e il clone diventa
  figlio **di systemd**.

  `close-propagate.sh` passa da «lancia e aspetta» ad «arma e ritorna», e da qui in poi **non sa**
  come è finito il clone — né deve fingere di saperlo: lo dirà `verifica-cloni.sh` (F3), come già
  fa `verifica-deploy.sh` per il deploy. Il suo esito diventa `armato`, e il diario lo scrive
  `arma-clone.sh` col passo `arma-clone`, con la stessa guardia anti-doppione di `#217` I4.

  ### 🔬 Le prove, eseguite — e la seconda è quella che conta

  **① Il clone è figlio di systemd, non dell'ssh.** Misurato subito dopo l'innesco:
  `MainPID=412164`, e `ps -o ppid=` su quel pid risponde **1**, cioè `systemd`. Nessun `sshd` nella
  catena.

  **② Ucciso ogni ssh MENTRE il clone girava.** `pkill -9 -f "sshd: enzo"` sul gemello — che è
  peggio del `SIGHUP` che una chiusura di sessione provocherebbe. La connessione è caduta a metà
  (`Connection to 192.168.1.11 closed by remote host`). Esito del clone, riletto dopo:

  | misura | esito |
  |---|---|
  | `systemctl is-active` | `inactive` (finito) |
  | `Result` · `ExecMainStatus` | **`success`** · **0** |
  | durata | 04:10:24 → 04:11:35 = **71 secondi**, terminati **senza più nessun ssh** |
  | il clone risponde | **164 utenti · 315 posizioni · 45 OU · 14.033 skill** — le stesse conte della produzione |
  | residui `_stage` / `_old` | **nessuno** (lo swap atomico di F1 ha chiuso) |
  | `api` e `web` sul gemello | **`active`** — `ExecStopPost` li ha riaccesi |

  Con la riga di prima, quel `SIGKILL` avrebbe interrotto un ripristino a metà.

  ⚠ Un dettaglio della prova conferma un difetto già noto: il primo tentativo di leggere le conte
  è rimasto **appeso su «Inserisci la password»**, perché il `psql` di verifica non aveva `-w`. È
  esattamente ① di F1 (26 minuti fermi su una richiesta che nessuno avrebbe letto). In una corsa
  non presidiata un comando che *chiede* è peggio di uno che fallisce.

  **③ I casi negativi, nella batteria** (`scripts/test/run-shell-tests.sh`, sezione *arma-clone*,
  **234 ok / 0 falliti**): host irraggiungibile → `IGNOTO` dichiarato ed exit 0, e soprattutto un
  host morto **non può** dire «preso in carico»; `--dry-run` non innesca; flag sconosciuto
  rifiutato; `--no-block` presente. Più due prove sul percorso vero: che `close-propagate` **non**
  contenga più un `ssh … clone-vm-db.sh` in primo piano, e che chiami `arma-clone.sh`.

  ### ⚠ Il difetto che ha reso verde un caso negativo, e come si è visto

  Il caso «unità inesistente → `fallito`, exit 1» **usciva 0**. Causa: un apostrofo dentro un
  `${WHY:-unita' $UNIT assente}`. Bash apre lì una stringa anche fra doppi apici, e la stringa si
  richiude su un apostrofo più avanti nel file: `bash -n` resta verde perché la sintassi torna, ma
  lo `exit 1` **smette di essere un comando** — è finito dentro un letterale. La traccia `bash -x`
  lo mostra senza appello: l'esecuzione finisce sull'ultima riga della funzione, e `+ exit 1` non
  compare mai.

  È una trappola **già documentata** in `scripts/arma-deploy.sh`, che porta l'avvertimento in
  testa. L'avevo letto, e l'ho riprodotta lo stesso: un commento in un altro file non è un
  presidio. Ora lo è — la batteria ha un caso che cerca quel pattern in `arma-clone.sh`, e una
  ricerca su tutto il repo ha confermato che l'unica altra occorrenza (`close-propagate.sh:58`)
  ha apostrofi **bilanciati**, quindi è sana.

  ### Cosa resta scoperto, dichiarato

  Se il gemello è **spento** al momento della chiusura, non si arma niente: `arma-clone.sh` lo
  dice (`IGNOTO`, mai un verde) ed esce 0 per non far cadere una chiusura sana, e il recupero è il
  timer settimanale con `Persistent=true` — cioè fino a sei giorni di ritardo. Portarlo a zero
  vuol dire una ref armata che il gemello consuma da sé al ritorno: è materia di F3, che deve
  comunque leggere lo stato dei tre lavori.
- [x] **F3 — `verifica-cloni.sh`, gemello di `verifica-deploy.sh`** — **FATTO 2026-08-29 (S1084)**.
      `bash scripts/verifica-cloni.sh` — nominato nella sezione *Verification* di
      `.handoff/STATE.md`, con la domanda in chiaro: *«posso chiudere?»* è un comando, non una
      memoria. `--solo deploy|clone|ecosistema` · `--breve`.

  ### Tre mestieri, tre vocabolari — non uno solo riusato

  | lavoro | verdetti | come si misura |
  |---|---|---|
  | **deploy** | `DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO` | **delegato** a `verifica-deploy.sh` |
  | **clone** | `FRESCO · IN-CORSO · INDIETRO · FALLITO · NON-VERIFICATO` | esito dell'unità **+** distanza in migrazioni dalla produzione |
  | **ecosistema** | `ALLINEATO · INDIETRO · DISALLINEATO · NON-VERIFICATO` | `stamp` della sentinella su ogni host + catalogo toccato dopo |

  Il verdetto del deploy **non si riscrive**: `verifica-deploy.sh` ha già il cancello CI, la
  sonda IPv4 col secondo tentativo e la finestra dei commit non armati. Due criteri per una
  domanda sola prima o poi divergono. Esce **0** se niente è in guasto, **1** su un guasto,
  **2** se non ha potuto misurare.

  **Il clone guarda due cose, non una.** `Result=success` dice che l'ultima corsa è andata
  bene; non dice che il clone sia *attuale*. Un clone riuscito una settimana fa, con tre
  migrazioni applicate in produzione da allora, è sano **e indietro** — e su quello girano la
  CI e la verifica lunga di chiusura. Perciò il verdetto confronta anche le migrazioni.

  ### ⚠ Il falso allarme perpetuo, evitato perché misurato

  La prima stesura metteva `~/.claude/settings.json` fra i file la cui data decide se
  l'ecosistema è indietro. Misurato subito: quel file portava **le 03:28 di quella stessa
  mattina — l'avvio di questa sessione**. Lo riscrive il *runtime* di Claude Code (stile di
  uscita, permessi concessi al volo), non l'uomo, e per giunta viene **trasformato per-OS**
  prima di arrivare sui remoti. Tenendolo dentro, il verdetto sarebbe stato `INDIETRO` **a
  ogni singola sessione, per sempre**: un allarme sempre acceso è un allarme che nessuno
  guarda più — lo stesso difetto che `#194` descrive per l'atlante, e che R2 di questa
  sessione ha curato per il rendiconto delle chiusure.

  Il file è fuori dal criterio, e il limite è **dichiarato in uscita** (`non guardato:
  settings.json … usa --verify`), non nascosto.

  Stessa disciplina sui `manifestSha`: i due host ne hanno di **diversi per costruzione**
  (misurato: stesso `stamp` `20260828T210637Z`, sha `7b7865d7…` sulla VM e `c384ce8a…` sul
  gemello), quindi confrontarli sarebbe stato un allarme permanente su un sistema sano. Il
  criterio buono è lo `stamp`.

  ### 🔬 Le prove, e la prima è quella che F3 pretendeva

  **① Host spento → `NON-VERIFICATO`, exit 2** — non 0 e non 1. Verificato **senza pipe**
  (una pipe maschera l'exit code) su entrambi i blocchi: clone `exit 2`, ecosistema `exit 2`.
  E un host spento **non può** risultare `FRESCO`: è un caso a sé nella batteria, perché il
  caso felice da solo sarebbe verde anche con uno script che non guarda niente.
  **② Il giro completo, sulle macchine vere** — `deploy DEPLOYATO · clone FRESCO (362 = 362
  migrazioni) · ecosistema ALLINEATO`, exit 0.
  **③ Batteria: 242 ok, 0 falliti** — sette casi nuovi, di cui quattro negativi.

- [ ] **F4 — L'ecosistema Claude, stesso trattamento** — `align-claude-ecosystem` non è
      distruttivo, quindi il rischio è minore e la fase è ultima; ma un allineamento interrotto a
      metà lascia una macchina con plugin misti, che è un guasto silenzioso.
      **fatto =** anche questo armabile, e dichiarato da `verifica-cloni.sh`

## Le prove che devono poter fallire

- **F1** — la prova **è** l'interruzione: si uccide il processo a metà ripristino e si interroga il
  clone. Se risponde, lo swap regge; se non risponde, la fase non è fatta. Provare solo il caso
  felice («il clone finisce e funziona») sarebbe verde anche oggi.
- **F2** — stessa forma: si chiude la sessione **mentre** il clone gira. Se il clone finisce, è
  armato davvero; se muore, il timer non lo ha mai preso in carico.
- **F3** — spegnere il gemello e chiedere il verdetto: deve uscire `NON-VERIFICATO`, non un verde
  ottenuto dal silenzio.

## Chiuso quando

Alla domanda *«posso chiudere la sessione mentre queste attività procedono?»* si risponde **sì** per
tutti e tre i lavori, e la risposta si verifica con un comando invece che ricordarla.
