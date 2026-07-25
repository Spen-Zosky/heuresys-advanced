# zero-pending-loop — guida di riferimento

Un impianto che porta heuresys-advanced verso zero pendenze lavorando da solo, di notte, senza sorveglianza: chiude un pezzo di lavoro alla volta, lo verifica due volte in modi diversi, lo fa demolire da tre revisori indipendenti, e si ferma da sé davanti a tutto ciò che tocca la produzione viva o richiede una decisione di Enzo.

**Creato**: 2026-07-25, sessione Cowork con Enzo Spenuso
**Design**: `docs/superpowers/specs/2026-07-25-zero-pending-loop-design.md`
**Piano di lavoro**: `docs/superpowers/specs/2026-07-25-zero-pending-plan.md`

## Come leggere questo documento

| Se… | Vai a |
|---|---|
| devi solo **usarlo** | §2 Guida d'uso |
| vuoi capire **com'è fatto** | §3 e §4 |
| devi **modificarlo o ripararlo** | §5, §6, §11 |
| ti chiedi **perché è fatto così** | §8 |
| non capisci una parola | §10 Glossario |

---

## 1. Che cos'è, in tre frasi

Il progetto ha un piano di pendenze: 248 pezzi di lavoro censiti, raggruppati in ondate, ognuno con una condizione di chiusura verificabile con un comando.

Questo impianto prende quel piano e lo esegue: sceglie il prossimo pezzo, lo implementa, lo verifica, lo fa criticare, lo corregge, lo committa, aggiorna lo stato e ricomincia — finché non resta niente che possa fare da solo.

Quello che **non** è: non decide la direzione del prodotto, non scopre pendenze nuove fra un censimento e l'altro, e non tocca mai la produzione viva senza il via di Enzo.

---

## 2. Guida d'uso

Tutto passa da un comando: **`zp`**. Va lanciato da una finestra PowerShell — una nuova, se hai appena installato l'impianto, perché il comando si carica all'avvio del profilo.

### I comandi

| Comando | Cosa fa |
|---|---|
| `zp prova` | mostra quali pezzi prenderebbe e in che ordine, senza fare niente |
| `zp avvia` | parte e lavora da solo in background. Puoi chiudere la finestra |
| `zp ferma` | lo fa fermare in modo pulito: finisce il pezzo in mano e chiude bene |
| `zp riprendi` | riparte da dove era rimasto |
| `zp stato` | dice se sta girando, l'età del piano, e mostra l'ultimo rapporto |
| `zp mattina` | il riepilogo del risveglio: stato più tutto ciò che aspetta te |
| `zp vassoio` | cosa è bloccato su di te, e cosa serve esattamente |
| `zp lotto` | cosa aspetta il tuo via perché tocca la produzione |
| `zp lotto ok 2` | dai il via alla voce numero 2 di quella lista |
| `zp giri` | come sono andati gli ultimi dieci giri |
| `zp censimento` | dice quanto è vecchio il piano e cosa comporterebbe rifarlo |
| `zp censimento ok` | rifà il censimento da zero e crea un piano nuovo |
| `zp notte` | dice se ha il turno di notte, e a che ora |
| `zp notte on` | gli dà il turno di notte: parte da solo ogni sera |
| `zp notte off` | glielo toglie |
| `zp help` | ristampa l'elenco con gli esempi |

### Le opzioni

| Opzione | Effetto |
|---|---|
| `-Iterazioni 5` | quanti pezzi per corsa |
| `-Corsia safe` | tocca solo documenti, test e codice annullabile con un revert |
| `-Corsia full` | aggiunge schema e dati, con backup verificato di meno di 24 ore |
| `-Finestra 22:00-07:00` | in quale fascia oraria lavorare |
| `-Budget 40` | tetto di spesa in dollari, solo per il censimento |

### Il ritmo consigliato

La prima volta, un pezzo solo, per giudicare la qualità del lavoro e delle prove:

```
zp avvia -Iterazioni 1
```

Poi guarda `zp giri` (quanto è costato, quanto è durato) e `zp stato` (cosa ha fatto e con quale prova). Se ti convince, alzi i numeri.

A regime, due comandi in tutto:

```
zp notte on      una volta sola
zp mattina       ogni mattina
```

Lui lavora dalle 22 alle 7, tu la mattina guardi cosa ha fatto e sblocchi ciò che aspetta te. Se `zp mattina` dice «niente che aspetti te», chiudi il terminale e vai a fare altro.

Quando serve fermarlo: `zp ferma`. Non tronca niente — finisce il pezzo in mano, fa la chiusura completa (controlli, commit, push, allineamento macchine) e si ferma. Non perdi nulla. Per ripartire: `zp riprendi`.

Dopo mesi di sviluppo tuo: `zp censimento` ti dice quanto è vecchio il piano, `zp censimento ok` ne costruisce uno nuovo sullo stato di oggi.

---

## 3. I tre pezzi, e chi fa cosa

**`zp` — la CLI.** Uno script PowerShell. È l'interfaccia: controlla le condizioni, avvia, ferma, riferisce. Non ragiona sul merito del lavoro.

**Il driver — il loop.** Uno script bash. Apre una sessione, legge com'è andata, ne apre un'altra. Non sa nemmeno cosa sia un pezzo di lavoro.

**La skill — il cervello.** Istruzioni per Claude. Sceglie il pezzo, lo esegue, lo verifica, decide se continuare o chiudere.

```mermaid
flowchart LR
    E(["Enzo"]) -- "zp avvia" --> CLI["zp<br/>la CLI"]
    CLI -- "lancia staccato" --> DRV["il driver<br/>il loop"]
    DRV -- "claude -p<br/>contesto vergine" --> SES["la sessione<br/>qui lavora la skill"]
    SES -- "esito su file" --> DRV
    DRV -- "riapre finche c'e lavoro" --> SES
    SES -- "scrive" --> ST[("stato su file<br/>piano, registro, .zp")]
    ST -- "rilegge" --> SES
    ST -- "PROGRESS.md" --> E
```

Il punto che non è ovvio è perché il loop stia fuori dalla sessione. Una sessione non può azzerare il proprio contesto e proseguire: `/clear` è un comando che dai tu al programma, non un'azione che il modello può compiere su sé stesso. Quindi chi ripete deve stare fuori: ogni volta che il driver lancia `claude`, quella sessione nasce con contesto vergine — ed è quello il `/clear`, ottenuto per costruzione invece che per comando.

Ne segue la regola che governa tutto il resto: **lo stato vive su file, mai in conversazione.** La sessione successiva non ricorda niente, rilegge. Ed è proprio questo che rende l'impianto robusto alle interruzioni brutali — corrente che salta, terminale chiuso, errore del modello: lo stato è su disco, e la ripresa è una lettura.

---

## 4. Come lavora davvero

### Il giro, visto dall'alto

```mermaid
flowchart TD
    A["il driver apre un giro"] --> B{"freno tirato?<br/>fuori finestra?<br/>budget esaurito?"}
    B -- "si" --> STOP(["si ferma, pulito"])
    B -- "no" --> C{"resta lavoro<br/>eseguibile da solo?"}
    C -- "no" --> FINE(["condizione raggiunta<br/>resta solo il vassoio"])
    C -- "si" --> D["claude -p, contesto vergine"]
    D --> E["sceglie un pezzo<br/>vedi i 6 filtri"]
    E --> F["protocollo dei 5 passi"]
    F --> G["commit atomico<br/>con evidenza live"]
    G --> H["chiude la sessione<br/>controlli, push, cloni, handoff"]
    H --> A
```

### I modi della skill

| Modo | Quando | Cosa fa |
|---|---|---|
| `bootstrap` | prima volta, o piano incoerente | apre la sessione, **verifica** il piano invece di rifarlo, aggiorna solo le fonti invecchiate, dichiara le regole con cui opererà |
| `resume` | ogni giro | sceglie un pezzo, lo porta a termine, aggiorna piano e registro, decide se continuare o chiudere |
| `close` | pezzo finito, freno tirato, fine ondata | chiusura completa: controlli, commit, push, allineamento macchine, handoff. Poi segnala al driver di ripartire |
| `recover` | sessione morta senza chiudere | ricostruisce dal cursore e dal working tree: committa il parziale se i controlli sono verdi, altrimenti mette da parte e segna il punto di ripresa |
| `censimento` | solo se lo chiedi tu | rilegge tutto da capo e scrive un piano nuovo |
| `report` | quando vuoi | stato leggibile, non tocca niente |

### Come sceglie il prossimo pezzo

Non a intuito. Applica questi filtri in ordine e prende il primo che sopravvive.

1. **Interrotto a metà**, con un punto di ripresa. Priorità assoluta: è la cosa più fragile che esiste nel repo, perché più resta aperta più svanisce il contesto che la giustificava.
2. **Blocca altro lavoro.** Chiuderne uno ne sblocca N.
3. **Appartiene all'ondata corrente.** Non si salta avanti: le ondate sono ordinate perché la rete di sicurezza — test e CI — protegge tutto ciò che viene dopo.
4. **Ha tutte le dipendenze risolte.** Forzare un pezzo non pronto produce lavoro da rifare.
5. **La sua classe è ammessa dalla corsia attiva.**
6. **Sta nel budget del giro.** Meglio un pezzo chiuso che due a metà.

A parità di tutto, l'effort minore prima: libera caselle e rende il rapporto più informativo per chi legge da fuori.

### Il protocollo di esecuzione: i cinque passi

1. **Implementa** seguendo i pattern del repo. Se per chiudere servisse violare un invariante architetturale, si ferma: niente aggiramenti, il pezzo va nel vassoio con la contraddizione scritta.
2. **Due prove di natura diversa.** Non due test: due *tipi* di prova. L'esempio che chiarisce tutto è un test d'integrazione verde accanto a una query sul database che mostra che la riga non è stata scritta — cosa che due test d'integrazione non avrebbero visto mai. Uno script rifiuta meccanicamente una coppia omogenea.
3. **Tre revisori adversarial.** Contesto vuoto, vedono solo il diff, lenti distinte (correttezza, isolamento e sicurezza, riproducibilità), mandato di demolire. Un rilievo cade solo se almeno due lo smontano.
4. **Corregge e ri-verifica.** Massimo due giri; al terzo il pezzo va interrotto con la ragione verificata.
5. **Commit atomico con evidenza live.** Nessun pezzo si chiude su un test verde: serve una prova su dati reali con comando, output, path e timestamp.

```mermaid
flowchart TD
    P1["1 · implementa"] --> PA["2 · prova A"]
    PA --> PB["2 · prova B"]
    PB --> GATE{"le due prove sono<br/>dello stesso tipo?"}
    GATE -- "si" --> RIF["RIFIUTATO dallo script<br/>serve una prova di altra natura"]
    RIF --> PB
    GATE -- "no" --> P3["3 · tre revisori<br/>mandato: demolire"]
    P3 --> MAG{"il rilievo regge?<br/>meno di due lo smontano"}
    MAG -- "si" --> P4["4 · corregge"]
    P4 --> TER{"e' il terzo giro?"}
    TER -- "no" --> PA
    TER -- "si" --> INT(["interrotto<br/>con la ragione verificata"])
    MAG -- "no" --> P5(["5 · commit atomico<br/>con evidenza live"])
```

Perché i revisori non sono teatro: hanno contesto vuoto, quindi non condividono il punto cieco di chi ha scritto il codice; il mandato è negativo, e un revisore premiato per il «va bene» non è un revisore; la regola di maggioranza evita che uno paranoico blocchi tutto da solo.

### Le cinque classi di rischio

Rispondono a una domanda sola: *se va storto mentre nessuno guarda, quanto male fa e quanto ci vuole a tornare indietro?* È una domanda **indipendente dall'ondata**: un pezzo può essere rapido e pericoloso insieme.

| Classe | Cosa tocca | In automatico | Come si torna indietro |
|---|---|---|---|
| **A** | documenti, spec, test aggiunti | sì | revert, zero conseguenze |
| **B** | codice, senza schema né contratti pubblici | sì | `git revert` del commit atomico |
| **C** | schema e dati | solo in corsia `full`, dopo prova su linux-pc e con backup verificato di meno di 24 ore | restore dal dump |
| **D** | produzione viva: deploy, riavvii, secrets, retention | **mai** | può richiedere intervento manuale |
| **E** | serve una decisione o un input di Enzo | **mai** | non si parte nemmeno |

Corsia `safe` = A + B. Corsia `full` = A + B + C. La classe D non entra mai in automatico, e la garanzia sta nello script che filtra i candidati, non nella disciplina del modello: un controllo che dipende dal buon comportamento di chi lo deve subire non è un controllo.

```mermaid
flowchart LR
    A["A · documenti e test"] --> AUTO(["lo fa da solo"])
    B["B · codice reversibile"] --> AUTO
    C["C · schema e dati"] --> PRE{"corsia full<br/>backup verificato < 24h<br/>prova su linux-pc"}
    PRE -- "tutto vero" --> AUTO
    PRE -- "manca qualcosa" --> SALTA["saltato,<br/>si passa al prossimo"]
    D["D · produzione viva"] --> LOTTO["zp lotto<br/>in coda, aspetta te"]
    LOTTO -- "zp lotto ok N<br/>una voce per volta" --> AUTO
    E["E · decisione o segreto"] --> VASS["zp vassoio<br/>nessuno puo' al posto tuo"]
```

### I controlli, derivati a runtime

Non c'è una lista fissa di test da lanciare: si guarda cosa è stato toccato, con `git diff --name-only`, e si eseguono i controlli di quelle aree soltanto.

| Area toccata | Controlli |
|---|---|
| `apps/api` | typecheck, lint, test sui moduli toccati **e** dipendenti, integrazione sul database reale |
| `apps/web` | typecheck, lint, parità i18n, Playwright sulle spec pertinenti |
| `packages/shared` | typecheck a monte, rebuild dei consumer |
| `db/migrations` | applicate due volte con diff `pg_dump` vuoto, validazione delle 7 viste |
| `scripts`, `deploy` | lint shell e dry-run del percorso modificato |
| `docs/kb` | il linter di handoff, 10 controlli bloccanti |

Un'area toccata senza controlli mappati è un errore bloccante, non un salto silenzioso. E non si lancia mai tutta la suite: costa, e nasconde quale controllo stava proteggendo cosa.

### Lo stato, tutto su file

Chi scrive cosa. La regola che tiene in piedi il disegno è che **la skill non scrive mai nel registro ufficiale**: prepara i blocchi, li fa validare dal linter, e la scrittura la fa `handoff`. Un solo writer per file, nessuna seconda verità.

```mermaid
flowchart LR
    SK["la skill"] -- "spunta le caselle" --> PIANO["piano zero-pendenze"]
    SK -- "scrive" --> ZP[(".zp/<br/>cursore, esito, giri,<br/>PROGRESS, vassoio, lotto")]
    SK -- "prepara i blocchi<br/>e li fa validare" --> HO["handoff"]
    HO -- "unico writer" --> REG[("SOT_BACKLOG<br/>SOT_STATE<br/>DEBT_REGISTER")]
    CLI["zp lotto ok N"] -- "scrive" --> AUT["autorizzazioni.txt"]
    AUT -- "riletto a ogni giro" --> SK
    DRV["il driver"] -- "legge l'esito" --> ZP
    ZP -- "PROGRESS committato" --> GH["GitHub<br/>lo leggi dal telefono"]
```

| File | Cosa contiene |
|---|---|
| il piano zero-pendenze | caselle spuntate più la nota di chiusura con evidenza |
| `docs/kb/SOT_BACKLOG.md` | il registro ufficiale. Ci scrive **solo** `handoff` |
| `.handoff/session-journal.ndjson` | fatti annotati mentre emergono |
| `.zp/cursor.json` | pezzo corrente, passo raggiunto, giro |
| `.zp/last-outcome.json` | il segnale per il driver |
| `.zp/runs.ndjson` | un record per giro: costo, durata, esito |
| `.zp/PROGRESS.md` | la vista umana. Committato a ogni chiusura, così lo leggi su GitHub dal telefono |
| `.zp/vassoio.md` | cosa nessuno può sbloccare al posto tuo |
| `.zp/lotto-presidiato.md` | cosa aspetta il tuo via |
| `.zp/autorizzazioni.txt` | scritto da `zp lotto ok`, letto dalla skill |

### Interrompere e riprendere

Nessun modo di fermarlo perde lavoro, perché lo stato è su disco e ogni chiusura pulita fa push. Cambia solo quanto costa la ripartenza.

```mermaid
stateDiagram-v2
    state "fermo" as F
    state "in corsa" as C
    state "chiusura pulita" as K
    state "sessione morta" as M
    state "recupero" as R
    state "riverifica del piano" as B
    [*] --> F
    F --> C: zp avvia
    C --> C: un giro dopo l'altro
    C --> K: zp ferma, fine finestra, budget
    K --> F: push, cloni allineati, handoff
    C --> M: processo ucciso, corrente saltata
    M --> R: il driver se ne accorge al rilancio
    R --> C: committa il parziale o mette da parte
    F --> B: fermo da piu di 24 ore
    B --> C: nel frattempo il piano puo essersi mosso
    C --> [*]: niente piu di eseguibile da solo
```

---

## 5. Mappa dei file

Nel repo, versionati, viaggiano con git e con `align-clones`:

```
.claude/skills/zero-pending-loop/
    README.md              questo documento
    SKILL.md               il router: modi, contratto col driver, le 5 regole
    references/
        bootstrap.md       prima invocazione e il modo censimento
        selection.md       stato su file, cursore, ordine di scelta del pezzo
        protocol.md        i 5 passi, le coppie di prove, il blocco di evidenza
        adversarial.md     i 3 revisori: lenti, prompt, regola di maggioranza
        blast-radius.md    le classi A-E, le corsie, il formato delle liste
        gates.md           matrice dei controlli e trappole verificate del repo
        operations.md      modelli, budget, /goal, casi di degradazione
        close.md           chiusura sessione, perimetro del push, modo report
        driver.md          interruzione, ripresa, recupero, guard-rail
        zp.config.yaml     LA CONFIGURAZIONE VIVA: tutte le manopole
        LEARNINGS.md       trappole gia' pagate e formato del run-record
    evals/
        trigger-eval.json  20 frasi: 10 devono attivarla, 10 no
        evals.json         6 casi di prova sul comportamento

scripts/zero-pending-driver.sh    il loop                  DA SCRIVERE (T3)
docs/kb/tools/zp_state.py         cursore e selezione      DA SCRIVERE (T3)
docs/kb/tools/zp_gate.py          controlli e prove        DA SCRIVERE (T3)
docs/kb/tools/zp_evidence.py      blocco di evidenza       DA SCRIVERE (T3)
docs/kb/tools/zp_zero_check.py    la condizione di fine    DA SCRIVERE (T3)

docs/superpowers/specs/2026-07-25-zero-pending-loop-design.md
                                  il perche' di ogni scelta
```

Fuori dal repo, sulla macchina Windows:

```
C:\Users\enzospenuso\Claude Desktop\scripts\zp.ps1
    la CLI

D:\enzospenuso\Documents\PowerShell\Microsoft.PowerShell_profile.ps1
    6 righe in fondo: la funzione Invoke-ZeroPending e l'alias zp

D:\heuresys-advanced\.zp\
    stato di runtime, gitignored
```

Le sei righe nel profilo sono nello stesso stile che usi già per `ccds`. Per disinstallare la CLI basta cancellarle.

---

## 6. Configurazione: tutte le manopole

Stanno in `references/zp.config.yaml`. Nessuna soglia, nessun path, nessun perimetro è scritto dentro le istruzioni: se devi cambiare un comportamento, si cambia lì.

| Sezione | Cosa governa |
|---|---|
| `meta.clusters_classified` | **la guardia principale**. Finché è `false`, non esegue nulla |
| `lanes` | quali classi entrano in `safe` e in `full` |
| `budget` | un pezzo per giro, 12 dollari per giro, 120 dollari in tutto |
| `runtime` | i path assoluti di Git Bash e di `claude` |
| `push` | il perimetro del push. Azzerare `enabled` lo revoca |
| `gates` | quali controlli per quale area toccata |
| `class_c_preconditions` | età massima del backup, host di prova, doppia esecuzione |
| `adversarial` | quanti revisori, quali lenti, quanti voti per far cadere un rilievo |
| `hosts` | VM e gemello. Il Mac non è un target, ritirato in S1007 |
| `paths` | dove vive ogni file di stato |
| `interrupt_resume` | soglia di rientro da `bootstrap`, finestra oraria, guard-rail |
| `clusters` | la classificazione dei 248 pezzi. **La compila T1** |
| `adaptive` | parametri auto-appresi. Azzerabile in blocco |

---

## 7. Sicurezza: cosa non farà mai

**Non tocca la produzione viva da solo.** Deploy, riavvio servizi, secrets, retention, backup: tutto in classe D, accodato in `zp lotto`, in attesa del tuo via. E il via si dà una voce per volta, per numero — non esiste un comando che apre tutta la classe D in un colpo.

**Non applica migrazioni al database di produzione** senza averle prima provate su linux-pc, che ha un clone del DB, e senza un backup verificato di meno di 24 ore.

**Non fa `push --force`**, mai, e non pusha con i controlli o il linter rossi. Prima del push: rebase, ri-lint, poi push. Ogni push finisce nel registro dei giri con il suo SHA.

**Non dichiara «fatto» un pezzo perché i test sono verdi.** Serve una prova su dati reali. Se manca un input che solo tu puoi dare, lo stato è `blocked-on-Enzo`, mai `done`.

**Non aggira un invariante architetturale.** Se un pezzo lo richiede, si ferma e te lo mette nel vassoio con la contraddizione scritta.

**Non parte se il repo è sporco.** Se hai modifiche non salvate — perché stavi lavorando tu, o perché una sessione CLI è aperta — il driver si rifiuta e ti stampa i file coinvolti.

**Non parte se i pezzi non sono classificati per rischio**, o se mancano gli script di controllo.

**Non rifà il censimento da solo**, mai, nemmeno dal turno di notte: è l'operazione più cara e la decisione di pagarla è tua.

---

## 8. Vincoli tecnici verificati: il perché del design

Ogni riga qui sotto è stata verificata sul campo il 2026-07-25, non assunta. Se in futuro qualcosa non torna, si riparte da qui invece di ri-diagnosticare.

**Una sessione non può azzerare il proprio contesto.** `/clear` è un comando built-in, non invocabile da una skill. Non esiste un reset di contesto dentro un'invocazione, non esiste un hook sulla compaction, e `--continue` o `--resume` ricaricano il contesto pieno, quindi non risolvono niente. Da qui: il loop vive fuori, in un driver esterno.

**Il contesto residuo non è misurabile dall'interno.** Nessun contatore accessibile al modello durante il lavoro; `/context` esiste ma solo in modalità interattiva, non da `claude -p`; gli hook non trasportano dati sui token; quando scatta l'auto-compaction non c'è alcun segnale osservabile. Da qui: non si misura il consumo, si limita il lavoro. Un pezzo per giro, e la domanda non si pone più.

**`--max-turns` non esiste** su `claude` 2.1.220, verificato con `claude --help`. L'unico tetto quantitativo per invocazione è `--max-budget-usd`. Il limite ai turni si ottiene dalla clausola `or stop after N turns` dentro `/goal`, che è prompt e non flag. Se qualcuno reintroduce `--max-turns` nel driver, il comando muore all'avvio.

**`bash` nel PATH di Windows non è Git Bash.** Risolve allo stub WSL in `WindowsApps\`, che non ha distribuzioni installate e fallisce con un messaggio che non c'entra niente. Il driver va invocato con il path assoluto `C:\Git\bin\bash.exe`, che sta in `zp.config.yaml` sezione `runtime`.

**PowerShell 5.1 rompe il parser sui caratteri estesi.** Trattini lunghi e vocali accentate dentro uno script `.ps1` vengono letti come virgolette e il file non compila, con errori che puntano a righe sbagliate. Per questo `zp.ps1` è in ASCII puro. Questo README no, perché è markdown e lo legge un umano.

**Il costo non cresce in proporzione al contesto, ma molto più in fretta.** Ogni turno rimanda tutto il contesto accumulato, quindi il totale va grosso modo col quadrato della lunghezza finale. È la ragione economica, oltre che tecnica, per cui le sessioni restano corte.

**Il piano zero-pendenze esisteva già** quando questo impianto è nato: censimento del 2026-07-25, 497 voci grezze da 10 ricognitori ridotte a 248 pezzi, con 3 verificatori adversarial e zero voci perse o inventate. Per questo il modo `bootstrap` verifica il piano invece di rifarlo. Rifarlo è un atto deliberato che costa.

**Non tutte le pendenze sono chiudibili da un agente.** Dei 248 pezzi, 218 sono autonomi (circa 924 ore) e 30 no: 19 decisioni di business, 9 dipendenze esterne, 2 segreti. Quindi «zero pendenze» non è una condizione raggiungibile in autonomia. La condizione vera è: zero pezzi autonomi aperti, più un vassoio esplicito di ciò che aspetta te.

**Esiste un solo ambiente ed è produzione**, per l'invariante I15 e l'ADR-0026. Non c'è un ambiente di test dove sbagliare. La rete di sicurezza sono i backup notturni verificati su linux-pc e il fatto che linux-pc sia un gemello con un clone del database. Da qui nascono le classi di rischio e la corsia presidiata.

---

## 9. Stato attuale: cosa esiste e cosa manca

| Pezzo | Stato |
|---|---|
| Design completo | fatto |
| `SKILL.md` più 10 file di reference | fatti |
| Set di prova, trigger e comportamento | scritti, **non ancora eseguiti** |
| CLI `zp` e comando nel profilo | scritta e **provata**: 13 verbi, tutti verificati a mano |
| **T3** — i quattro `zp_*.py` e il driver | **fatti e provati** (2026-07-25) |
| Riga `.zp/` in `.gitignore` | fatta e verificata: runtime ignorato, `PROGRESS.md` no |
| **T1** — classificazione dei 212 pezzi aperti | **fatta**: A=15 B=76 C=81 D=10 E=30. La guardia è aperta |
| **T4** — test di accettazione | **10 su 10 automatici passano**; 4 richiedono una sessione viva |

La classificazione non è una lista scritta a mano ma un classificatore — `docs/kb/tools/zp_classify.py` — che deriva la classe dal testo di ogni cluster e porta con sé la parola che l'ha decisa, quindi è contestabile. I 24 pezzi proposti come classe D sono stati riletti uno per uno: **14 erano falsi positivi** (la regola agganciava «deploy», «PROD» o «disco» dove comparivano per ragioni innocue, tipo `test:e2e:prod`) e sono registrati come override espliciti, con il motivo, così restano validi anche quando la regola girerà su un piano nuovo.

I test si rilanciano quando vuoi con `python docs/kb/tools/zp_selftest.py`. I quattro che restano — bootstrap che non ri-censisce, freno a metà lavoro, troncamento da budget, frontiere della description — sono elencati come `[a mano]` invece di essere finti verdi: un test che non gira e non lo dice è peggio di un test assente.

Il piano è cresciuto: **253 cluster**, non i 248 dichiarati nella sua intestazione. 41 chiusi, 212 aperti, di cui **182 eseguibili da solo** (circa 896 ore) e **30 che aspettano Enzo** — 19 decisioni di business, 9 dipendenze esterne, 2 segreti. La ripartizione combacia esattamente con quella dichiarata dal censimento.

Finché T1 manca, la guardia `meta.clusters_classified: false` ferma tutto: il driver esce con codice 3 e la skill si ferma con esito `blocked`. È voluto — nessun lavoro autonomo su produzione senza sapere quali pezzi possono spegnerla.

### Cosa è stato verificato davvero, e come

| Cosa | Prova |
|---|---|
| il parser legge il piano | 253 cluster, 30 su Enzo ripartiti 9/19/2 come da intestazione |
| l'integrità del piano regge | zero rilievi: dipendenze tutte risolte, ogni aperto ha il suo *chiuso quando*, ogni chiuso la sua nota |
| il rifiuto delle prove omogenee funziona | 10 coppie provate: `integration+integration`, `integration+e2e`, `unit+e2e`, `live+psql` rifiutate; `integration+psql`, `integration+unit`, `staticcheck+runtime`, `e2e+psql`, `migrate2+dbvalidate`, `staticcheck+integration` ammesse |
| l'evidenza è vera, non scritta a memoria | prova registrata eseguendo un comando reale e catturandone l'output; con una sola prova la validazione rifiuta |
| la condizione di fine funziona | esce 1 elencando cosa manca; salta correttamente i criteri di rete con `--no-net` |
| la guardia sulla classificazione | driver esce **3** e lo dice |
| la guardia sul repo sporco | driver esce **4** ed elenca i file coinvolti |
| il freno | con `.zp/STOP` presente non parte |

---

## 10. Glossario

**Cluster**, o «pezzo di lavoro» — un'unità di lavoro coerente che si chiude in una volta sola. Ne esistono 248, censiti nel piano. Ognuno ha un effort stimato, una condizione di chiusura eseguibile con un comando, eventuali dipendenze, e un flag che dice se serve Enzo.

**Ondata**, da W0 a W6 — l'ordine di attacco. W0 ciò che è rotto adesso, W1 cose rapide che tolgono rumore, W2 la rete di sicurezza fatta di test e CI, W3 dati e database, W4 frontend e sicurezza, W5 prodotto, W6 ciò che dipende da Enzo. La logica è: prima ti metti in sicurezza, poi costruisci.

**Classe**, da A a E — quanto è pericoloso un pezzo se va storto senza nessuno che guarda. È indipendente dall'ondata: un pezzo può essere rapido e pericoloso insieme.

**Corsia**, `safe` o `full` — quali classi il loop può eseguire in questa corsa.

**Vassoio** — la lista di ciò che nessuno può sbloccare al posto tuo: decisioni di business, input esterni, segreti.

**Lotto presidiato** — la lista di ciò che il loop potrebbe fare ma che tocca la produzione, e aspetta solo il tuo via.

**Giro**, o iterazione — una invocazione di `claude` da parte del driver. Di norma chiude un pezzo, poi la sessione si chiude.

**Freno** — il file `.zp/STOP`. Chi lo trova finisce il pezzo in mano, chiude bene, si ferma.

**Due prove di natura diversa** — due *tipi* di verifica, non due esecuzioni della stessa. La coppia omogenea viene rifiutata da uno script, non scoraggiata da una raccomandazione.

**Revisori adversarial** — tre agenti con contesto vuoto e mandato di demolire, su lenti distinte.

---

## 11. Ricette di manutenzione

| Devo… | Dove metto le mani |
|---|---|
| cambiare i tetti di spesa | `references/zp.config.yaml`, sezione `budget` |
| revocare l'autorizzazione al push | `zp.config.yaml`, `push.enabled: false` |
| aggiungere un controllo per un'area nuova | `zp.config.yaml` sezione `gates`, più la riga in `references/gates.md` |
| cambiare la classe di un pezzo | `zp.config.yaml`, sezione `clusters` |
| aggiungere una lente ai revisori | `zp.config.yaml` `adversarial.lenses`, più il prompt in `references/adversarial.md` |
| annullare gli adattamenti auto-appresi | `zp.config.yaml`, svuota `adaptive` |
| aggiungere un comando alla CLI | `zp.ps1`: un ramo nello `switch` e una riga in `MostraComandi` |
| disinstallare la CLI | cancella le 6 righe in fondo al profilo PowerShell |
| togliere il turno di notte | `zp notte off` |
| far ripartire tutto da un piano nuovo | `zp censimento ok` |

Due regole che non vanno rotte facendo manutenzione. La prima: i prompt e i template non si auto-modificano, cambiano per mano di Enzo o su proposta esplicita — un impianto che riscrive le proprie istruzioni mentre gira non è più verificabile. La seconda: la skill non diventa mai writer dello stato ufficiale, che resta dominio di `handoff`, altrimenti si creano due verità sullo stesso file e la prima divergenza costa una sessione intera di indagine.
