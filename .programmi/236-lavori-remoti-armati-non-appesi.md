# 236 — I lavori remoti si armano, non si appendono alla sessione

> **item**: #236 · **priorità**: P1 · **stima**: ~1 sessione
> **stato**: NON AVVIATO
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

- [ ] **F1 — Lo swap atomico, che vale anche senza il resto** — il clone smette di droppare in
      place: ripristina in schemi di lavoro (`sys_new`, …) e alla fine fa lo scambio con
      `ALTER SCHEMA … RENAME` dentro **una** transazione. È DDL, quindi è istantaneo e
      transazionale in PostgreSQL: o c'è il clone vecchio, o c'è quello nuovo, **mai il vuoto**.
      ⚠ **Questa fase da sola toglie il rischio peggiore** — un'interruzione non lascerebbe più
      niente di rotto, solo un lavoro da rifare — e non dipende da F2/F3.
      **fatto =** interruzione **provata** a metà ripristino (kill del processo), e il clone
      vecchio è ancora lì, interrogabile
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
