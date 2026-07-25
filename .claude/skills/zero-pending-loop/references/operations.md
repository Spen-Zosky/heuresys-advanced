# Modelli, budget, `/goal`, degradazione

## Modello ed effort per attivita'

| Attivita' | Modello | Effort | Perche' |
|---|---|---|---|
| Pre-flight, inventari, probe, letture di liste, spunta caselle | haiku | low | estrazione senza giudizio |
| Implementazione su pattern ripetuto (modulo 7-step, fix noto) | sonnet | medium | il pattern e' noto, il rischio e' basso |
| Verifica su DB reale, SQL, SSH, migrazioni | sonnet | medium | serve precisione, non creativita' |
| Review adversarial · decisione di rollback · sintesi del vassoio · decisione di chiudere | modello di sessione | high | e' giudizio |

La regola che le tiene insieme: **il giudizio non si delega verso il basso.** Un modello piu'
piccolo su un compito di estrazione produce lo stesso risultato a meno costo; su un compito di
giudizio produce un risultato plausibile e sbagliato, che e' esattamente il modo in cui il lavoro
non presidiato degenera senza che nessuno se ne accorga.

Nel dubbio, eredita il modello di sessione. Un downgrade silenzioso su un compito di giudizio e' un
errore, non un'ottimizzazione.

## Budget — e perche' non si misura il contesto

**Non hai modo di sapere quanto contesto hai consumato.** Verificato sulla documentazione: nessun
contatore accessibile al modello durante il lavoro, `/context` non e' invocabile in modalita'
headless, gli hook non trasportano informazioni sui token, e quando scatta l'auto-compaction non
esiste alcun segnale osservabile — te ne accorgi solo perche' il turno successivo trova meno
contesto di prima.

La conseguenza e' di disegno, non un dettaglio: **non decidere mai di chiudere basandoti su una
stima del contesto residuo.** Una stima che non puoi verificare e' un'invenzione, e in non
presidiato nessuno la corregge.

Quello che si fa invece: **si limita il lavoro perche' il consumo resti prevedibile**, invece di
misurarlo. La regola operativa e' una sola —

**Un cluster per iterazione** (`clusters_per_iteration` in `zp.config.yaml`, default 1). Chiuso il
cluster, si passa a `close` e il driver apre una sessione nuova. Il contesto consumato da un
cluster e' limitato per costruzione, quindi non ci si avvicina mai al limite e la domanda «quanto
contesto mi resta» non ha bisogno di risposta. Il valore si alza sopra 1 solo per lotti di cluster
di classe A dichiaratamente minuscoli, e resta una scelta di configurazione, non un giudizio in
corsa.

Il limite quantitativo vero lo impone il **driver dall'esterno**, e su `claude 2.1.220` ne esiste
**uno solo**: `--max-budget-usd` (tetto alla spesa dell'invocazione). Verificato su `claude --help`:
`--max-turns` **non esiste** come flag CLI, quindi non contarci. Il tetto ai turni si ottiene per
un'altra via — la clausola `or stop after N turns` dentro la riga `/goal` (vedi sotto), che e'
prompt, non flag.

Quando il tetto di spesa scatta, l'invocazione termina e il driver lo tratta come **troncamento**,
non come fallimento del cluster. La spesa cumulata la misura il driver **fra** le iterazioni,
leggendo `total_cost_usd` dall'output JSON dell'invocazione precedente.

Una regola resta tua: **se un cluster non puo' essere portato a termine per intero — implementazione
piu' due prove piu' tre revisori — non e' eleggibile.** Non si taglia l'adversarial per farlo stare
dentro: senza adversarial non e' lo stesso lavoro, e' lavoro non verificato che sembra verificato.
Meglio un cluster non iniziato che un `INTERRUPTED` da ricostruire.

## `/goal` come contratto di uscita

`/goal` fa valutare da un giudice esterno, dopo ogni turno, una condizione misurabile; se e' falsa
il turno successivo parte da solo. Va usato per iterazione, non per il loop intero — un goal
raggiunto non si riarma.

Riga pronta per un'iterazione:

```
/goal il cluster corrente ha gate verde e due verifiche di tipo diverso registrate e zero rilievi adversarial aperti e il blocco di evidenza DoD presente e la casella spuntata nel piano, or stop after 25 turns
```

La clausola `or stop after N turns` non e' opzionale in non presidiato: senza un limite superiore,
una condizione che non si avvera mai produce turni finche' non finisce qualcos'altro.

Anche quando `/goal` non viene attivato, la condizione sopra resta il contratto di uscita interno:
se non e' vera, il cluster non e' chiuso.

## Degradazione — i casi previsti

| Evento | Cosa fare |
|---|---|
| Tunnel :5433 giu' | riprova 3 volte, poi rialzalo (`ssh -fN -L 5433:...`). Se non risale: solo cluster di classe A, e ogni numero DB va marcato `[non verificato: DB]` |
| CI rossa | **e' il cluster corrente**, con priorita' HARD. Consulta `gh run list` / `gh run watch` come evidenza. Non si bypassa e non si consegna a Enzo |
| Contesto esaurito a metta' cluster | se i gate sono verdi committa il parziale; altrimenti `git stash` + `INTERRUPTED` + riferimento dello stash nel run-record |
| Budget o spend-limit esaurito | salvataggio del parziale, `INTERRUPTED`, chiusura ordinata. Mai troncamento brusco |
| VM o linux-pc non raggiungibile | `skip + warn`, non blocca la chiusura. Ma un canale che **fallisce** su un host **raggiungibile** e' fail-loud: e' un errore, non un salto |
| Conflitto di rebase con una sessione umana | unisci i fatti delle due sessioni. Mai `-X ours/theirs` cieco, mai `--no-verify` |
| Cluster che fallisce due volte | `INTERRUPTED` con ragione verificata, si passa al prossimo (mai un terzo tentativo nella stessa direzione) |
| Un cluster contraddice un invariante `I1`-`I20` | stop, contraddizione registrata con `file:riga`, cluster nel vassoio. Nessun aggiramento |
| `.zp/driver.lock` orfano da piu' di 2h | recupero, con warning nel run-record |
| `.zp/STOP` presente | completa il cluster in corso, `close`, poi stop |

## Run-record e apprendimento

Alla fine di ogni invocazione appendi un record a `.zp/runs.ndjson`:

```json
{"iter": 7, "modo": "resume", "cluster": "Z-042", "classe": "B", "gate": ["typecheck","lint","vitest","psql"],
 "agenti": 3, "token": 184000, "esito": "cluster-closed", "durata_s": 1420, "gotcha": "…"}
```

E se hai imparato qualcosa che la prossima iterazione non dovrebbe ri-scoprire, scrivilo in
`LEARNINGS.md`, nella sezione in prosa. Il criterio per distinguere: nel run-record vanno i
**numeri**, in `LEARNINGS.md` va cio' che cambia il **comportamento** di chi legge.

I parametri adattivi (dimensione dei lotti, modello per famiglia di cluster, soglie) vivono nella
sezione `adaptive:` di `zp.config.yaml` e sono azzerabili in blocco. **I prompt e i template non si
auto-modificano**: cambiano per mano di Enzo o su proposta esplicita. Un impianto che riscrive le
proprie istruzioni mentre gira non e' piu' verificabile.
