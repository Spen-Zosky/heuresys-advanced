# 236 — I lavori remoti si armano, non si appendono alla sessione

> **item**: #236 · **priorità**: P1 · **stima**: ~1 sessione
> **stato**: IN CORSO
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
| `align-clones` / ecosistema Claude | comando remoto via `ssh` in primo piano | ❌ no |
| `clone-vm-db` | idem, **e contiene un `DROP … CASCADE`** | ❌ no, e lascia uno stato rotto |

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

- [ ] **F2 — L'armamento del clone** — sul gemello nasce `heuresys-clone-watch.timer` col mestiere
      del gemello di quello di deploy: la chiusura **arma** (scrive un file-sentinella con lo sha e
      il motivo), il timer esegue, `OnFailure` è quello già in uso, `Persistent=true`.
      `close-propagate.sh` passa da «lancia e aspetta» a «arma e ritorna».
      **fatto =** chiusura della sessione **durante** un clone in corso, e il clone finisce lo stesso
- [ ] **F3 — `verifica-cloni.sh`, gemello di `verifica-deploy.sh`** — stesso vocabolario chiuso, e
      `NON-VERIFICATO` che significa «non ho potuto guardare», mai «a posto». Nominato nella
      sezione *Verification* di `.handoff/STATE.md`, così la risposta a «posso chiudere?» è un
      comando e non una memoria.
      **fatto =** il comando esiste, dichiara i tre lavori (deploy · clone · ecosistema) e ognuno
      porta il proprio verdetto
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
