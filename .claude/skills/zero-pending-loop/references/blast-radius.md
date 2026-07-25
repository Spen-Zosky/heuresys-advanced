# Raggio d'impatto — le classi e le corsie

## La domanda a cui rispondono

Non «quanto costa questo cluster» ne' «quanto e' urgente», ma: **se va storto mentre nessuno guarda, quanto male fa e quanto ci vuole a tornare indietro?**

E' una domanda separata dall'ondata, e va tenuta separata. Un cluster puo' stare in W1 — mezz'ora di lavoro, effort minimo — e essere capace di spegnere la produzione. L'ondata dice *quando conviene farlo*; la classe dice *se si puo' fare senza Enzo*. Confonderle e' il modo piu' diretto per fare danni con la scusa che era un lavoretto.

Il contesto che rende la cosa seria: per invariante `I15` / ADR-0026 esiste **un solo ambiente ed e' produzione**. Non c'e' un ambiente di test dove sbagliare. La rete di sicurezza sono i backup notturni verificati con `pg_restore --list` su linux-pc, e il fatto che linux-pc sia un gemello prod con un clone locale del DB — cioe' il posto giusto dove provare le cose rischiose prima.

## Le cinque classi

| Classe | Cosa tocca | Corsia non presidiata | Precondizione | Come si torna indietro |
|---|---|---|---|---|
| **A** inerte | `docs/`, spec, register, commenti, test aggiunti | si | gate verde | revert, nessuna conseguenza |
| **B** codice reversibile | `apps/api`, `apps/web`, `packages/shared` senza migrazione e senza cambio di contratto pubblico | si | gate verde + adversarial | `git revert` del commit atomico |
| **C** schema e dati | `db/migrations`, seed, brownfield, `sys.*` | si, **solo in `--lane full`** | prova su linux-pc (DB clone) + dump verificato < 24h + migrazione idempotente due volte con diff `pg_dump` vuoto | restore dal dump verificato |
| **D** runtime produzione | `vm-deploy`, restart systemd, `.env`/secrets, alerting, retention, backup, disco | **no, mai** | autorizzazione di Enzo per lotto | dipende — puo' richiedere intervento manuale |
| **E** bloccato su Enzo | decisione di business, input esterno, segreto | no | l'input di Enzo | n/a |

`--lane safe` esegue A e B. `--lane full` aggiunge C. **D non entra mai in corsia non presidiata**, e la garanzia sta nello script che filtra i candidati, non nella disciplina del modello: un controllo che dipende dal buon comportamento di chi lo deve subire non e' un controllo.

## Cosa fare con un cluster non ammesso

Non «rinviarlo» genericamente. Accodalo nel lotto presidiato — `.zp/lotto-presidiato.md` — con: identificativo, classe, perche' e' in quella classe, cosa farebbe esattamente, e cosa serve per autorizzarlo. Riportalo in `PROGRESS.md`, perche' e' una delle due cose che Enzo deve poter leggere da remoto (l'altra e' il vassoio bloccati-su-Enzo).

La differenza fra le due liste conta: il **lotto presidiato** e' lavoro che tu potresti fare e che aspetta solo un via; il **vassoio** e' lavoro che tu non puoi fare in nessun caso.

### Il formato delle due liste (lo legge la CLI `zp`)

Enzo le consulta con `zp lotto` e `zp vassoio`, che numerano le righe. Quindi ogni voce va scritta su **una riga sola**, in questa forma, altrimenti la CLI non la vede:

```
- <ID> | <classe o motivo> | <cosa serve, in una riga>
```

Esempi:

```
- Z-061 | D | attiva la retention dei dump e cambia il timer systemd
- Z-118 | segreto | serve la app-password Outlook per il canale di notifica
```

### Come arriva l'autorizzazione di Enzo

Enzo autorizza una voce con `zp lotto ok 2`, che appende una riga a `.zp/autorizzazioni.txt`:

```
Z-077 | autorizzato da Enzo | 2026-07-25T17:17:44
```

**Leggi quel file all'inizio di ogni iterazione.** Un cluster di classe D il cui ID compare la' dentro diventa eleggibile in quel giro, anche in `--lane safe`: l'autorizzazione e' per voce singola e non si estende agli altri cluster di classe D. Quando lo chiudi, togli la voce dal lotto presidiato — se resta, alla prossima lettura sembrerebbe ancora in attesa.

Nota il perimetro: l'autorizzazione vale per **quell'ID**, una volta. Non e' un interruttore che apre la classe D.

## Come si classifica un cluster (se la classe manca)

Non indovinarla. Un cluster senza classe in `zp.config.yaml` non e' eleggibile: segnalalo e passa al prossimo. Se Enzo chiede di classificarne di nuovi, il criterio e' meccanico — si guarda quali path il cluster dichiara di toccare:

- solo `docs/**`, `*.md`, file di test → **A**
- `apps/**`, `packages/**` senza `db/migrations/**` e senza rimuovere/rinominare un export pubblico
  o un campo di risposta API → **B**
- qualunque cosa sotto `db/**`, oppure una scrittura di massa sui dati → **C**
- `deploy/**`, `scripts/vm-*`, `.env*`, `.secrets/**`, systemd, retention, backup, alerting → **D**
- `needsEnzo != NO` nel piano → **E**, indipendentemente dai path

Nel dubbio fra due classi si prende **la piu' alta**. Il costo di trattare un cluster B come C e' mezz'ora in piu'; il costo opposto e' la produzione giu' di notte.

## Un caso che vale la pena nominare

Un cluster di classe C il cui dump verificato e' piu' vecchio di 24 ore **non si esegue**, anche se tutto il resto e' verde, anche in `--lane full`. La precondizione non e' burocrazia: e' la differenza fra «annullabile» e «irreversibile». Se il dump e' vecchio, la cosa giusta e' far girare `pull-prod-backups.sh` — che e' a sua volta classe D, quindi va nel lotto presidiato — e passare a un altro cluster.
