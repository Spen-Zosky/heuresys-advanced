# Piano: velocizzare le prove automatiche e i rilasci (22/11/2026)

Stato: PROPOSTA, da decidere da Enzo. Nessun file di CI e nessuno script di rilascio è stato toccato.
Richiesta di Enzo: «non c'è una strategia per rendere le prove più veloci?» e «non si può parallelizzare su più macchine?».

## Misura

Fonte: GitHub Actions, le 400 corse più recenti di heuresys-advanced (dal 20/11 23:46Z al 22/11 00:16Z, circa 24 ore), 706 job letti con `gh api repos/Spen-Zosky/heuresys-advanced/actions/runs/<id>/jobs`. Coda = `started_at - created_at` del job; esecuzione = `completed_at - started_at`. Solo job conclusi (success/failure). Il campione è di un giorno solo e include una nottata di rilasci: gli ordini di grandezza sono affidabili, i decimali no.

| job | n | coda mediana (min) | coda p90 | esecuzione mediana | esecuzione totale |
|---|---|---|---|---|---|
| Test (api integration) | 20 | 9 | 31 | 18 | 416 |
| Playwright smoke | 30 | 8 | 56 | 11 | 305 |
| Typecheck | 43 | 16 | 50 | 4 | 159 |
| Lint | 45 | 13 | 55 | 3,5 | 145 |
| Build (web) | 17 | 12 | 91 | 7,5 | 124 |
| i18n parity | 10 | 19 | 58 | 1,6 | 19 |
| File generati | 24 | 8 | 33 | 0,2 | 6 |
| Attese che bloccano (censimento) | 21 | 6 | 52 | 0,2 | 4 |
| Shell tests | 6 | 6 | 60 | 1,1 | 8 |
| i job «tree» e Rilascio libero (runner VM) | circa 130 | meno di 1 | 2 | 0,3 | circa 40 |
| CodeQL (runner GitHub) | 24 | 0 | 0 | 3,8 | 96 |

Letture:
1. Il tempo perso è quasi tutto attesa, non esecuzione. Lint, typecheck, i18n, file-generati e censimento eseguono in 0,2-4 minuti ma aspettano 8-19 minuti (p90 50-60). Si mettono in fila dietro i due job pesanti (integration 18 min, smoke 11 min) perché tutti chiedono lo stesso gruppo `[self-hosted, off-prod]`.
2. Il lavoro totale è modesto: circa 1.200 minuti di runner pesante in 24 ore. Su due runner è un carico medio di circa il 40%: il problema sono i picchi (più push in pochi minuti), non la potenza.
3. Dove i job non fanno coda funziona: i job sulla VM (`oci-vm`) e CodeQL sui runner di GitHub partono in meno di 2 minuti.
4. Il lavoro è già distribuito. Nel campione i job off-prod hanno girato su `linux-pc-runner` (enzo-s550cm), `mod-hpz420workstation-runner` (la Z420 avviata in Debian) e, poco, `oracle-vm-runner-2`. Sul runner di sola lettura `oracle-vm-default-runner` girano i controlli leggeri. Non è stato possibile elencare i runner e il loro stato (l'API dei runner non è raggiungibile da questa sessione): da verificare in Impostazioni > Actions > Runners.

## Più macchine: si può, e in parte è già così

- Esistono già runner su tre macchine fisiche: il PC Linux enzo-s550cm, la Z420 e la VM.
- La Z420 è una macchina sola con due sistemi: DESKTOP-E6VGGAE (Windows) e mod-hpz420workstation (Debian) non girano mai insieme. Il runner c'è solo sul lato Debian; con Windows acceso quel runner è spento e resta un solo runner off-prod. Va contato come mezza macchina.
- I due PC Windows non servono: le prove usano bash, PostgreSQL 16 nativo e percorsi Linux (sarebbe una riscrittura, non un'installazione). Il Windows della Z420 è la stessa macchina del runner Debian.
- Rischio sicurezza: un runner self-hosted esegue il codice delle PR sulla macchina. Va bene finché il repo è privato e senza PR da fork; su un portatile personale significa far girare codice sul proprio PC. Un runner in più sulla VM di produzione (già così per i job «oci-vm», che per questo usano `pull_request_target` e non eseguono codice della PR) non va usato per i job pesanti: toglierebbe CPU e disco alla produzione.
- Rischio macchine spente: con la Z420 su Windows o con enzo-s550cm spento (il 13/11 un aggiornamento apt ha anche fatto cadere una corsa) i job restano in coda senza avviso.

Conclusione: aggiungere altre macchine non è la leva principale. Conta separare i job leggeri da quelli pesanti.

## Proposte in ordine di valore

| # | cambio | tempo risparmiato (stima) | costo | rischio |
|---|---|---|---|---|
| 1 | Etichetta `leggero` e due-tre istanze di runner leggere sulle macchine già esistenti (un servizio systemd in più su enzo-s550cm e sulla Debian, nessuna macchina nuova). Lint, typecheck, i18n, file-generati, censimento, shell-tests, state-lint passano da `off-prod` a `leggero`; i pesanti restano su `off-prod`. | Coda dei job leggeri da 8-19 min (p90 50-60) a meno di 2. Il semaforo di una PR si completa in circa 4-5 min invece di 15-20, tranne i due pesanti. | Zero spesa, circa mezza giornata di lavoro per thread. | Basso: più processi sulla stessa CPU; limitare a 2 job leggeri per istanza e controllare l'uso di RAM durante integration. |
| 2 | Sulla stessa base, 2 runner pesanti invece di 1 effettivo: tenere acceso il runner Debian della Z420 (non avviarla in Windows durante i rilasci) e ripristinare `oracle-vm-runner-2` come pesante solo fuori orario. | Coda di integration e smoke da 9 e 8 min mediani (p90 31 e 56) a circa 2. | Zero. Richiede una regola di Enzo sull'avvio della Z420. | Medio: la macchina di Enzo in uso pesante rallenta anche le prove (a 13/11 la suite superò 35 min). |
| 3 | Dividere integration e smoke in due metà (`vitest --shard`, `playwright --shard`) su due runner insieme. | Da 18 a circa 10 min e da 11 a circa 6 min, ma solo se i due runner sono liberi: con un solo runner non si guadagna niente. | Un thread di lavoro; zero spesa. | Medio: i due metà devono usare database usa-e-getta distinti (già così dal 18/11) e non pestarsi sulle porte. Va dopo 1 e 2. |
| 4 | Runner a pagamento di GitHub per i soli job leggeri e senza database (lint, typecheck, i18n, file-generati). CodeQL gira già così con coda zero. | Come la 1, senza toccare le macchine. | Orientativamente qualche euro al giorno di minuti (circa 500-1.000 min/giorno); da confrontare con i minuti inclusi nel piano GitHub di Enzo. Spesa: decisione di Enzo. | Basso. Rende la CI indipendente da PC spenti. |
| 5 | Un lavoro in più non fatto qui: smoke e integration già non girano su PR di sola documentazione (PR #309) e su main non si rifanno con lo stesso albero (`tree-gia-verificato`). Resta da misurare quanti job superati vengono ancora annullati a corsa avviata. | Non stimato | Zero | Basso |

Ordine consigliato: 1, poi 2, poi se non basta 3 o 4. Insieme 1 e 2 tolgono la gran parte dell'attesa vista stanotte con zero spesa.

## Rilascio: perché lo sha armato non è partito, e come evitarlo

Fatti letti nel repo (`scripts/blocco-rilascio.sh`, intestazione):
- `deploy-watch.sh` deploya solo se `origin/prod == origin/main`. Se dopo l'armo si unisce una PR, la punta non è più quella autorizzata e il deploy non parte.
- Dal 20/11 (#329) il controllo `rilascio-libero` è richiesto su main e dovrebbe bloccare le unioni mentre un rilascio è armato. Quello di stanotte (21d8d4f7, con la PR #377 unita nel blocco) mostra che il blocco può comunque essere aggirato. Non ho potuto leggere la configurazione della protezione di main né il log di quella sera: le cause possibili sono (a) la PR #377 era già approvata e unita nell'intervallo tra l'armo e la prima pubblicazione dello stato da parte di `riconcilia`; (b) l'unione è passata da un'eccezione agli amministratori o da un'unione automatica già accodata; (c) lo stato `rilascio-libero` è arrivato in ritardo rispetto al click. Va verificato con `gh api repos/Spen-Zosky/heuresys-advanced/branches/main/protection` e con l'ora di armo contro l'ora di unione di #377.

Proposte:
- R1 (la più robusta, raccomandata): far deployare a `deploy-watch` lo sha armato e autorizzato anche se main è andata avanti, purché lo sha sia antenato di `origin/main`, la CI sia verde su quello sha e `prod` avanzi solo in avanti (`merge-base --is-ancestor`). Produzione resta indietro di qualche commit, come già accade tra un rilascio e l'altro, e il rilascio successivo porta il resto. Così nessuna unione può invalidare un rilascio, e non serve più fermare main: il blocco `rilascio-libero` e la serializzazione sparirebbero (punto 3 del problema di stanotte). Rischio: tocca lo script che arma la produzione, quindi con prove dedicate e il sì di Enzo; la guardia G1 di `rilascia.sh` (commit su `origin/main`) resta.
- R2 (se Enzo preferisce tenere il blocco): scrivere il blocco prima del push su `prod`, farlo in modo sincrono con la pubblicazione dello stato su tutte le PR aperte, e abilitare «Do not allow bypassing the above settings» sulla protezione di main (decisione di Enzo, tocca le impostazioni del repo).
- R3 (mitigazione già utile): se il deploy non parte perché la punta è cambiata, `deploy-watch` dovrebbe dirlo (stato DISALLINEATO) e il thread di rilascio rilanciare `rilascia.sh <nuova punta>` subito, senza aspettare che la CI di tutto il resto ricominci da capo; con R1 questo caso non si presenta.

## Decisioni per Enzo

1. Via libera all'etichetta `leggero` (proposta 1) e alla regola sull'avvio della Z420 (proposta 2).
2. Spesa per i runner a pagamento solo per i job leggeri (proposta 4): sì o no.
3. R1 (deploy dello sha armato anche se main è avanzata) al posto del blocco di main, oppure R2.

## Esiti al 22/11 (decisioni di Enzo: sì a tutto, tranne i runner a pagamento)

- Etichetta `leggero`: fatta (#388); i sei job leggeri hanno due runner (enzo-s550cm e Z420 Debian) e l'attesa è scesa da minuti a secondi o pochi minuti. Cartella pnpm per istanza di runner: #394.
- Deploy dello sha armato anche se main è avanzata (R1): scritto in #387, ma la prova dal vivo è fallita (il blocco veniva cancellato da `togli`, che serve per unire); corretto in #410 con una traccia d'autorizzazione separata. Resta da provare al prossimo rilascio.
- Atlante: la PR dell'atlante non fa più girare integration e smoke, e il timer lavora per numero di PR (#404).
- Prove di integrazione in due metà: #389 unita; la corsa di prova è verde (circa 10 minuti per metà), ma il guadagno vero richiede due runner pesanti liberi. Smoke in due metà: non fatta, da decidere dopo la prima corsa reale.
- Runner a pagamento: no, per ora.
- Blocco di main: resta finché R1 non ha la sua prova dal vivo.

## Cosa non è stato fatto

Alla stesura del piano (prima degli esiti sopra) non era stata fatta nessuna modifica. Le stime di risparmio sono calcolate sul campione di 24 ore e vanno riverificate dopo il primo cambio con lo stesso comando.
