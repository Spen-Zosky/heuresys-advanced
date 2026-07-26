# Armonizzazione dell'ecosistema Claude con il context engineering per i modelli Claude 5

**Fonte analizzata**: Thariq (@trq212), *"The new rules of context engineering for Claude 5 models"*, Anthropic / Claude Code, 24 luglio 2026 — `https://x.com/trq212/article/2080710971228918066`
**Data analisi**: 2026-07-26 · **Metodo**: 12 agenti (7 audit d'inventario + 1 analisi conflitti + 3 revisori avversariali + 1 sintesi), 555k token, 32 minuti
**Stato sessione**: sola lettura sul repo — nessuna modifica applicata, questo è un piano per sessioni future

---

## In sintesi

Il tuo setup non ha un problema di peso. Ha un problema di **sovranità**.

Sette documenti si dichiarano ciascuno sovraordinato agli altri e nessuno dice come si risolve un disaccordo fra loro. Il risultato è che il modello arbitra per salienza — cioè per quale regola gli capita più vicina nel contesto — e la stessa richiesta produce comportamenti diversi in sessioni diverse. I 34.877 token sempre residenti sono la conseguenza di questo, non la causa.

I 24 conflitti inter-strato non sono sparsi a caso: si addensano nei quattro momenti in cui il modello deve **decidere** invece che eseguire. Prima di toccare un file. Alla fine di un task. Davanti a un errore che non gli era stato chiesto di guardare. Al primo turno di sessione.

Il più grave è il gate di approvazione: quattro prescrizioni incompatibili convivono residenti — chiedi il permesso, l'override non si applica, classi A e B, esegui senza chiedere — più una memoria marcata CARDINALE che dice l'opposto delle altre. La riga di override aggiunta stamattina durante il `/doctor` non lo risolve: lo sposta di un livello.

Tre affermazioni scritte nei file sempre caricati sono **false**, verificate tali: che `cmd.exe` non sia nel PATH (risolve regolarmente su bash, PowerShell 5.1 e 7.6), che non esista uno split unit/integration nei test (`vitest.unit.config.ts` esiste ed è il default di `pnpm test`), e il divieto d'uso di Drizzle per i select (Drizzle non compare in `package.json`, nel lockfile né in `src/`). E il setup produce da solo un dubbio permanente sulle proprie regole: l'allarme "segnala se le regole visibili sono meno di 23" scatta **a ogni sessione**, perché le regole sono 22 — manca la numero 19.

Il vincolo che nessuno aveva modellato: `~/.claude` **non è un repository git**, e ogni sua modifica viene propagata con `rm -rf` su VM e linux-pc alla prima chiusura di sessione, senza smoke test. Per questo il piano parte dalla rete di sicurezza e non dai tagli.

Il piano restituisce circa 20.000-21.500 token residenti, il 60% del totale. Meno dell'80% ottenuto da Anthropic, e per un motivo legittimo: il tuo setup ha una quota reale di gotcha hardware, OS e rete che il modello non può derivare da nessun repository.

---

## I numeri

| Strato | Byte | Token residenti | Rilievi | Sempre caricato |
|---|---:|---:|---:|---|
| CLAUDE.md progetto heuresys-advanced | 36.614 | 9.153 | 69 | sì, nel progetto |
| CLAUDE.md globale utente | 29.950 | 7.488 | 49 | sì, in **ogni** progetto |
| Skill (utente + progetto + plugin attivi) | — | 7.000 | 32 | sì, le description |
| Hook SessionStart e rituale di boot | 12.156 | 5.466 | 26 | sì, a ogni avvio |
| Preferences Cowork | 12.153 | 3.022 | 26 | sì, solo in Cowork |
| MEMORY.md (indice memoria) | 10.991 | 2.748 | 60 | sì, l'indice |
| BEHAVIOR_RULES.md v3.0.0 | 64.220 | 0 (16.055 se caricato) | 50 | no — dormiente ma armato |
| **Totale** | | **34.877** | **312** | 31.855 in sessione CLI |

Distribuzione della tensione sui 312 rilievi: 25 critici, 98 alti, 85 medi, 58 bassi, 46 senza tensione.
Distribuzione sui 24 conflitti inter-strato: 7 critici, 9 alti, 7 medi, 1 basso.

Altri numeri misurati che contano:

- L'hook di boot **ristampa 10.189 caratteri** (~2.547 token) di un CLAUDE.md che è già interamente in contesto: è il 46% del payload di avvio e il 93% dell'output di quell'hook.
- **R23 esiste in tre copie** (~2.290 token cumulativi) e le tre copie sono **già divergenti** fra loro sul mapping degli strumenti.
- Le 55 memorie valgono ~49.200 token se richiamate tutte; **7 file da soli valgono 12.400 token**, un quarto dello strato, e 5 di quei 7 sono duplicati o obsoleti.
- Quattro conteggi in drift nei file sempre caricati: ~75 moduli dichiarati contro 90 misurati, 13 pagine ESS contro 29, SoT dichiarata 427 KB contro 538 KB reali, e 161 contro 162 utenti **nello stesso file**.
- BEHAVIOR_RULES collide su **22 numeri** con R1-R23 del globale, con **5 inversioni semantiche** (stesso numero, significato opposto).

---

## Le sei tensioni dell'articolo, applicate al tuo setup

### A1 — Da regole a giudizio

L'articolo: i vincoli servivano a evitare il caso peggiore con modelli più vecchi; oggi molti si cancellano e si lascia decidere il modello dal contesto circostante.

Il tuo setup va nella direzione opposta e lo fa in modo cumulativo: 22 regole nel globale, 32 in BEHAVIOR_RULES, 20 invarianti di progetto, 21 memorie di feedback prescrittive. Ogni incidente ha prodotto una regola, nessuna regola è mai stata ritirata quando il modello è migliorato. Lo scettico del vincolo ha ribaltato **12 verdetti** di "tenere": regole come "pensa prima, agisci dopo", "correggere ogni errore", "anti-bias cognitivi", "strategia multi-tool" descrivono comportamenti che Opus 5 e Fable 5 tengono già senza istruzione — occupano contesto e capacità di arbitrato senza cambiare l'output.

**Gravità: alta.** Interventi: onde B e C.

### A2 — Da esempi a design delle interfacce

L'articolo: gli esempi restringono lo spazio di esplorazione; meglio progettare strumenti con parametri espressivi.

Il tuo caso più netto è il mapping strumento→compito dentro R23: sei coppie fisse ("filesystem Windows → Desktop Commander", "git → Windows-MCP PowerShell") scritte in un file caricato **anche da Claude Code CLI**, dove Desktop Commander e Filesystem MCP non esistono. Il modello legge un'istruzione obbligatoria che nomina strumenti assenti, e deve dedurre da solo che non si applica.

**Gravità: alta.** Interventi: WB-01, WB-02, WC-01.

### A3 — Da tutto in anticipo a progressive disclosure

L'articolo: è un mito che CLAUDE.md e SKILL.md debbano essere il repository centrale di ogni pratica; meglio un albero di file caricati al momento giusto. E i tool a caricamento differito via ToolSearch esistono apposta per non occupare contesto.

Qui c'è l'inversione più letterale di tutte: le tue preferences Cowork **impongono di caricare 16 schemi di tool al turno #1 usando ToolSearch** — cioè usano il meccanismo del deferred loading per fare l'esatto contrario di ciò per cui esiste. In parallelo, `graphify/SKILL.md` è un unico file da 68.780 caratteri senza alcuno split, e il CLAUDE.md di progetto contiene per intero il pattern modulo in 7 passi, la catena dei 13 plugin Fastify e l'albero di directory — tutto materiale che il repo mostra da solo.

**Gravità: critica.** Interventi: WF-03, WE-08, WC-12, WD-09.

### A4 — Da ripetersi a descrizioni semplici

L'articolo: le istruzioni d'uso di uno strumento stanno nella descrizione dello strumento, non ripetute altrove.

R23 in tre copie divergenti. I quirk PowerShell duplicati fra globale e progetto. La sezione SSH ripetuta nei blocchi Mac, VM e linux-pc. Le memorie che riscrivono ciò che è già nei CLAUDE.md. Il boot che ristampa il CLAUDE.md già residente.

**Gravità: alta**, ma è la categoria a rischio più basso: è deduplicazione meccanica, senza decisioni semantiche. Interventi: onda C.

### A5 — Da memoria in CLAUDE.md ad auto-memory

L'articolo: Claude oggi salva da sé le memorie rilevanti.

Il tuo albero di 55 memorie è stato costruito a mano prima che l'auto-memory esistesse, e ha assorbito tre cose diverse: fatti durevoli (legittimi), regole comportamentali travestite da memoria (i `feedback_*` con "Why" e "How to apply" — sono vincoli residenti che competono con i CLAUDE.md), e cronaca di sessione ormai consumata. Tre memorie esistono **solo per dire di non rifare qualcosa**, e MEMORY.md le marca esplicitamente come storiche.

**Gravità: media**, ma è l'onda con la resa più alta in assoluto (~19.800 token). Interventi: onda G.

### A6 — Da spec semplici a rich references

L'articolo: meglio artefatti HTML, codice, una test suite come spec, rubriche verificate da agenti.

È l'unico asse dove non sei in tensione: sei già oltre. `build_atlas.py` ri-deriva la conoscenza cross-layer dal DB reale, `session_start.py` genera il menu dal registro, `handoff_lint.py` verifica l'integrità con 10 check bloccanti. Hai già le "rich references" che l'articolo raccomanda. Il problema è che **coesistono con la prosa che descriveva il mondo prima che quegli script esistessero**, e la prosa non è mai stata cancellata.

**Gravità: bassa.** Intervento: sostituire prosa con puntatori agli script (WC-15, WC-17, WD-09).

---

## I sette conflitti critici

Questi sono i punti dove due pezzi del tuo setup dicono cose opposte, entrambi residenti, entrambi obbligatori.

**1. Il gate di approvazione.** Il globale chiede piano e approvazione prima di ogni operazione su file; `feedback_full_autonomy` autorizza tutto; `feedback_batch_delegation_mode` impone di procedere senza conferme; R22 introduce classi A e B; `feedback_scope_discipline_no_cascade` — marcata CARDINALE — rimette lo stop obbligatorio alla scoperta. La riga di override aggiunta stamattina crea un quinto enunciato invece di cancellarne quattro. *Si attiva: ogni volta che tocchi un file.*

**2. `git push`: quattro autorità su un'operazione irreversibile.** Il progetto dice di non pushare mai senza richiesta esplicita; la sezione autonomia dice che l'autorizzazione è per sessione; la skill di handoff pusha direttamente su main per design; R23 vieta di delegare all'utente ciò che il modello può fare. *Si attiva: a ogni chiusura di sessione.*

**3. Errore fuori scope: correggerlo o fermarsi.** R3 dice di correggere ogni errore senza eccezioni ("non esiste pre-esistente"); R17 estende la responsabilità a tutto; `feedback_scope_discipline_no_cascade` impone di segnalare e fermarsi. Sono incompatibili e si attivano **più volte per sessione**.

**4. Turno 1: presentare il menu o decidere.** Il progetto impone di costruire e presentare il menu azioni prima di qualsiasi lavoro; `feedback_claude_decides_technical` dice che le decisioni tecniche le prende il modello senza sottoporle; le preferences Cowork impongono un ACK strutturato di 7 punti prima di ogni tool call.

**5. Con quale strumento si scrive un file.** Quattro prescrizioni incompatibili sull'operazione più frequente in assoluto: R18 preferisce il plugin nativo, R23(b) impone Desktop Commander, R21 arbitra bash contro PowerShell, e in Claude Code CLI gli strumenti nativi Write/Edit sono quelli giusti.

**6. Sette documenti sovraordinati, zero regole di arbitrato.** BEHAVIOR_RULES dichiara di prevalere su CLAUDE.md per la metodologia; il globale dichiara la propria DECISION AUTHORITY principio sopraordinato; il progetto dichiara invarianti non negoziabili; le preferences dichiarano che la SoT sono i CLAUDE.md ma avvertono che la copia iniettata potrebbe essere vecchia. Nessuno dice chi vince.

**7. Collisione di numerazione.** 22 numeri condivisi fra R1-R23 e R001-R032, con 5 inversioni semantiche. `R20` è feasibility oppure database-source-of-truth. `R23` è autonomia oppure single-responsibility. Quando scrivi "R23" in chat, il modello indovina.

Il dettaglio completo dei 24 conflitti, con lato A, lato B, costo cognitivo e risoluzione proposta, è in `CONFLITTI.md`.

---

## Cosa NON si tocca

Questa sezione esiste perché il piano non sia una potatura cieca. Il difensore dei gotcha ha ribaltato **6 verdetti di taglio** portando prove di incidenti reali documentati.

**Restano, invariati:**

- **I quirk PowerShell veri**: `$ErrorActionPreference = "Stop"` che tratta come errore terminante qualunque riga su stderr da eseguibili nativi (nato da un `pg_dump` fallito due volte), e i comandi inline con virgolette annidate che muoiono in silenzio in meno di 2 secondi. Non sono conoscenza generale del modello: sono comportamento ambientale specifico.
- **Il pattern MSYS**: `MSYS_NO_PATHCONV=1` obbligatorio da Git Bash verso host remoti, e nvm da sourciare nel comando remoto. Verificato sul campo, non derivabile.
- **Le regole di sicurezza**: secret hygiene, i divieti git distruttivi, il divieto di toccare `.env` / `.secrets/` / `*.pem`. L'articolo dice esplicitamente di mantenere i vincoli nelle aree di importanza critica, e una regola di sicurezza spostata in una skill potrebbe non essere caricata proprio quando serve.
- **I gotcha di codebase**: il tunnel SSH necessario ai test, l'isolamento transazionale con `now()` congelato per file, Playwright 1.61 che muore su Node ≥23, gli UUID deterministici che devono essere RFC-4122 perché zod4 rifiuta quelli da `md5()`, il gap cosmetico nella numerazione delle migration.
- **Le tue opinioni di prodotto e di metodo**: la dottrina live-data, gli invarianti che *vietano* qualcosa (niente RLS, niente ENUM, niente Docker nel runtime), la Definition of Done. L'articolo dice che le opinioni particolari tue e del prodotto sono il contenuto ideale — vanno tenute, semmai spostate in una skill.
- **La tua autorità decisionale**: la chiusura di sessione resta tua. Nessuna voce del piano la tocca.

---

## Il piano in onde

82 voci, 9 onde, con gate fra una e l'altra. L'ordine non è per resa ma per rischio: prima si costruisce la possibilità di tornare indietro, poi si eliminano i conflitti, per ultimo si toccano le aree critiche.

| Onda | Voci | Token | Livelli | Perché è lì |
|---|---:|---:|---|---|
| **0 — Rete di sicurezza** | 5 | 0 | trasversale, macchina | Versionare `~/.claude`, catturare il baseline, eseguire le 3 sonde comportamentali *prima* |
| **A — Regola di precedenza** | 5 | ~130 | utente, progetto, cowork | Additiva: scrivere UNA regola di arbitrato, togliere le auto-proclamazioni di supremazia |
| **B — Conflitti decisionali** | 15 | ~3.100 | utente, progetto | Cancellare il lato perdente di ogni conflitto, **mai aggiungere override** |
| **C — Deduplicazione** | 20 | ~6.600 | tutti | Meccanica, nessuna decisione semantica residua |
| **D — Hook e boot** | 11 | ~3.300 | macchina, progetto | Payload propagato: intervento atomico su due file gemelli |
| **E — Listing skill e plugin** | 8 | ~23.600 | utente, progetto | La resa più alta per unità di rischio |
| **F — Cowork** | 6 | ~3.200 | cowork | Fuori repo, nessuna propagazione, ma va reincollato a mano |
| **G — Memoria di progetto** | 7 | ~19.800 | progetto | Per ultima: arbitra i conflitti risolti in A e B |
| **H — bsr-method** | 3 | ~16.055 | macchina, utente | Disarmare l'autorità dormiente e la collisione di namespace |
| **I — Verifica finale** | 2 | 0 | trasversale | I freni di sicurezza scattano ancora? Misura prima/dopo |

**I gate**: l'onda 0 va completata prima di qualunque modifica. L'onda A precede B e C, perché senza una regola di precedenza scritta ogni cancellazione successiva è arbitraria. L'onda G viene per ultima fra quelle di contenuto, perché le memorie sono la sede dove i conflitti di A e B sono stati storicamente arbitrati: toccarle prima significherebbe risolvere due volte. L'onda I chiude il ciclo.

Le tre voci a rischio ALTO — `WB-10` (spostare HRMS_MANAGER dove vive il modello di sicurezza), `WC-16` (comprimere gli invarianti derivabili tenendo quelli che vietano), `WD-08` (allineare i cloni con lo smoke test **riattivato**) — vanno eseguite singolarmente, con verifica dedicata.

L'elenco completo delle 82 voci, ciascuna con file bersaglio, azione concreta, asse dell'articolo che la motiva, risparmio stimato, rischio, reversibilità, dipendenza e criterio di verifica, è in `PIANO_todo.md`.

---

## Come si misura

Tre sonde comportamentali, da eseguire su 5 sessioni pulite **prima** e **dopo**. Devono poter fallire: se prima dell'intervento sono già a zero, il conflitto non esiste e la voce corrispondente va declassata.

1. **Approvazione non richiesta**: chiedere una modifica di una riga e contare quante volte compare una richiesta di permesso preventivo.
2. **Autorizzazione al push**: dire "chiudi sessione" e contare quante volte compare una domanda di autorizzazione.
3. **Errore fuori scope**: provocare un typecheck rosso su un modulo non toccato e registrare se il comportamento è correggere o fermarsi — e se è **deterministico** fra le 5 ripetizioni.

Più le misure oggettive: `wc -c` sui sei file di baseline, il conteggio caratteri dell'output dell'hook di boot, e `/context` in una sessione pulita.

La metrica che conta non è il risparmio. È la **determinatezza**: la stessa richiesta deve produrre lo stesso comportamento in cinque sessioni su cinque.

---

## Rischi e reversibilità

Il rischio dominante non è tagliare troppo. È che `~/.claude` non è versionato e che ogni modifica lì diventa una scrittura distruttiva differita su tre macchine: `handoff` → `close-propagate` → `align-claude-ecosystem` esegue `rm -rf`, e il flag `--skip-smoke` disattiva l'unico gate funzionale. L'unico ripristino disponibile oggi è un backup del 2026-05-26, **anteriore a R18 del 2026-07-09**: usarlo perderebbe due mesi di regole.

Per questo `W0-01` — `git init` su `~/.claude` con esclusione delle credenziali — è la prima voce del piano e la precondizione di tutte le altre.

Secondo rischio, segnalato dall'ingegnere della regressione: spostare una regola di sicurezza in una skill significa che potrebbe non essere caricata quando serve. L'articolo stesso avverte di non farlo nelle aree critiche, e il piano lo rispetta: nessuna regola di sicurezza viene spostata in lazy loading.

Terzo: le sessioni parallele. Al momento dell'analisi `.claude/settings.local.json` aveva 5 inserzioni non committate e il marker di allineamento era presente — cioè almeno una sessione parallela aveva una finestra di delta aperta. `W0-04` impone di non iniziare finché la finestra non è chiusa.

---

## File prodotti

| File | Contenuto |
|---|---|
| questo file | sintesi + Appendice A con le 82 voci operative |
| Appendice A (sotto) | le 82 voci in dettaglio, per onda |

Nessuna modifica è stata applicata. Il piano è per sessioni future abilitate alla scrittura; le voci che toccano file versionati del repo sono marcate come tali nella todo list.


---

# Appendice A — Le 82 voci operative

Ogni voce e' eseguibile da sola da una sessione futura. `repo` nella colonna Sede indica
un file versionato di heuresys-advanced (richiede sessione abilitata alla scrittura);
`fuori` indica un file dell'ecosistema Claude esterno al repo.


## Indice per onda

| Onda | Voci | Token | Titolo |
|---|---:|---:|---|
| W0 | 5 | 0 | Onda 0 — Rete di sicurezza |
| WA | 5 | 66 | Onda A — Regola di precedenza |
| WB | 15 | 3140 | Onda B — Conflitti decisionali |
| WC | 20 | 6577 | Onda C — Deduplicazione meccanica |
| WD | 11 | 3327 | Onda D — Hook e boot |
| WE | 8 | 23577 | Onda E — Listing skill e plugin |
| WF | 6 | 3180 | Onda F — Cowork |
| WG | 7 | 21818 | Onda G — Memoria di progetto |
| WH | 3 | 16055 | Onda H — bsr-method e contaminazione |
| WI | 2 | 0 | Onda I — Verifica finale |


## Onda W0 — Onda 0 — Rete di sicurezza

| ID | Titolo | Sede | Rischio | Tok |
|---|---|---|---|---:|
| `W0-01` | Versionare ~/.claude prima di toccare qualsiasi cosa | fuori | BASSO | 0 |
| `W0-02` | Catturare il baseline misurato (byte + output hook + /context) | fuori | NULLO | 0 |
| `W0-03` | Eseguire le 3 sonde comportamentali PRIMA (N=5 sessioni pulite) | fuori | NULLO | 0 |
| `W0-04` | Congelare la finestra di lavoro (nessuna sessione parallela in volo) | repo | NULLO | 0 |
| `W0-05` | Documentare il percorso di rollback remoto e il vincolo credenziali forward-only | fuori | NULLO | 0 |


### `W0-01` — Versionare ~/.claude prima di toccare qualsiasi cosa

- **File**: `C:\Users\enzospenuso\.claude\ (nuovo .git + nuovo .gitignore)`
- **Livello**: trasversale · **Rischio**: BASSO · **Risparmio stimato**: 0 token · **Dipende da**: —
- **Azione**: `git init` limitato al sottoinsieme portabile: CLAUDE.md, skills/, commands/, agents/, hooks/, output-styles/, settings.json, statusline-command.sh, scripts/. .gitignore su .credentials.json, history.jsonl, projects/, plugins/, cache/, todos/, shell-snapshots/, *.bak*. Primo commit 'baseline pre-armonizzazione 2026-07-26'.
- **Perche'** (asse articolo): Precondizione di reversibilità per TUTTE le onde successive. Verificato: `git -C ~/.claude rev-parse --is-inside-work-tree` -> 'fatal: not a git repository'. L'unico ripristino oggi è un .bak del 2026-05-26, anteriore a R18 (2026-07-09): ripristinarlo perderebbe due mesi di regole.
- **Reversibilita'**: N/A — è l'intervento che CREA la reversibilità. Nessun file esistente viene modificato.
- **Verifica**: `git -C "C:/Users/enzospenuso/.claude" log --oneline` restituisce 1 commit; `git -C ... ls-files | wc -l` > 20; `git -C ... check-ignore -v .credentials.json` conferma l'esclusione.

### `W0-02` — Catturare il baseline misurato (byte + output hook + /context)

- **File**: `scratchpad di sessione (fuori repo) — nessun file del progetto`
- **Livello**: trasversale · **Rischio**: NULLO · **Risparmio stimato**: 0 token · **Dipende da**: —
- **Azione**: Registrare: `wc -c` su CLAUDE.md globale (atteso 29.950), CLAUDE.md progetto (36.614), MEMORY.md (10.991), session-bootstrap.ps1 (6.178), session-bootstrap.sh (5.978), .handoff/STATE.md (4.529); `bash "$HOME/Claude Desktop/scripts/session-bootstrap.sh" /d/heuresys-advanced | wc -c`; e l'output di `/context` eseguito da Enzo in una sessione pulita.
- **Perche'** (asse articolo): Senza baseline il prima/dopo non è falsificabile e il risultato diventa autoreferenziale (il modello che dichiara di essere più leggero).
- **Reversibilita'**: N/A — sola lettura.
- **Verifica**: File di baseline presente nello scratchpad con i 6 valori byte, il conteggio caratteri dell'hook e lo screenshot/testo di /context, tutti datati.

### `W0-03` — Eseguire le 3 sonde comportamentali PRIMA (N=5 sessioni pulite)

- **File**: `scratchpad di sessione — nessun file modificato`
- **Livello**: trasversale · **Rischio**: NULLO · **Risparmio stimato**: 0 token · **Dipende da**: W0-02
- **Azione**: P1: chiedere una modifica di UNA riga e contare quante volte compare una richiesta di approvazione preventiva non richiesta. P2: dire 'chiudi sessione' e contare quante volte compare una domanda di autorizzazione al push. P3: provocare un typecheck rosso su un modulo NON toccato e registrare se il comportamento è correggere o segnalare-e-fermarsi. Cinque ripetizioni ciascuna, conteggio grezzo.
- **Perche'** (asse articolo): L'obiettivo dell'articolo non è il risparmio ma il costo cognitivo dell'arbitrato: queste tre sonde misurano esattamente i tre conflitti CRITICI più frequenti e DEVONO poter fallire.
- **Reversibilita'**: N/A — osservazione.
- **Verifica**: Tabella con 15 osservazioni (3 sonde × 5 sessioni) e i conteggi di partenza. Se P1 e P2 sono già a zero e P3 è deterministico, il conflitto non esiste e le voci Onda B relative vanno declassate.

### `W0-04` — Congelare la finestra di lavoro (nessuna sessione parallela in volo)

- **File**: `D:\heuresys-advanced\ (verifica), D:\heuresys-advanced\.session-align.marker (verifica)`
- **Livello**: trasversale · **Rischio**: NULLO · **Risparmio stimato**: 0 token · **Dipende da**: —
- **Azione**: Non iniziare nessuna onda finché `git status --porcelain` non è vuoto e `.session-align.marker` non è assente. Allo stato rilevato oggi: .claude/settings.local.json ha 5 inserzioni non committate e il marker è presente (2.039 byte) — cioè almeno una sessione parallela ha una finestra di delta aperta.
- **Perche'** (asse articolo): Verificato in sessione: la copia di CLAUDE.md globale iniettata nel contesto differisce da quella su disco. La baseline si muove mentre si lavora.
- **Reversibilita'**: N/A.
- **Verifica**: `git -C /d/heuresys-advanced status --porcelain` vuoto E `ls /d/heuresys-advanced/.session-align.marker` -> No such file.

### `W0-05` — Documentare il percorso di rollback remoto e il vincolo credenziali forward-only

- **File**: `C:\Users\enzospenuso\.claude\projects\D--heuresys-advanced\memory\reference_claude_ecosystem_alignment.md (append di 4 righe)`
- **Livello**: macchina · **Rischio**: NULLO · **Risparmio stimato**: 0 token · **Dipende da**: W0-01
- **Azione**: Aggiungere in testa al file: (a) ogni align crea `~/.claude.bak-<stamp>.tgz` sul remoto (align-claude-ecosystem.sh:250-253); (b) il ripristino si fa SOLO con `align-claude-ecosystem.sh <host> --rollback <stamp>`, MAI a mano con tar; (c) le credenziali sono forward-only (:356-357): sovrascrivere .credentials.json con una copia vecchia revoca l'autenticazione in modo permanente.
- **Perche'** (asse articolo): È l'unica operazione dell'intero piano il cui errore non è recuperabile, e la memoria che la contiene non è nemmeno indicizzata in MEMORY.md (vedi WG-06).
- **Reversibilita'**: Append a file non versionato, coperto dal git di W0-01.
- **Verifica**: Le tre righe sono in testa al file e il file compare in `git -C ~/.claude status` (se incluso) oppure è leggibile con le tre righe presenti.


## Onda WA — Onda A — Regola di precedenza

| ID | Titolo | Sede | Rischio | Tok |
|---|---|---|---|---:|
| `WA-01` | Scrivere UNA regola di precedenza fra gli strati | fuori | BASSO | -60 |
| `WA-02` | Rimuovere le auto-proclamazioni di supremazia dal CLAUDE.md globale | fuori | BASSO | 40 |
| `WA-03` | Togliere la clausola di override dagli invarianti di progetto | repo | BASSO | 20 |
| `WA-04` | Ridurre all'ambito reale la clausola di supremazia della skill di audit | fuori | BASSO | 0 |
| `WA-05` | Togliere Override priority e la domanda 'quale regola vale' dalle preferences | fuori | BASSO | 66 |


### `WA-01` — Scrivere UNA regola di precedenza fra gli strati

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md (nuova sezione in testa, dopo LINGUA)`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: -60 token · **Dipende da**: W0-01
- **Azione**: Aggiungere: «PRECEDENZA (unica sede). Ordine: richiesta esplicita di Enzo in chat > invarianti di sicurezza/dati del progetto > CLAUDE.md di progetto > CLAUDE.md globale > memorie > skill. In caso di conflitto: segnalalo in una riga e prosegui con la fonte più alta. Nessun altro documento dichiara la propria precedenza.»
- **Perche'** (asse articolo): A1/A3. I 24 conflitti censiti non sono 24 sviste indipendenti: sono la manifestazione dell'assenza di questo criterio. Senza di esso il modello risolve per salienza (quale testo è più vicino, più maiuscolo, più recente) e il comportamento non è riproducibile.
- **Reversibilita'**: Rimozione di una sezione additiva; nessun contenuto preesistente toccato.
- **Verifica**: Sonda: in una sessione pulita, porre una domanda che tocca due fonti in conflitto noto (es. push a fine sessione) e verificare che la risposta citi la precedenza invece di oscillare. Ripetere 3 volte con esito identico.

### `WA-02` — Rimuovere le auto-proclamazioni di supremazia dal CLAUDE.md globale

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md righe 22 e 78`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 40 token · **Dipende da**: WA-01
- **Azione**: Riga 22: «DECISION AUTHORITY (**principio sopraordinato — mai dimenticare**)» -> «DECISIONE DI CHIUSURA SESSIONE». Riga 78: «R23 ... (vincolante in TUTTI i contesti — Cowork, Claude Code CLI, claude.ai web)» -> togliere la clausola di vincolatività universale.
- **Perche'** (asse articolo): A4 + A1. Una gerarchia si scrive una volta (WA-01); ripeterla come rivendicazione dentro ogni documento è ciò che rende i conflitti irrisolvibili per costruzione.
- **Reversibilita'**: Edit testuale, revert per commit su ~/.claude.
- **Verifica**: `grep -ni "sopraordinato\|vincolante in TUTTI" ~/.claude/CLAUDE.md` -> 0 righe.

### `WA-03` — Togliere la clausola di override dagli invarianti di progetto

- **File**: `D:\heuresys-advanced\CLAUDE.md riga 165`
- **Livello**: progetto · **Rischio**: BASSO · **Risparmio stimato**: 20 token · **Dipende da**: WA-01
- **Azione**: «They are enforced architecturally and cannot be revisited without a new ADR / decision-log entry. **They override "common patterns" you may want to apply from other projects.**» -> mantenere la prima frase, cancellare la seconda.
- **Perche'** (asse articolo): A4. La forza degli invarianti sta nel contenuto (I5, I16-I20), non nella rivendicazione di supremazia; con WA-01 la loro posizione è già dichiarata.
- **Reversibilita'**: File versionato: `git revert` o `git checkout -- CLAUDE.md`.
- **Verifica**: `grep -n "override" /d/heuresys-advanced/CLAUDE.md` non restituisce più la riga 165. FILE VERSIONATO: richiede sessione abilitata alla scrittura.

### `WA-04` — Ridurre all'ambito reale la clausola di supremazia della skill di audit

- **File**: `C:\Users\enzospenuso\.claude\skills\web-qa-audit\modules\RULES.md riga 3`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 0 token · **Dipende da**: WA-01
- **Azione**: «These 21 rules override every other consideration» -> «Regole di metodo di questo audit. In caso di conflitto con il CLAUDE.md di progetto o con una richiesta esplicita dell'utente, prevalgono quelli: segnala il conflitto e prosegui.»
- **Perche'** (asse articolo): A1. Il file è caricato 'always first' e si dichiara sovraordinato al CLAUDE.md: è ciò che rende irrisolvibile il conflitto sull'ambiente di test (WB-09).
- **Reversibilita'**: Edit testuale, revert dal git di W0-01. Attenzione: la modifica si propaga a VM/linux-pc alla prima chiusura.
- **Verifica**: `grep -n "override every other" ~/.claude/skills/web-qa-audit/modules/RULES.md` -> 0 righe. Poi invocare la skill e verificare che le 21 regole siano ancora applicate (il contenuto non cambia).

### `WA-05` — Togliere Override priority e la domanda 'quale regola vale' dalle preferences

- **File**: `C:\Users\enzospenuso\Claude Desktop\preferences_backups\Cowork_user_preferences_v5.2_2026-06-17.md righe 13 e 33 (blocco Override priority) — POI incollato a mano da Enzo in claude.ai`
- **Livello**: cowork · **Rischio**: BASSO · **Risparmio stimato**: 66 token · **Dipende da**: WA-01
- **Azione**: Cancellare la riga 13 («su task ad alto rischio chiedi a Enzo quale regola valga») e ogni clausola di Override priority. Sostituire con il rimando alla precedenza unica di WA-01.
- **Perche'** (asse articolo): A1. La riga 13 trasforma la gerarchia irrisolta in una domanda a Enzo, cioè in attrito, ed è in contraddizione diretta con R23(a)/(d) replicata 70 righe più sotto NELLO STESSO FILE.
- **Reversibilita'**: Il file di backup locale è versionabile; la copia in claude.ai va reincollata da Enzo (claude.ai salva solo su evento nativo).
- **Verifica**: Il file locale non contiene più 'quale regola valga' né 'Override priority'. Enzo conferma l'incollaggio in claude.ai -> Settings -> Personal Preferences. Sonda Cowork: turno #1 non chiede quale regola applicare.


## Onda WB — Onda B — Conflitti decisionali

| ID | Titolo | Sede | Rischio | Tok |
|---|---|---|---|---:|
| `WB-01` | Cancellare i tre mapping strumento->compito dal CLAUDE.md globale | fuori | BASSO | 1000 |
| `WB-02` | Rimuovere il mapping strumenti dalle specifiche di autonomia di progetto | repo | BASSO | 80 |
| `WB-03` | Collassare in un solo enunciato il gate di approvazione (il conflitto più grave) | fuori | MEDIO | 180 |
| `WB-04` | Distinguere 'errore' da 'occasione' e 'agire' da 'allargare' | fuori | MEDIO | 120 |
| `WB-05` | Una sola regola sul git push (oggi sono quattro, su un'operazione irreversibile) | repo | MEDIO | 90 |
| `WB-06` | Trasformare il menu di apertura da tecnico a di prodotto | repo | MEDIO | 270 |
| `WB-07` | I 5 criteri di feasibility restano un dovere interno, non un messaggio a Enzo | fuori | MEDIO | 300 |
| `WB-08` | Chiarire quando un test verde basta e quando serve la prova live | repo | MEDIO | 60 |
| `WB-09` | Rimuovere la precondizione 'non-production' dalla skill di audit web | fuori | MEDIO | 38 |
| `WB-10` | Portare HRMS_MANAGER dove vive il modello di sicurezza | repo | ALTO | 428 |
| `WB-11` | Togliere il divieto di implementare le automazioni | fuori | BASSO | 85 |
| `WB-12` | Separare il formato dei documenti dal formato dei messaggi a Enzo | fuori | BASSO | 70 |
| `WB-13` | Qualificare il perimetro dei path assoluti | fuori | BASSO | 40 |
| `WB-14` | Cancellare R13 (protocollo Cowork/CLI ritirato ma attivabile) | fuori | BASSO | 189 |
| `WB-15` | Una sola verità su dove vive la memoria | fuori | BASSO | 190 |


### `WB-01` — Cancellare i tre mapping strumento->compito dal CLAUDE.md globale

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md righe 40 (R6, mappa tool), 52 (R12, albero subagent), 78 (R23 punto b, mapping 1-6)`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 1000 token · **Dipende da**: WA-01
- **Azione**: Sostituire tutte e tre con UN principio: «Usa lo strumento più diretto fra quelli effettivamente esposti in questa sessione; non delegarmi ciò che puoi eseguire tu.» Conservare SOLO la regola d'oro di R12 (~25 tok): il briefing al subagent contiene file:line, numeri e diff, mai 'based on the findings'.
- **Perche'** (asse articolo): A4 + A1. Tre mappe divergenti scritte in momenti diversi, riferite a runtime diversi. Verificato in questa sessione CLI: `mcp__windows-mcp__*` è esposto, Desktop Commander e Filesystem MCP NON esistono — quindi le prescrizioni sono sbagliate per due terzi, e lo strumento corretto (Edit/Write nativi) non è nominato da nessuna.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: `grep -ni "Desktop_Commander\|Desktop Commander\|Filesystem MCP" ~/.claude/CLAUDE.md` -> 0 righe. Sonda: chiedere una scrittura di file >900B in CLI e verificare che usi Write/Edit senza tentare ToolSearch su tool inesistenti.

### `WB-02` — Rimuovere il mapping strumenti dalle specifiche di autonomia di progetto

- **File**: `D:\heuresys-advanced\docs\kb\xtras\AUTONOMY_R23_PROJECT.md riga 9`
- **Livello**: progetto · **Rischio**: BASSO · **Risparmio stimato**: 80 token · **Dipende da**: WB-01
- **Azione**: Cancellare «edits codice/test/migration -> preferire Filesystem MCP o Desktop Commander edit_block (real disk) per file >900B, con Windows-MCP PowerShell come fallback». Conservare il solo gotcha misurato, spogliato dei nomi commerciali: «il mount sandbox tronca le scritture oltre ~900B e non rilascia .git/index.lock».
- **Perche'** (asse articolo): A4. Terza copia divergente dello stesso mapping, e per giunta quella che INVERTE le priorità rispetto a R23(b) globale.
- **Reversibilita'**: File versionato: revert per commit.
- **Verifica**: `grep -n "Desktop Commander\|Filesystem MCP" docs/kb/xtras/AUTONOMY_R23_PROJECT.md` -> 0. FILE VERSIONATO.

### `WB-03` — Collassare in un solo enunciato il gate di approvazione (il conflitto più grave)

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md righe 12, 13, 15, 16, 18`
- **Livello**: utente · **Rischio**: MEDIO · **Risparmio stimato**: 180 token · **Dipende da**: WA-01, W0-03
- **Azione**: Cancellare tutte e cinque le righe (piano-e-approvazione, override condizionale, chiedi-se-dubbi, mostra-diff, non-assumere-chiedi) e sostituirle con: «Esegui senza chiedere. Chiedi solo prima di: operazione distruttiva o irreversibile, push, o un'espansione di scope oltre quanto concordato. Quando non sai un fatto, verificalo con un tool; chiedi solo se la verifica è impossibile.»
- **Perche'** (asse articolo): A1 in forma pura. Oggi quattro prescrizioni incompatibili convivono (riga 13 obbliga ad attendere, riga 12 la annulla condizionalmente, R22 classifica A/B, R23(a) vieta di chiedere) più la memoria cardinale che impone lo STOP. La riga di override aggiunta di recente non ha risolto il conflitto: lo ha spostato su una fonte che contiene entrambe le direzioni.
- **Reversibilita'**: Revert dal git di W0-01. Nota: la soglia distruttivo/irreversibile è preservata, quindi nessun freno di sicurezza viene rimosso.
- **Verifica**: Sonda P1 ripetuta (N=5): il conteggio delle richieste di approvazione preventiva non richieste deve scendere a 0. Sonda inversa: chiedere `pnpm db:reset` e verificare che la conferma sia ancora richiesta.

### `WB-04` — Distinguere 'errore' da 'occasione' e 'agire' da 'allargare'

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md riga 34 (R3) + C:\Users\enzospenuso\.claude\projects\D--heuresys-advanced\memory\feedback_scope_discipline_no_cascade.md righe 17 e 24`
- **Livello**: utente · **Rischio**: MEDIO · **Risparmio stimato**: 120 token · **Dipende da**: WA-01, W0-03
- **Azione**: R3 diventa: «Ogni verifica rossa toccata dal tuo lavoro (typecheck, lint, test, CI) va riportata a verde, anche se il rosso è pre-esistente.» La memoria cardinale diventa: «Nessuna NUOVA costruzione fuori dal concordato: un'occasione notata (refactor, miglioria, debito) si registra nel backlog e si prosegue, non si esegue.» Cancellare da entrambe il verbo generico 'scoperta/problema' che oggi le fa collidere.
- **Perche'** (asse articolo): A1. È il conflitto a più alta frequenza: si attiva ogni volta che un comando stampa un errore non richiesto, cioè più volte per sessione, e qualunque comportamento viola una regola marcata OBBLIGATORIA o CARDINALE.
- **Reversibilita'**: Revert dal git di W0-01 (entrambi i file sono fuori dal repo).
- **Verifica**: Sonda P3 (N=5): provocare un typecheck rosso su un modulo non toccato; l'esito deve essere deterministico (correggere) in 5 casi su 5. Contro-sonda: notare un refactor possibile e verificare che venga registrato, non eseguito.

### `WB-05` — Una sola regola sul git push (oggi sono quattro, su un'operazione irreversibile)

- **File**: `D:\heuresys-advanced\CLAUDE.md righe 214 e 221 + docs\kb\xtras\AUTONOMY_R23_PROJECT.md riga 10 + C:\...\memory\feedback_full_autonomy.md riga 24`
- **Livello**: progetto · **Rischio**: MEDIO · **Risparmio stimato**: 90 token · **Dipende da**: WA-01, W0-03
- **Azione**: Cancellare la riga 214 («Never git push without an explicit ask» + il puntatore rotto a memory/). Tenere la 221 (autorizzazione session-scoped) e AGGIUNGERVI: «l'invocazione della skill handoff È l'autorizzazione al push di chiusura». Cancellare dalla memoria la citazione falsa «(CLAUDE.md regola 11 + 17)» — R11 vieta solo il --force, R17 non parla di push.
- **Perche'** (asse articolo): A1 + A4. Tre autorità sullo stesso atto irreversibile, e la skill handoff (SKILL.md:10, :78, :101) pusha su main 'by design': è la parte che vince di fatto, perché è quella che esegue.
- **Reversibilita'**: File versionato + memoria fuori repo: revert per commit su entrambi i git.
- **Verifica**: Sonda P2 (N=5): dire 'chiudi sessione' e contare le domande di autorizzazione al push; atteso 0. `grep -n "memory/feedback_full_autonomy" CLAUDE.md` -> 0 (puntatore rotto rimosso). FILE VERSIONATO.

### `WB-06` — Trasformare il menu di apertura da tecnico a di prodotto

- **File**: `D:\heuresys-advanced\CLAUDE.md righe 38-42`
- **Livello**: progetto · **Rischio**: MEDIO · **Risparmio stimato**: 270 token · **Dipende da**: WA-01
- **Azione**: Sostituire i passi 2-4 con: «Presenta 3-5 voci in linguaggio di prodotto (cosa cambia per la piattaforma). Ogni scelta tecnica dentro la voce la decidi tu e la dichiari in una riga. Se il primo messaggio di Enzo nomina già un obiettivo, salta il menu.» Promuovere la clausola UNLESS della riga 42 a default.
- **Perche'** (asse articolo): A2 + A1. Lo script build_menu.py stampa già le proprie intestazioni ('### P1 — ACTIVE', '### ⛔ GATED', '### ⏳ WAIT-INPUT'): l'interfaccia parla da sé. E la memoria converge §3 vieta di far scegliere fra opzioni tecniche «nemmeno con una raccomandazione in cima» — che è esattamente ciò che il menu attuale produce.
- **Reversibilita'**: File versionato: revert per commit.
- **Verifica**: In 3 sessioni pulite consecutive, il turno #1 presenta voci di prodotto e nessuna sigla tecnica (D-xx, Z-xxx, nomi di gate). FILE VERSIONATO.

### `WB-07` — I 5 criteri di feasibility restano un dovere interno, non un messaggio a Enzo

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md righe 22-26 (DECISION AUTHORITY) + 66-73 (R20)`
- **Livello**: utente · **Rischio**: MEDIO · **Risparmio stimato**: 300 token · **Dipende da**: WA-01
- **Azione**: Fondere in ~3 righe: «Non dichiarare nulla infattibile senza averlo misurato (volume via grep, budget, rischio). La misura resta nel tuo piano, non nel messaggio. A Enzo: 'faccio X, ci vuole parecchio, procedo' — oppure, se è davvero fuori portata, 'lo spezzo in due, comincio dalla prima'. La decisione di chiudere la sessione è di Enzo.» Cancellare l'obbligo della forma «~X token budget, regression risk Y/Z, vuoi procedere?» e la tabella di risk register.
- **Perche'** (asse articolo): A1. La forma oggi PRESCRITTA («SEMPRE») è letteralmente un conteggio più una domanda tecnica: i due tratti che la memoria converge §3 vieta parola per parola.
- **Reversibilita'**: Revert dal git di W0-01. Il presidio anti-«non è fattibile» resta, cambia solo il destinatario della misura.
- **Verifica**: Sonda: assegnare un task volutamente grande e verificare che la risposta non contenga stime in token né una tabella di rischio, ma proceda o proponga uno spezzettamento.

### `WB-08` — Chiarire quando un test verde basta e quando serve la prova live

- **File**: `D:\heuresys-advanced\docs\kb\xtras\AUTONOMY_R23_PROJECT.md riga 13 + D:\heuresys-advanced\CLAUDE.md righe 17-19 (DoD)`
- **Livello**: progetto · **Rischio**: MEDIO · **Risparmio stimato**: 60 token · **Dipende da**: WA-01
- **Azione**: Cancellare la riga 13 dell'xtras («vitest con mocked pool sono sufficienti ... live DB validation è non-blocking»). Nella DoD aggiungere la distinzione per classe di cambiamento: «fix interno senza superficie osservabile -> basta il verde; qualunque cosa tocchi un endpoint, uno schema, una pagina o un dato -> prova live con output allegato.»
- **Perche'** (asse articolo): A1. Due fonti di progetto, una puntata dall'altra, dicono l'opposto sulla chiusura di ogni fix. L'effetto collaterale è che 'done' ha significato variabile fra sessioni e lo stato del backlog non è confrontabile.
- **Reversibilita'**: File versionati: revert per commit.
- **Verifica**: `grep -n "sufficienti\|non-blocking" docs/kb/xtras/AUTONOMY_R23_PROJECT.md` -> 0. Poi: chiudere un fix interno (basta il verde) e uno su endpoint (deve produrre output live). FILE VERSIONATI.

### `WB-09` — Rimuovere la precondizione 'non-production' dalla skill di audit web

- **File**: `C:\Users\enzospenuso\.claude\skills\web-qa-audit\SKILL.md righe 42-43`
- **Livello**: utente · **Rischio**: MEDIO · **Risparmio stimato**: 38 token · **Dipende da**: WA-04
- **Azione**: «A reachable, non-production base URL (local/dev/staging). Never run mutating tests against production» -> «Le scritture seguono le regole di scrittura del progetto sotto test (reversibili, tracciate); i probe di sicurezza attivi restano soggetti a R18.»
- **Perche'** (asse articolo): A1. Su heuresys l'ambiente non-produzione NON ESISTE per invariante (I15/ADR-0026, che ritira esplicitamente 'mai produzione'), quindi la skill si rifiuta di partire o chiede a Enzo un ambiente inesistente. Il divieto che serve davvero (R18, perimetro dei probe attivi) è in area critica e resta intatto.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: Invocare la skill contro l'URL di produzione e verificare che parta; poi verificare che un probe di sicurezza attivo fuori perimetro sia ancora rifiutato da R18.

### `WB-10` — Portare HRMS_MANAGER dove vive il modello di sicurezza

- **File**: `D:\heuresys-advanced\CLAUDE.md riga 184 (I20) + C:\...\memory\feedback_hrms_manager_plenipotentiary.md (cancellazione)`
- **Livello**: progetto · **Rischio**: ALTO · **Risparmio stimato**: 428 token · **Dipende da**: WA-01
- **Azione**: Riformulare I20 in un solo enunciato: «HRMS_MANAGER ha mandato tenant-wide sui dati business, risolto DENTRO il resolver come mandato esplicito, non come scavalcamento degli assi.» Cancellare la memoria, che oggi dice 'bypassa ADR-0027' e tiene una deroga a un invariante in un file opzionale.
- **Perche'** (asse articolo): Area critica esplicitamente esente dal rilassamento. Le due letture producono implementazioni divergenti nei casi non previsti (HRMS_MANAGER di altro tenant, dato COMPENSATION fuori catena): un arbitrato sbagliato qui espone dati retributivi.
- **Reversibilita'**: File versionato + memoria: revert per commit. MA il rischio è semantico, non di file: va verificato che il comportamento RBAC non cambi.
- **Verifica**: Eseguire i 5 file `apps/api/test/scope-*.integration.test.ts` e verificare che restino verdi. Poi login come HRMS_MANAGER reale e verificare l'accesso invariato. FILE VERSIONATO.

### `WB-11` — Togliere il divieto di implementare le automazioni

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md riga 58 (R15)`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 85 token · **Dipende da**: WB-03
- **Azione**: Ridurre a mezza riga: «Quando un pattern si ripete, catturalo in uno script o una skill e dillo in una riga.» Cancellare «Segnalo la proposta, non la implemento in autonomia».
- **Perche'** (asse articolo): A1. Il divieto era tarato su un'epoca senza autonomia; oggi confligge con R22 (CLASSE A), R23(a) e due memorie, e produce l'esito peggiore: una proposta tecnica scritta a Enzo al posto di venti righe di script.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: `grep -n "non la implemento" ~/.claude/CLAUDE.md` -> 0. Sonda: far ripetere un pattern 3 volte e verificare che venga prodotto lo script invece di una proposta.

### `WB-12` — Separare il formato dei documenti dal formato dei messaggi a Enzo

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md righe 19 e 20`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 70 token · **Dipende da**: WA-01
- **Azione**: Riga 19: togliere le soglie aritmetiche («≥3 entità × ≥3 attributi», «max 2 livelli») e riferire la regola ai DOCUMENTI prodotti. Aggiungere una riga sui messaggi: «A Enzo: poche righe in italiano semplice — cosa è cambiato per il prodotto e cosa aspetta un suo input. Tabelle, conteggi e diagnosi vanno nei file.» Cancellare la riga 20 (fenced code block obbligatorio).
- **Perche'** (asse articolo): A1. Le soglie numeriche sono il caso esatto che l'articolo sostituisce con il giudizio; e la regola di formato oggi insegna COME impaginare un confronto tecnico che la memoria converge §3 dice di non mandare affatto.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: Sonda: chiudere un task e verificare che il messaggio finale sia ≤5 righe in italiano piano, senza tabelle di gate né conteggi.

### `WB-13` — Qualificare il perimetro dei path assoluti

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md riga 38 (R5) + memory\feedback_no_absolute_paths.md`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 40 token · **Dipende da**: WA-01
- **Azione**: Scrivere una volta sola: «Path assoluti nell'evidenza mostrata in chat; path relativi o parametrizzati in tutto ciò che finisce in un file versionato o in uno script destinato a girare altrove.»
- **Perche'** (asse articolo): A4. Oggi R5 impone il path assoluto nell'evidenza e la memoria lo vieta in assoluto: un arbitrato ricorrente su una distinzione che nessuno ha mai scritto, con due esiti entrambi dannosi (evidenze irrisolvibili o script che falliscono sul primo host remoto).
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: Sonda: produrre un'evidenza (path assoluto atteso) e uno script (path relativo/parametrizzato atteso) nello stesso turno.

### `WB-14` — Cancellare R13 (protocollo Cowork/CLI ritirato ma attivabile)

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md riga 54`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 189 token · **Dipende da**: WA-01
- **Azione**: Cancellare l'intera R13. Se serve un residuo, una riga nel CLAUDE.md di progetto: «cowork_code_exchange/ e cowork_reserved/ sono archivio read-only, non flussi vivi.»
- **Perche'** (asse articolo): A3. La condizione di attivazione è VERA sul progetto principale (la directory esiste con ~100-197 file), ma il primo file è `_00_ARCHIVE_READONLY_NOTICE.md` che la dichiara congelata dal 2026-05-27. La regola impone di attendere un file EXEC che nessuno produrrà più.
- **Reversibilita'**: Revert dal git di W0-01; la memoria storica resta in project_cli_sot_takeover.
- **Verifica**: `grep -n "cowork_code_exchange" ~/.claude/CLAUDE.md` -> 0 righe.

### `WB-15` — Una sola verità su dove vive la memoria

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md riga 36 (R4) e righe 121-127 (GERARCHIA)`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 190 token · **Dipende da**: WA-01
- **Azione**: Cancellare R4 (punta a `.auto-memory/feedback_self_improvement_system.md`, directory verificata INESISTENTE) e la riga 127 («il mio sistema memoria vive in memory/ dentro repo»). Sostituire con: «La memoria di progetto è l'auto-memory nativa; non creare directory di memoria dentro i repo.»
- **Perche'** (asse articolo): A5. Il file dichiara tre indirizzi per la memoria, due inesistenti. In lettura i puntatori rotti producono la decisione a naso che dovevano impedire; in scrittura la riga 127 farebbe nascere una seconda sede versionata accanto a quella nativa.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: `grep -n ".auto-memory\|memory/ dentro repo" ~/.claude/CLAUDE.md` -> 0 righe.


## Onda WC — Onda C — Deduplicazione meccanica

| ID | Titolo | Sede | Rischio | Tok |
|---|---|---|---|---:|
| `WC-01` | R23 ridotta a due righe di principio | fuori | BASSO | 850 |
| `WC-02` | Cancellare la copia di R23 dalle preferences Cowork | fuori | BASSO | 578 |
| `WC-03` | Togliere la copia di progetto dei quirk PowerShell | repo | BASSO | 50 |
| `WC-04` | Cancellare la clausola FALSA su cmd.exe e qualificare il quirk vero | fuori | BASSO | 90 |
| `WC-05` | Comprimere R21 senza trascinare la premessa falsa | fuori | BASSO | 380 |
| `WC-06` | Correggere la shell dichiarata e l'IP del Mac | fuori | BASSO | 80 |
| `WC-07` | Una sola sezione 'SSH da Git Bash verso host remoti' | fuori | BASSO | 170 |
| `WC-08` | Comprimere il blocco Mac e spostare il dettaglio in memoria | fuori | BASSO | 290 |
| `WC-09` | R18: principio in una riga, referto in memoria | fuori | BASSO | 580 |
| `WC-10` | R11 git safety ridotta a una riga (è nel system prompt del prodotto) | fuori | MEDIO | 120 |
| `WC-11` | Cancellare le regole di metodo che ripetono il comportamento di default | fuori | BASSO | 520 |
| `WC-12` | Cancellare dal CLAUDE.md di progetto ciò che il repo mostra da solo | repo | BASSO | 1100 |
| `WC-13` | Cancellare il divieto su Drizzle: la libreria non esiste nel repo | repo | BASSO | 100 |
| `WC-14` | Cancellare il 200-non-204 e il blocco §Tests (già nel codice, e in parte stale) | repo | BASSO | 164 |
| `WC-15` | Ridurre a puntatori l'isolamento transazionale e il tunnel | repo | MEDIO | 320 |
| `WC-16` | Comprimere gli invarianti derivabili, tenere quelli che vietano | repo | ALTO | 330 |
| `WC-17` | Cancellare le istruzioni morte e i conteggi in drift | repo | BASSO | 260 |
| `WC-18` | Una sola sede per ADR-0026 e per la dottrina live-data | repo | MEDIO | 550 |
| `WC-19` | Rendere esplicito il gate distruttivo nei permessi PRIMA di alleggerire la prosa | fuori | MEDIO | 0 |
| `WC-20` | Cancellare i divieti già garantiti da macchine (permessi e .gitignore) | repo | MEDIO | 45 |


### `WC-01` — R23 ridotta a due righe di principio

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md riga 78`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 850 token · **Dipende da**: WB-01
- **Azione**: Sostituire i 926 token con: «Non chiedermi di eseguire ciò che puoi eseguire tu; carica gli strumenti che ti servono quando ti servono; mostra l'output reale, non il suggerimento di verificarlo. Eccezioni: azione vietata dalla policy, distruttivo irreversibile su scope macchina, impossibilità tecnica accertata.»
- **Perche'** (asse articolo): A4 + A3. È il 12% dell'intero strato globale per un principio esprimibile in due righe; il mapping (già rimosso da WB-01) invecchiava a ogni cambio di runtime.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: `wc -c ~/.claude/CLAUDE.md` scende di ~3.400 byte rispetto al baseline W0-02. Sonda: chiedere un'operazione eseguibile e verificare che venga eseguita con evidenza, non suggerita.

### `WC-02` — Cancellare la copia di R23 dalle preferences Cowork

- **File**: `C:\Users\enzospenuso\Claude Desktop\preferences_backups\Cowork_user_preferences_v5.2_2026-06-17.md righe 65-90 — POI reincollato da Enzo`
- **Livello**: cowork · **Rischio**: BASSO · **Risparmio stimato**: 578 token · **Dipende da**: WC-01, WA-05
- **Azione**: Cancellare l'intera replica di R23 (~785 tok) e sostituirla con: «R23 vale come scritta nel CLAUDE.md globale.» Tenere in Cowork solo ciò che è specifico di quel runtime.
- **Perche'** (asse articolo): A4. Duplicazione verificata E divergente: il mapping (b)(1) globale elenca Filesystem MCP, la copia Cowork dice che NON è disponibile, l'xtras di progetto inverte le priorità. Tre copie mantenute a mano hanno smesso di concordare dopo tre settimane.
- **Reversibilita'**: File di backup versionabile; la copia claude.ai va reincollata da Enzo.
- **Verifica**: Il file locale non contiene più le sotto-clausole (b)1-6. Enzo conferma il reincollaggio. In una sessione Cowork, il comportamento di autonomia resta invariato.

### `WC-03` — Togliere la copia di progetto dei quirk PowerShell

- **File**: `D:\heuresys-advanced\CLAUDE.md riga 216`
- **Livello**: progetto · **Rischio**: BASSO · **Risparmio stimato**: 50 token · **Dipende da**: WC-04
- **Azione**: Cancellare «The repo runs on Windows. PowerShell 5.1 quirks apply (absolute exe paths, no -ArgumentList @() with string arrays, cmd.exe not on PATH)». La sede unica è R7 globale (già corretta da WC-04).
- **Perche'** (asse articolo): A4. Due copie in due file entrambi sempre caricati, con la copia di progetto che replica anche la clausola FALSA su cmd.exe.
- **Reversibilita'**: File versionato: revert per commit.
- **Verifica**: `grep -n "cmd.exe" /d/heuresys-advanced/CLAUDE.md` -> 0 righe. FILE VERSIONATO.

### `WC-04` — Cancellare la clausola FALSA su cmd.exe e qualificare il quirk vero

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md riga 42 (R7)`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 90 token · **Dipende da**: WA-01
- **Azione**: Cancellare «cmd.exe non è nel PATH di Enzo (profilo modificato)» ovunque compaia (R7, R21, CONTESTO WINDOWS). Riscrivere il quirk riprodotto CON i due qualificatori oggi mancanti: «Su **Windows PowerShell 5.1**, con `$ErrorActionPreference='Stop'` e **stderr rediretto nella pipeline** (`2>&1`), una riga informativa su stderr di un eseguibile nativo diventa errore terminante anche con exit code 0. Rimedio: `$ErrorActionPreference='Continue'` + controllo di `$LASTEXITCODE`, mai try/catch. Su PowerShell 7 non accade.»
- **Perche'** (asse articolo): P2 + R9 dello stesso file («i pattern stale sono peggio del non-so»). Misurato su tre shell con profilo attivo: `cmd.exe` risolve in Git Bash (/c/WINDOWS/system32/cmd.exe), in PS 7.6.4 e in PS 5.1.29617.1000. L'asserzione è falsa ed è propagata in 4 sedi sempre caricate.
- **Reversibilita'**: Revert dal git di W0-01. Il gotcha riprodotto NON viene perso, viene reso applicabile.
- **Verifica**: `grep -rn "cmd.exe non" ~/.claude/CLAUDE.md /d/heuresys-advanced/CLAUDE.md` -> 0 righe. Contro-prova del quirk conservato: su PS 5.1, `$ErrorActionPreference='Stop'; & cmd /c 'echo info 1>&2 & exit 0' 2>&1` solleva ancora eccezione (il fatto è vero, la regola ora lo dice bene).

### `WC-05` — Comprimere R21 senza trascinare la premessa falsa

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md riga 75 (R21)`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 380 token · **Dipende da**: WC-04
- **Azione**: Ridurre da 470 a ~90 token: «Default Bash (git, SSH, POSIX, build). Passa a PowerShell per le superfici Windows-native: ACL/NTFS, Registry, WMI/CIM/servizi/scheduled task/event log, volumi e adapter di rete, encoding UTF-16/BOM, long-path >260. Motivo: quelle superfici non hanno equivalente POSIX.» NON riportare la parentesi su cmd.exe.
- **Perche'** (asse articolo): A1 + P2. La tassonomia in otto categorie è over-constraint; il gotcha resta. La motivazione va corretta: il problema non è un interprete mancante, è l'assenza di equivalenti POSIX.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: Il testo compresso non contiene 'cmd.exe'. Sonda: chiedere una lettura di Registry e verificare che venga usato PowerShell.

### `WC-06` — Correggere la shell dichiarata e l'IP del Mac

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md righe 2, 8, 84, 93`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 80 token · **Dipende da**: WA-01
- **Azione**: Riga 84: «Shell primaria: PowerShell 5.1» -> «PowerShell 7.x disponibile e usata dal tool PowerShell (misurato 7.6.4); PS 5.1 presente per script legacy». Righe 2 e 93: un solo enunciato per il Mac, allineato a `~/.ssh/config` -> **192.168.1.7**. Cancellare la riga 8 («CLI installata e allineata su Windows + Mac + VM»), contraddetta dalla riga 90 (SIGILL sul Mac).
- **Perche'** (asse articolo): P2 + A1. Un dato di rete sbagliato in un blocco intitolato 'riferimenti rapidi' produce un tentativo SSH verso l'host errato, che non fallisce in modo parlante: si appende. E la riga 84 fa calibrare le regole su una shell che il tool non usa.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: `grep -n "192.168.1.4" ~/.claude/CLAUDE.md` -> 0 righe; `grep -n "192.168.1.7"` -> 1 riga. `ssh -G mac-local | grep hostname` conferma .7.

### `WC-07` — Una sola sezione 'SSH da Git Bash verso host remoti'

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md righe 98, 112, 118 -> nuova sezione unica`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 170 token · **Dipende da**: WC-06
- **Azione**: Estrarre il gotcha ripetuto tre volte in una sezione autonoma: «Da Git Bash verso Mac/VM/linux-pc: prefissa sempre `MSYS_NO_PATHCONV=1` (altrimenti MSYS converte i path POSIX dentro la stringa remota e il comando non esegue, senza errore) e nel comando remoto sourcea nvm (`export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`), perché la shell non interattiva non legge il profilo.»
- **Perche'** (asse articolo): A4 + P2. Il gotcha è REALE e riprodotto in sessione (senza il flag, anche lo switch `/c` viene convertito e cmd parte interattivo senza errore) ma è sepolto nel blocco della macchina ritirata e ripetuto per ogni host.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: Il file contiene UNA occorrenza di MSYS_NO_PATHCONV. Contro-prova: `MSYS_NO_PATHCONV=1 ssh oracle-vm-default 'echo ok'` funziona e il gotcha è ancora documentato.

### `WC-08` — Comprimere il blocco Mac e spostare il dettaglio in memoria

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md righe 89-101`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 290 token · **Dipende da**: WC-07
- **Azione**: Ridurre a una riga: «Mac 2012 (`mac-local`, 192.168.1.7): RITIRATO dai processi automatici — la CLI ci va in SIGILL. On-demand via SSH, dettagli in memoria.» Spostare hardware, macOS, Homebrew, SSHFS, Docker, performance in una memoria di riferimento.
- **Perche'** (asse articolo): A3. Dodici righe (308 tok) su una macchina dichiarata ritirata, pagate in OGNI sessione di OGNI progetto.
- **Reversibilita'**: Revert dal git di W0-01; il contenuto è spostato, non cancellato.
- **Verifica**: La memoria di destinazione contiene i dettagli; il CLAUDE.md ha 1 riga. `wc -c ~/.claude/CLAUDE.md` scende di ~1.200 byte.

### `WC-09` — R18: principio in una riga, referto in memoria

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md riga 64`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 580 token · **Dipende da**: WB-01
- **Azione**: Ridurre a: «Se uno strumento è disponibile sia come plugin/runtime nativo sia come MCP extension, preferisci il nativo.» Spostare in memoria la narrativa del bug Desktop Commander v0.2.43 / McpUiPreviews.
- **Perche'** (asse articolo): A3. 600 token residenti per un referto storico su un'estensione che questo runtime non carica affatto.
- **Reversibilita'**: Revert + il contenuto è spostato.
- **Verifica**: `grep -c "McpUiPreviews" ~/.claude/CLAUDE.md` -> 0; la memoria di destinazione lo contiene.

### `WC-10` — R11 git safety ridotta a una riga (è nel system prompt del prodotto)

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md riga 50`
- **Livello**: utente · **Rischio**: MEDIO · **Risparmio stimato**: 120 token · **Dipende da**: WB-05
- **Azione**: Sostituire le sette clausole con: «Operazioni git distruttive: proponi sempre l'alternativa reversibile prima. Push su main: vedi la regola sul push.»
- **Perche'** (asse articolo): A4 al livello più caro (137 tok in OGNI sessione di OGNI progetto). Verificato: 7 clausole su 7 sono coperte dalla descrizione del tool Bash, 4 quasi verbatim («consider whether there is a safer alternative», «Prefer to create a new commit rather than amending», «Never skip hooks (--no-verify)... investigate and fix»). L'articolo (P1) dice di non toccare il system prompt: a maggior ragione di non riscriverlo.
- **Reversibilita'**: Revert dal git di W0-01. Rischio residuo: il system prompt non è sotto controllo di Enzo e può cambiare — per questo si tiene la riga che nomina la CLASSE, non le istanze.
- **Verifica**: Sonda di sicurezza: chiedere `git reset --hard` e verificare che venga proposta l'alternativa; chiedere `--no-verify` e verificare il rifiuto.

### `WC-11` — Cancellare le regole di metodo che ripetono il comportamento di default

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md righe 30 (R1), 44 (R8), 52 (R12 residuo), 56 (R14), 121-127 (GERARCHIA), 133-135 (blocco graphify)`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 520 token · **Dipende da**: WA-01
- **Azione**: Cancellare R1 (piano in 2 frasi, max 3 step), R8 (token hygiene — sovrapposta al system prompt), R14 (anti-bias con soglia dei 30 minuti che il modello non misura), il blocco GERARCHIA (autodescrizione del meccanismo di caricamento) e il blocco graphify (trigger già nella description della skill). Salvare da R1 il solo frammento operativo (bulk copy Windows -> robocopy/xcopy) dentro R21.
- **Perche'** (asse articolo): A1 + A4. Prescrivono comportamenti già presenti o riscrivono la documentazione del prodotto; il blocco graphify, se tenuto, andrebbe replicato per ogni skill moltiplicando un costo fisso.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: `grep -n "graphify" ~/.claude/CLAUDE.md` -> 0; invocare `/graphify` e verificare che parta comunque (il trigger è nel frontmatter della skill).

### `WC-12` — Cancellare dal CLAUDE.md di progetto ciò che il repo mostra da solo

- **File**: `D:\heuresys-advanced\CLAUDE.md righe 50-60 e 62-70 (tabella comandi), 100-114 (albero directory), 130 (split server/app), 132-139 (catena 13 plugin), 143 (LOG_REDACT_PATHS), 195 (elenco 11 ruoli), 206 (artefatti generati), 116 (workspace layout)`
- **Livello**: progetto · **Rischio**: BASSO · **Risparmio stimato**: 1100 token · **Dipende da**: WA-03
- **Azione**: Cancellare tutte queste voci. La tabella comandi è package.json (verificati uno a uno tutti gli script); l'albero è un `ls`; la catena dei plugin è la copia dei commenti numerati `// 1.` .. `// 13.` di apps/api/src/app.ts, che porta il razionale d'ordine in linea; LOG_REDACT_PATHS è una costante esportata (app.ts:167, usata a :195); i ruoli sono ROLE_CODES tipizzato in @heuresys/shared. Tenere SOLO le righe non derivabili già marcate (E2E/Node 22, db:migrate idempotente, db:reset distruttivo).
- **Perche'** (asse articolo): P2 esplicito: «evitare di dire l'ovvio che Claude vedrebbe guardando filesystem e repo».
- **Reversibilita'**: File versionato: revert per commit.
- **Verifica**: `pnpm typecheck && pnpm lint` restano verdi (nessun effetto sul codice); il file scende di ~4.400 byte. Sonda: chiedere di aggiungere un modulo e verificare che la catena plugin venga rispettata leggendo app.ts. FILE VERSIONATO.

### `WC-13` — Cancellare il divieto su Drizzle: la libreria non esiste nel repo

- **File**: `D:\heuresys-advanced\CLAUDE.md riga 150 (passo 2 del module pattern)`
- **Livello**: progetto · **Rischio**: BASSO · **Risparmio stimato**: 100 token · **Dipende da**: WA-03
- **Azione**: Cancellare «raw parameterized SQL ... No Drizzle query builder for selects/inserts (Drizzle is used only via the pg pool wrapper)». Sostituire con mezza riga: «I repository usano SQL parametrizzato ($1,$2), mai interpolazione di stringhe.»
- **Perche'** (asse articolo): A1. Verificato in questa sessione: `grep -rl drizzle --include=package.json .` (esclusi node_modules) -> ZERO; 0 in pnpm-lock.yaml; 0 in apps/api/src/. La premessa del divieto («il modello troverebbe Drizzle nel package.json») è falsa. E il pattern ha 90 esemplari unanimi (90 moduli, 90 repository.ts, 0 import di drizzle-orm): si impara per imitazione.
- **Reversibilita'**: File versionato: revert per commit.
- **Verifica**: `grep -rn drizzle --include=package.json . | grep -v node_modules` -> vuoto (conferma la premessa); `grep -n Drizzle CLAUDE.md` -> 0. FILE VERSIONATO.

### `WC-14` — Cancellare il 200-non-204 e il blocco §Tests (già nel codice, e in parte stale)

- **File**: `D:\heuresys-advanced\CLAUDE.md righe 194 e 159`
- **Livello**: progetto · **Rischio**: BASSO · **Risparmio stimato**: 164 token · **Dipende da**: WA-03
- **Azione**: Cancellare entrambe. Il 200-non-204 è già scritto in apps/api/src/modules/auth/routes.ts righe 9-11 (con in più quali endpoint restano 204) ed è protetto da 5 assert (`auth.integration.test.ts` righe 144, 170, 197, 385 + `auth-mfa:88`). Il §Tests è già in apps/api/vitest.config.ts righe 18-25, che oltretutto rivela che la prosa è STALE: dopo Vitest 4 non esiste più `singleThread` (oggi `fileParallelism:false` + `maxWorkers:1`) e lo split unit esiste (`vitest.unit.config.ts`, ed è il primo comando di `pnpm test`).
- **Perche'** (asse articolo): A4 + A6. L'istruzione sta già nello strumento e la spec è già eseguibile; la terza copia in un file sempre caricato non aggiunge protezione e ha già iniziato a mentire.
- **Reversibilita'**: File versionato: revert per commit.
- **Verifica**: Modificare il login a 204 in un branch usa-e-getta e verificare che i test falliscano (il gate reale è lì). `ls apps/api/vitest.unit.config.ts` conferma lo split. FILE VERSIONATO.

### `WC-15` — Ridurre a puntatori l'isolamento transazionale e il tunnel

- **File**: `D:\heuresys-advanced\CLAUDE.md riga 161 (D-52) e righe 76-91 (§Required infrastructure)`
- **Livello**: progetto · **Rischio**: MEDIO · **Risparmio stimato**: 320 token · **Dipende da**: WA-03
- **Azione**: D-52 -> «I test girano in isolamento transazionale per file: leggi `apps/api/test/helpers/tx-isolation.ts` (header) prima di scrivere test che dipendono dal tempo.» Tunnel -> «Il DB è remoto dietro il tunnel :5433; il boot hook lo riapre e ti dice se è giù.» Cancellare il blocco comandi manuali.
- **Perche'** (asse articolo): A3 + A4. tx-isolation.ts righe 1-25 dice le stesse cose PIÙ il rimedio che il CLAUDE.md omette (ordinare per chiave secondaria quando servono istanti distinti), ed è nella catena di ingresso (vitest.config.ts:26 setupFiles). Il tunnel è verificato e riportato da scripts/session-boot.ps1 righe 30-39 a ogni avvio.
- **Reversibilita'**: File versionato: revert per commit. Rischio: il puntatore vale solo se il file viene aperto — per questo si nomina il file, non si elimina l'informazione.
- **Verifica**: Sonda: chiedere di scrivere un test che confronta due created_at e verificare che il modello apra tx-isolation.ts o applichi la chiave secondaria. FILE VERSIONATO.

### `WC-16` — Comprimere gli invarianti derivabili, tenere quelli che vietano

- **File**: `D:\heuresys-advanced\CLAUDE.md righe 168 (I3/I4), 173 (RD-08), 180-184 (I16-I20)`
- **Livello**: progetto · **Rischio**: ALTO · **Risparmio stimato**: 330 token · **Dipende da**: WB-10
- **Azione**: I3/I4 e RD-08: comprimere e spostare RD-08 nella sezione «Database migrations» come una riga («categorici = varchar(N)+CHECK, mai ENUM; i valori sono discriminatori TS-side»). I16-I20: comprimere a ~70 token (i due assi + prevalenza organizzativa) e aggiungere il puntatore: «si decide SOLO in apps/api/src/lib/scope/resolver.ts — non re-derivare scope nei service». TENERE invariati I1, I5, I7, I9, I13.
- **Perche'** (asse articolo): Test dell'asimmetria: una regola che PRESCRIVE lascia N esemplari ed è derivabile (206 tabelle sys.sys_*, 339 CHECK, 0 CREATE TYPE); una regola che VIETA lascia il vuoto e non è derivabile (0 occorrenze di RLS non provano il divieto di I5). I16-I20 è area critica, quindi si comprime in loco e non si sposta.
- **Reversibilita'**: File versionato: revert per commit.
- **Verifica**: I 5 file `apps/api/test/scope-*.integration.test.ts` restano verdi. Sonda: chiedere di progettare l'isolamento multi-tenant di una nuova tabella e verificare che NON venga proposto RLS (I5 conservato) e che venga usato varchar+CHECK. FILE VERSIONATO.

### `WC-17` — Cancellare le istruzioni morte e i conteggi in drift

- **File**: `D:\heuresys-advanced\CLAUDE.md righe 215 (HANDOFF.md), 112 (8 documenti di priming), 186 (stop and ask), 213 (formato commit MVP-1 5.1.X), 9 (~75 moduli), 177 (13 pagine ESS), 37 (156/206/65 KB), 13 e 178 (161 vs 162 utenti), 96 e 214 (puntatori memory/)`
- **Livello**: progetto · **Rischio**: BASSO · **Risparmio stimato**: 260 token · **Dipende da**: WA-03
- **Azione**: Cancellare: riga 215 (HANDOFF.md non esiste più nella root ed è vietato ricrearlo dalla riga 23); riga 112 (contraddice la riga 37); riga 186 (default, e generatore di conflitto); riga 213 (nessuno degli ultimi 15 commit usa quel formato). Rimuovere TUTTE le cifre: '~75 business modules' (misurati 90), '13 pages /me/*' (misurate 29), '156KB + 206KB + 65KB' (reali 93.805 + 200.965 + 256.287 = ~538 KB), '161'/'162 users'. Correggere o rimuovere i due puntatori a `memory/` (directory verificata inesistente nel repo).
- **Perche'** (asse articolo): A1 + P2. Un'istruzione che, se seguita, viola due altre istruzioni dello stesso file è il caso peggiore; e ogni cifra scritta in un file sempre caricato drifta — quattro drift già misurati.
- **Reversibilita'**: File versionato: revert per commit.
- **Verifica**: `grep -nE "HANDOFF.md|~75|13 pages|156KB|memory/feedback" CLAUDE.md` -> 0 righe. `ls apps/api/src/modules | wc -l` -> 90 (conferma il drift). FILE VERSIONATO.

### `WC-18` — Una sola sede per ADR-0026 e per la dottrina live-data

- **File**: `D:\heuresys-advanced\CLAUDE.md righe 13, 19, 178, 226-233`
- **Livello**: progetto · **Rischio**: MEDIO · **Risparmio stimato**: 550 token · **Dipende da**: WB-08
- **Azione**: ADR-0026 (due tenant di produzione, dati trattati come reali): tenere SOLO l'invariante I15 (riga 178), senza numeri; cancellare le occorrenze in OUTPUT RULE (13) e Definition of Done (19), che vi rimandano. Live-data: fondere la DoD (17-19) e la sezione MVP-2a/2b (226-233), oggi in riferimento circolare esplicito; rinominare la sezione togliendo l'etichetta MVP morta e la giustificazione storica.
- **Perche'** (asse articolo): A4. Quattro sedi per la stessa dottrina, con conteggi in conflitto FRA LORO nello stesso file (161 vs 162 utenti); e due sedi per il divieto dei mock che si citano a vicenda.
- **Reversibilita'**: File versionato: revert per commit.
- **Verifica**: `grep -c "ADR-0026" CLAUDE.md` -> 1. Sonda: chiedere di scrivere una pagina e verificare che il divieto di mock sia ancora applicato. FILE VERSIONATO.

### `WC-19` — Rendere esplicito il gate distruttivo nei permessi PRIMA di alleggerire la prosa

- **File**: `C:\Users\enzospenuso\.claude\settings.json (blocco permissions.deny)`
- **Livello**: macchina · **Rischio**: MEDIO · **Risparmio stimato**: 0 token · **Dipende da**: W0-01
- **Azione**: Aggiungere voci deny esplicite: `Bash(rm -rf:*)`, `Bash(git push --force:*)`, `Bash(pnpm db:reset:*)`, `Bash(git reset --hard:*)` (o ask, secondo preferenza). Oggi permissions ha 0 deny / 0 ask / 0 allow nel globale e 30 allow locali tutti diagnostici: il freno esiste solo per ASSENZA di allowlist, cioè per accidente.
- **Perche'** (asse articolo): A2. Il vincolo passa dalla prosa alla macchina, in modo progettato invece che accidentale. È la precondizione che rende sicuro WC-20.
- **Reversibilita'**: Edit JSON, revert dal git di W0-01. Attenzione: settings.json si propaga a VM/linux-pc via transform_settings.
- **Verifica**: Provare `pnpm db:reset` e verificare che il permesso venga chiesto/negato dal sistema, non dalla prosa. Poi verificare che la propagazione non abbia rotto nulla (`align-claude-ecosystem.sh vm --dry-run`).

### `WC-20` — Cancellare i divieti già garantiti da macchine (permessi e .gitignore)

- **File**: `C:\Users\enzospenuso\.claude\CLAUDE.md riga 14 + D:\heuresys-advanced\CLAUDE.md righe 65 (ask before db:reset), 204 e 206 (What NOT to touch)`
- **Livello**: trasversale · **Rischio**: MEDIO · **Risparmio stimato**: 45 token · **Dipende da**: WC-19
- **Azione**: Cancellare «Non cancellare mai file senza conferma», «ask user before running» su db:reset e l'elenco dei file generati/segreti. TENERE il FATTO che nessuna macchina comunica: «le migrazioni sono idempotenti, doppia esecuzione provata» e «db:reset è distruttivo».
- **Perche'** (asse articolo): A2 + A4. Il gate è il sistema di permessi (dopo WC-19 anche esplicito) e il .gitignore righe 40-49, che elenca già .env, .env.*, *.pem, *.key, .secrets/. La prosa ripete l'elenco nel file che NON è canonico per quell'elenco.
- **Reversibilita'**: File versionato + globale: revert per commit su entrambi i git.
- **Verifica**: Dopo il taglio, provare una cancellazione di file e verificare che il permesso venga comunque chiesto. FILE VERSIONATO (parte progetto).


## Onda WD — Onda D — Hook e boot

| ID | Titolo | Sede | Rischio | Tok |
|---|---|---|---|---:|
| `WD-01` | Togliere la ristampa del CLAUDE.md dall'hook — in ENTRAMBI i bootstrap | fuori | BASSO | 2012 |
| `WD-02` | Togliere l'indice regole lossy da entrambi i bootstrap | fuori | BASSO | 535 |
| `WD-03` | Rimuovere la direttiva di ACK — è VIVA su VM e linux-pc | fuori | BASSO | 60 |
| `WD-04` | Ridurre gli ANCILLARY e rimuovere il codice morto .auto-memory | fuori | BASSO | 75 |
| `WD-05` | Archiviare START_HERE.md (entry-point stale che viola la regola SoT) | repo | BASSO | 0 |
| `WD-06` | Una sola resa dello stato git al boot (oggi tre) | fuori | BASSO | 45 |
| `WD-07` | Sostituire Test-NetConnection con un connect TCP diretto | repo | MEDIO | 0 |
| `WD-08` | Allineare i cloni con lo smoke test RIATTIVATO | fuori | ALTO | 0 |
| `WD-09` | Comprimere la sezione Session start del CLAUDE.md di progetto | repo | BASSO | 600 |
| `WD-10` | Spostare l'hook di progetto nelle impostazioni di progetto | repo | MEDIO | 0 |
| `WD-11` | Coprire con un test lo script di allineamento dell'ecosistema | repo | BASSO | 0 |


### `WD-01` — Togliere la ristampa del CLAUDE.md dall'hook — in ENTRAMBI i bootstrap

- **File**: `C:\Users\enzospenuso\Claude Desktop\scripts\session-bootstrap.ps1 righe 52-57 E C:\Users\enzospenuso\Claude Desktop\scripts\session-bootstrap.sh righe 36-38`
- **Livello**: macchina · **Rischio**: BASSO · **Risparmio stimato**: 2012 token · **Dipende da**: W0-01, W0-02
- **Azione**: Cancellare da entrambi il blocco che fa `head -n 50` del CLAUDE.md globale e lo emette nel contesto (8.048 char, ~2.012 tok). Il file è già interamente residente (misurato 29.950 byte).
- **Perche'** (asse articolo): A4 in forma estrema: duplicazione verbatim di testo già in contesto, che vale il 46% del payload di boot e il 93% dell'output di quell'hook.
- **Reversibilita'**: Revert dal git di W0-01. ATTENZIONE: la modifica si propaga con rm -rf su VM e linux-pc alla prima chiusura.
- **Verifica**: `bash "$HOME/Claude Desktop/scripts/session-bootstrap.sh" /d/heuresys-advanced | wc -c` scende di ~8.000 rispetto al baseline W0-02, su Windows E (dopo l'align di WD-08) su VM.

### `WD-02` — Togliere l'indice regole lossy da entrambi i bootstrap

- **File**: `session-bootstrap.ps1 righe 59-72 E session-bootstrap.sh riga 46 (le due regex)`
- **Livello**: macchina · **Rischio**: BASSO · **Risparmio stimato**: 535 token · **Dipende da**: WD-01
- **Azione**: Cancellare il blocco 'rules index'. Verificato: le due regex catturano 13 regole su 22 e omettono R1, R7, R13, R15, R17, R20, R21, R22, R23 — cioè le più recenti e più pesanti — chiudendo l'elenco su «18. PLUGIN OVER MCP-EXTENSION».
- **Perche'** (asse articolo): A4 + A1. Duplicato di testo residente E lossy: un indice che manca il 41% delle voci suggerisce che le regole finiscano a 18, e alimenta il dubbio permanente creato dalla soglia Cowork «N<23».
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: L'output dell'hook non contiene più «18. PLUGIN OVER MCP-EXTENSION» né alcun elenco di regole.

### `WD-03` — Rimuovere la direttiva di ACK — è VIVA su VM e linux-pc

- **File**: `C:\Users\enzospenuso\Claude Desktop\scripts\session-bootstrap.sh riga 161 (e la riga corrispondente in .ps1)`
- **Livello**: macchina · **Rischio**: BASSO · **Risparmio stimato**: 60 token · **Dipende da**: WD-02
- **Azione**: Cancellare «CLAUDE: in turn #1 you MUST explicitly ACK reading the rules above ... Do NOT call any tool before this ACK.»
- **Perche'** (asse articolo): A1. Su Windows la riga è codice morto (settings.json:17 passa -NoInfra e lo script fa return a riga 142), MA i cloni non usano quel flag: align-claude-ecosystem.sh:194-196 scrive l'hook remoto come `bash .../session-bootstrap.sh` senza -NoInfra, e session-bootstrap.sh:16 imposta NO_INFRA=0. Su VM e linux-pc l'ACK cerimoniale è emesso a OGNI sessione.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: `MSYS_NO_PATHCONV=1 ssh oracle-vm-default 'bash ~/.claude/scripts/session-bootstrap.sh /home/ubuntu/heuresys-advanced | tail -5'` non contiene più 'MUST explicitly ACK' (dopo WD-08).

### `WD-04` — Ridurre gli ANCILLARY e rimuovere il codice morto .auto-memory

- **File**: `session-bootstrap.ps1 righe 81-96 e 104-112 (+ gemello .sh righe 57-63)`
- **Livello**: macchina · **Rischio**: BASSO · **Risparmio stimato**: 75 token · **Dipende da**: WD-03
- **Azione**: Ridurre l'elenco ancillare al solo `.handoff/STATE.md` (l'unico che il CLAUDE.md dichiara vivo). Cancellare il blocco `.auto-memory/` (directory verificata inesistente: oggi emette 0 char ma resta un rischio latente di iniettare 10 nomi file).
- **Perche'** (asse articolo): P2 (l'elenco è un `ls`) + A1: l'hook promuove al turno 1 START_HERE.md (11.621 byte, ultimo commit 2026-05-16) che descrive il progetto come 'MVP-0 ready to start, repo 2 commit' contro 1.317 commit e baseline v1.0.0 GA.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: L'output dell'hook cita solo .handoff/STATE.md; `grep -c auto-memory` sugli hook -> 0.

### `WD-05` — Archiviare START_HERE.md (entry-point stale che viola la regola SoT)

- **File**: `D:\heuresys-advanced\START_HERE.md -> docs\archive\START_HERE_2026-05-16.md`
- **Livello**: progetto · **Rischio**: BASSO · **Risparmio stimato**: 0 token · **Dipende da**: WD-04
- **Azione**: `git mv START_HERE.md docs/archive/START_HERE_2026-05-16.md` con nota in testa: «Stato al 2026-05-16, superato — lo stato vivo è .handoff/STATE.md + docs/kb/SOT_STATE.md.»
- **Perche'** (asse articolo): P2. La sua sola esistenza viola la riga 23 del CLAUDE.md («never spawn other state/handoff/entry-point files») e la sua promozione al turno 1 importa una fotografia falsa dello stato.
- **Reversibilita'**: File versionato: `git mv` inverso.
- **Verifica**: `ls START_HERE.md` -> No such file; `ls docs/archive/START_HERE_2026-05-16.md` -> presente. FILE VERSIONATO.

### `WD-06` — Una sola resa dello stato git al boot (oggi tre)

- **File**: `session-bootstrap.ps1 righe 114-138 (+ gemello .sh) — tenere la sezione GIT & SYNC del dashboard`
- **Livello**: macchina · **Rischio**: BASSO · **Risparmio stimato**: 45 token · **Dipende da**: WD-04
- **Azione**: Cancellare il blocco git dall'hook globale e dall'hook di progetto (session-boot.ps1 righe 131-133). Branch, HEAD, dirty e ahead/behind restano nella sola sezione GIT & SYNC di status_dashboard, l'unica che aggiunge il confronto con origin.
- **Perche'** (asse articolo): A4. Tre asserzioni sullo stesso fatto con tre formati diversi, e tre invocazioni git separate su un repo da 1.317 commit.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: L'output di boot contiene UNA sola riga di stato git. `git status` resta accessibile su richiesta.

### `WD-07` — Sostituire Test-NetConnection con un connect TCP diretto

- **File**: `D:\heuresys-advanced\scripts\session-boot.ps1 righe 30-39 (function Test-Tunnel e il loop di recovery)`
- **Livello**: macchina · **Rischio**: MEDIO · **Risparmio stimato**: 0 token · **Dipende da**: WD-06
- **Azione**: Rimpiazzare `Test-NetConnection` con un `System.Net.Sockets.TcpClient` con timeout ~500 ms; ridurre il budget di retry dentro l'hook a ~3 secondi; lasciare il recovery lungo al task schedulato che lo script già indica come owner.
- **Perche'** (asse articolo): A3 (il boot non deve bloccare). Misurato: Test-NetConnection = 1,99 s per invocazione (baseline powershell.exe 0,40 s, quindi ~1,6 s netti), pagati ANCHE nel percorso felice; il loop a 12 iterazioni spiega il massimo di 60.409 ms e i 4 timeout su 76 esecuzioni.
- **Reversibilita'**: File versionato: revert per commit. Rischio: se il connect fallisce dove il cmdlet riusciva, il tunnel non viene riaperto — mitigato dal task schedulato.
- **Verifica**: Cronometrare 10 boot con tunnel su e 3 con tunnel giù: mediana attesa < 3 s (baseline 7.721 ms) e il tunnel deve comunque risultare up dopo il recovery. FILE VERSIONATO.

### `WD-08` — Allineare i cloni con lo smoke test RIATTIVATO

- **File**: `esecuzione: `bash scripts/align-claude-ecosystem.sh all` (SENZA --skip-smoke)`
- **Livello**: macchina · **Rischio**: ALTO · **Risparmio stimato**: 0 token · **Dipende da**: WD-01, WD-02, WD-03, WD-04, WD-06, WD-07
- **Azione**: Dopo WD-01..WD-07, eseguire l'align a mano SENZA `--skip-smoke`, così il gate funzionale (smoke_test avvia `claude -p` sul remoto) e l'auto-rollback (rollback_host) tornano attivi. Annotare lo stamp del backup remoto per un eventuale `--rollback <stamp>`.
- **Perche'** (asse articolo): Vincolo operativo di primo ordine: il percorso automatico (handoff -> close-propagate:107) passa `--skip-smoke` e `verify_host || warn`, quindi propaga con rm -rf senza alcun gate bloccante. Questa è l'unica occasione in cui il gate esiste.
- **Reversibilita'**: `bash scripts/align-claude-ecosystem.sh <host> --rollback <stamp>`. ATTENZIONE: le credenziali sono forward-only — non ripristinare mai .credentials.json a mano.
- **Verifica**: L'align termina con esito CLEAN sui report in `deploy/reports/claude-align/`; poi `MSYS_NO_PATHCONV=1 ssh oracle-vm-default 'claude -p "di solo OK"'` risponde; l'output dell'hook remoto è dimagrito come su Windows.

### `WD-09` — Comprimere la sezione Session start del CLAUDE.md di progetto

- **File**: `D:\heuresys-advanced\CLAUDE.md righe 33-44`
- **Livello**: progetto · **Rischio**: BASSO · **Risparmio stimato**: 600 token · **Dipende da**: WB-06
- **Azione**: Ridurre da 3.496 a ~1.200 caratteri: tenere (a) il comando canonico `python docs/kb/tools/session_start.py`, (b) il divieto di leggere raw le tre SoT — SENZA le cifre (reali ~538 KB, non 427), (c) la regola di presentazione già riformulata da WB-06, (d) l'istruzione di aggiungere al menu debiti e roadmap che il register non copre. Cancellare la descrizione a parole di build_menu, i flag (sono nell'--help) e la genealogia storica («born S1007», «forensics 2026-07-07»).
- **Perche'** (asse articolo): A2 + A3. Lo script stampa da sé le intestazioni delle corsie; descriverlo in prosa è costo puro e diverge quando lo script cambia.
- **Reversibilita'**: File versionato: revert per commit.
- **Verifica**: `python docs/kb/tools/session_start.py` continua a produrre menu + salute in un round; il turno #1 resta a un solo round. FILE VERSIONATO.

### `WD-10` — Spostare l'hook di progetto nelle impostazioni di progetto

- **File**: `C:\Users\enzospenuso\.claude\settings.json righe 10-25 -> D:\heuresys-advanced\.claude\settings.json`
- **Livello**: macchina · **Rischio**: MEDIO · **Risparmio stimato**: 0 token · **Dipende da**: WD-08
- **Azione**: Spostare la registrazione di `scripts/session-boot.ps1` (oggi nel settings GLOBALE con path di progetto hardcoded) nelle impostazioni del repo, e rimuovere il guard interno (session-boot.ps1 righe 22-26) che esiste solo per compensare la collocazione sbagliata.
- **Perche'** (asse articolo): A3. Oggi ogni sessione di ogni altro progetto paga uno spawn PowerShell (0,40 s misurati) solo per fare exit 0.
- **Reversibilita'**: Revert su entrambi i git. Rischio: se la registrazione di progetto non viene letta, il boot perde tunnel/marker/lint — da verificare prima di rimuovere il guard.
- **Verifica**: Aprire una sessione in un ALTRO progetto e verificare che nessun hook di heuresys parta; aprire una sessione in heuresys e verificare che tunnel, marker, journal e verdetto lint compaiano ancora.

### `WD-11` — Coprire con un test lo script di allineamento dell'ecosistema

- **File**: `D:\heuresys-advanced\scripts\test\run-shell-tests.sh (nuova sezione) — copre scripts\align-claude-ecosystem.sh`
- **Livello**: macchina · **Rischio**: BASSO · **Risparmio stimato**: 0 token · **Dipende da**: WD-08
- **Azione**: Aggiungere una sezione di test che eserciti almeno: preflight su file mancante (attende `die`), MANAGED_REMOTE_PATHS invariato, e un `--dry-run` che non scriva sul remoto. Verificato: oggi run-shell-tests copre align-clones (sez. D) e close-propagate (sez. F) ma NON align-claude-ecosystem, e nessun CI asserisce sul contenuto di CLAUDE.md o delle skill.
- **Perche'** (asse articolo): A6 (la test suite come spec) applicato allo strumento che esegue la propagazione distruttiva.
- **Reversibilita'**: File versionato: revert per commit.
- **Verifica**: `bash scripts/test/run-shell-tests.sh` verde con la nuova sezione; togliere temporaneamente session-bootstrap.sh fa fallire il test del preflight. FILE VERSIONATO.


## Onda WE — Onda E — Listing skill e plugin

| ID | Titolo | Sede | Rischio | Tok |
|---|---|---|---|---:|
| `WE-01` | Potare il marketplace human-resources-plus (l'intervento a maggior resa dello strato) | fuori | BASSO | 4137 |
| `WE-02` | NON tentare di disattivare i bundle @inline (già fatto e inefficace) | fuori | NULLO | 0 |
| `WE-03` | Accorciare le due description obese e togliere le esclusioni morte | repo | BASSO | 600 |
| `WE-04` | Cancellare i due file morti in skills/ e salvarne il residuo utile | fuori | BASSO | 0 |
| `WE-05` | Sfoltire il corpo di web-qa-audit (indice script e ricettario duplicato) | fuori | BASSO | 1074 |
| `WE-06` | Sfoltire la skill handoff (fix del linter e changelog) | fuori | MEDIO | 445 |
| `WE-07` | Sostituire il divieto Windows-MCP con il fatto osservato | repo | BASSO | 106 |
| `WE-08` | Decidere lo split di graphify (vincolo upstream) e allineare il nome | fuori | MEDIO | 17215 |


### `WE-01` — Potare il marketplace human-resources-plus (l'intervento a maggior resa dello strato)

- **File**: `C:\Users\enzospenuso\.claude\plugins\installed_plugins.json (o skillOverrides in settings.json)`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 4137 token · **Dipende da**: W0-01
- **Azione**: Ridurre le 48 skill del plugin all'orchestratore `/hr` più 5-8 sotto-skill effettivamente usate; disattivare le altre (non cancellarle). Misurato: 16.546 char di sole description, più del triplo di tutte le skill locali attive messe insieme.
- **Perche'** (asse articolo): A3. Prova diretta della saturazione: ~25 voci del plugin compaiono nel listing col SOLO nome, benché i loro SKILL.md abbiano description da 215 a 425 char — il troncamento è già in corso, silenzioso, e rende quelle skill non instradabili.
- **Reversibilita'**: Riattivazione via skillOverrides/installed_plugins; nessuna cancellazione su disco.
- **Verifica**: In una sessione pulita, il listing skill contiene ≤10 voci `human-resources-plus:` e nessuna voce priva di description. `/hr` continua a instradare.

### `WE-02` — NON tentare di disattivare i bundle @inline (già fatto e inefficace)

- **File**: `C:\Users\enzospenuso\.claude\settings.json riga 103 e 95-102 — nessuna modifica`
- **Livello**: trasversale · **Rischio**: NULLO · **Risparmio stimato**: 0 token · **Dipende da**: —
- **Azione**: Rimuovere dal budget il risparmio di ~1.140 token attribuito ai gemelli anthropic-skills. Verificato: `anthropic-skills@inline: false` è GIÀ presente (settings.json:103) insieme a tutti gli altri bundle inline, e le voci compaiono lo stesso nel listing (sono servite lato server). NON cancellare i gemelli locali per compensare: sono la copia controllabile e aggiornata, e cancellarli è perdita netta senza recupero.
- **Perche'** (asse articolo): Onestà di misura: un risparmio messo a budget e non conseguibile spinge verso l'azione sbagliata.
- **Reversibilita'**: N/A — è una non-azione documentata.
- **Verifica**: `grep -n "inline" ~/.claude/settings.json` mostra i bundle già a false; il listing di sessione li contiene comunque. Registrare il fatto per non riproporlo.

### `WE-03` — Accorciare le due description obese e togliere le esclusioni morte

- **File**: `D:\heuresys-advanced\.claude\skills\zero-pending-loop\SKILL.md (frontmatter, 1.571 char) e C:\Users\enzospenuso\.claude\skills\web-qa-audit\SKILL.md (frontmatter, 1.361 char)`
- **Livello**: trasversale · **Rischio**: BASSO · **Risparmio stimato**: 600 token · **Dipende da**: WE-01
- **Azione**: zero-pending-loop: tenere 3-4 frasi canoniche di trigger, la nota che l'invocazione può arrivare dal driver, e SOLO le due esclusioni verso skill attive e confondibili (handoff, project-atlas). web-qa-audit: ~250 char (cosa fa + quando + invocabile da altre skill); l'elenco di coperture e i path di output restano nel corpo. In entrambe rimuovere le esclusioni verso skill disattivate (forensic-100x-kickoff, saas-investor-due-diligence, consolida-pagina, ralph-build-loop: 4 su 7 e 2 su 4 sono morte).
- **Perche'** (asse articolo): A2. Il listing serve al routing, non alla documentazione; e un'esclusione ha senso solo verso una skill presente nel listing. Termine di paragone: le 14 skill superpowers hanno description da 79 a 234 char (media ~140), le 6 locali attive media 940.
- **Reversibilita'**: zero-pending-loop è versionato (revert per commit); web-qa-audit è coperto dal git di W0-01.
- **Verifica**: Le due description scendono sotto i 400 char; entrambe le skill si attivano ancora con i loro trigger canonici. UNA È FILE VERSIONATO.

### `WE-04` — Cancellare i due file morti in skills/ e salvarne il residuo utile

- **File**: `C:\Users\enzospenuso\.claude\skills\powershell.md (439 byte) e python.md (372 byte)`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 0 token · **Dipende da**: WC-06
- **Azione**: Cancellare entrambi: non sono skill valide (nessuna cartella, nessun SKILL.md) e infatti non compaiono nel listing. Prima di cancellare, spostare l'unico dato utile — «virtual environment: ~/.venv su questo sistema» (verificato esistente) — nel CLAUDE.md come gotcha di macchina o in memoria. NOTA: powershell.md ha ragione contro il CLAUDE.md sulla versione (PS 7.6.4) — la correzione è già in WC-06.
- **Perche'** (asse articolo): P2 + P5. Contenuto generico («usa type hints», «preferisci pathlib», «segui PEP 8») che è esattamente l'ovvio da non scrivere, in file che nessuno carica.
- **Reversibilita'**: Revert dal git di W0-01 (dopo il primo commit i file sono recuperabili).
- **Verifica**: `ls ~/.claude/skills/*.md` -> vuoto; il dato su ~/.venv è presente nella nuova sede.

### `WE-05` — Sfoltire il corpo di web-qa-audit (indice script e ricettario duplicato)

- **File**: `C:\Users\enzospenuso\.claude\skills\web-qa-audit\SKILL.md righe 353-383 e 430-533`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 1074 token · **Dipende da**: WE-03
- **Azione**: Cancellare l'indice dei 25 script (verificato: 23 su 26 file in scripts/ hanno --help; i 3 senza sono helper non invocabili) sostituendolo con una riga: «gli script vivono in $WQA_SKILL_DIR/scripts/; ognuno si documenta con --help». Dei cinque blocchi di ricettario tenere solo 'Automated workflow' (porta l'ordine A→J) e la riga di guardia su --prune; rimuovere smoke/deferred/close. TENERE l'indice moduli con la colonna 'Load when' (righe 320-352): è il meccanismo di progressive disclosure della skill.
- **Perche'** (asse articolo): A4 + A2. Le istruzioni d'uso di uno strumento stanno nello strumento; ma la condizione di caricamento dei moduli NON è derivabile da un ls e va conservata.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: Eseguire un audit completo e verificare che tutti i passi 0-6 funzionino e che i moduli vengano caricati alle condizioni giuste.

### `WE-06` — Sfoltire la skill handoff (fix del linter e changelog)

- **File**: `C:\Users\enzospenuso\.claude\skills\handoff\SKILL.md righe 58-70, 99-104, 110`
- **Livello**: utente · **Rischio**: MEDIO · **Risparmio stimato**: 445 token · **Dipende da**: WE-05
- **Azione**: Cancellare l'elenco dei fix per gli 8 codici del linter (l'istruzione appartiene al messaggio d'errore di handoff_lint.py) e spostare il changelog di versione in un CHANGELOG.md accanto, come fa già claude-ecosystem-optimizer. Dei Constraints tenere SOLO «niente nuovi file di stato»; amend, --no-verify e no-PR sono già nel system prompt del prodotto e nella description della skill. TENERE «Never push on a red gate».
- **Perche'** (asse articolo): A4 + A5. L'istruzione d'uso di uno strumento va nello strumento; il changelog è memoria mantenuta a mano dove git la mantiene da solo.
- **Reversibilita'**: Revert dal git di W0-01. ATTENZIONE: è il percorso di chiusura — modificarla a inizio sessione, mai in chiusura.
- **Verifica**: Eseguire una chiusura a vuoto su repo pulito: il lint resta bloccante, le SoT vengono riscritte, non nasce alcun file di riepilogo.

### `WE-07` — Sostituire il divieto Windows-MCP con il fatto osservato

- **File**: `D:\heuresys-advanced\.claude\skills\project-atlas\SKILL.md riga 81 (+ righe 20-23 preambolo)`
- **Livello**: progetto · **Rischio**: BASSO · **Risparmio stimato**: 106 token · **Dipende da**: WB-01
- **Azione**: Riga 81: sostituire «File ops SEMPRE con i tool nativi: MAI Windows-MCP/chrome-tools in questo flusso» con il fallimento specifico osservato («in questo flusso le scritture via <tool> su <file> hanno prodotto <effetto>»); se il fallimento non è ricostruibile, rimuovere la riga. Righe 20-23: cancellare i rimandi a vincoli già residenti (R20, DoD, OUTPUT RULE, path assoluti), tenendo solo «single-writer register (handoff governa lo stato)».
- **Perche'** (asse articolo): A1 + A4. Il divieto collide con R23(b) globale; e ripetere in una skill vincoli già residenti aggiunge una seconda formulazione che diverge quando la prima cambia.
- **Reversibilita'**: File versionato: revert per commit.
- **Verifica**: Eseguire `project-atlas refresh` e verificare che produca gli stessi artefatti. FILE VERSIONATO.

### `WE-08` — Decidere lo split di graphify (vincolo upstream) e allineare il nome

- **File**: `C:\Users\enzospenuso\.claude\skills\graphify\SKILL.md (68.859 char, 1.434 righe, 46 blocchi di codice) + .graphify_version`
- **Livello**: utente · **Rischio**: MEDIO · **Risparmio stimato**: 17215 token · **Dipende da**: WC-11
- **Azione**: DECISIONE PRELIMINARE (non improvvisare): la skill è vendorizzata upstream (v0.8.14), quindi uno split locale verrebbe sovrascritto al prossimo aggiornamento. Due rami: (a) fork dichiarato con versione pinnata + split in references/ (step-extract, step-build, step-outputs, query, update, export), SKILL.md ridotto a router; (b) proporre lo split upstream e non toccare nulla ora. In entrambi i casi allineare `name: graphify-windows` alla cartella `graphify`.
- **Perche'** (asse articolo): A3. È il file singolo più grande dell'ecosistema: ~17.200 token alla prima invocazione, di cui la stragrande maggioranza è codice che serve a UN solo ramo.
- **Reversibilita'**: Revert dal git di W0-01; il ramo (b) è a rischio zero.
- **Verifica**: Se ramo (a): `/graphify` produce lo stesso grafo su un corpus di prova e `.graphify_version` è pinnato. Il nome nel listing coincide con quello del frontmatter.


## Onda WF — Onda F — Cowork

| ID | Titolo | Sede | Rischio | Tok |
|---|---|---|---|---:|
| `WF-01` | Riscrivere il file di backup delle preferences e farlo reincollare a Enzo | fuori | BASSO | 2250 |
| `WF-02` | Sostituire l'ordine di leggere le tre SoT al boot | fuori | BASSO | 130 |
| `WF-03` | Trasformare il preload obbligatorio di 16 tool in un criterio a giudizio | fuori | MEDIO | 500 |
| `WF-04` | Correggere i tre difetti fattuali delle preferences | fuori | BASSO | 200 |
| `WF-05` | Portare il paste quirk di claude.ai dove il quirk vive davvero | fuori | BASSO | 100 |
| `WF-06` | Eliminare le due copie .txt divergenti del blocco preload | fuori | NULLO | 0 |


### `WF-01` — Riscrivere il file di backup delle preferences e farlo reincollare a Enzo

- **File**: `C:\Users\enzospenuso\Claude Desktop\preferences_backups\Cowork_user_preferences_v5.2_2026-06-17.md -> nuova versione v6.0`
- **Livello**: cowork · **Rischio**: BASSO · **Risparmio stimato**: 2250 token · **Dipende da**: WA-05, WC-02
- **Azione**: Claude riscrive il FILE LOCALE (che è modificabile); Enzo poi lo incolla in claude.ai -> Settings -> Personal Preferences, perché claude.ai salva solo su evento nativo. Obiettivo: da 12.090 char (~3.022 tok) a ~2.800-3.200 char (~700-800 tok), conservando integralmente i tre gotcha di runtime.
- **Perche'** (asse articolo): P5. Il file è cresciuto del 180% in tre settimane per sola addizione: nessuna sezione della v4 è stata rimossa. Senza una potatura periodica lo strato sempre-caricato cresce a ogni incidente e non decresce mai.
- **Reversibilita'**: Il backup v5.2 resta su disco; Enzo può reincollare la versione precedente.
- **Verifica**: `wc -c` del nuovo file ≤ 3.200. Enzo conferma l'incollaggio. Sonda Cowork: il turno #1 non produce l'ACK a 7 punti e non chiede quale regola valga.

### `WF-02` — Sostituire l'ordine di leggere le tre SoT al boot

- **File**: `Cowork_user_preferences (righe 15-16 e voce 3 dell'ACK)`
- **Livello**: cowork · **Rischio**: BASSO · **Risparmio stimato**: 130 token · **Dipende da**: WF-01
- **Azione**: Cancellare «PRIMA di qualsiasi azione operativa, leggi nell'ordine SOT_STATE.md, SOT_BACKLOG.md, DEBT_REGISTER.md» e sostituire con: «Lo stato di questo progetto si legge via docs/kb/tools/session_start.py; i tre file SoT sono grandi e in gran parte archivio, si aprono solo in drill-down.»
- **Perche'** (asse articolo): A3. Contraddice letteralmente la riga 37 del CLAUDE.md di progetto e impone ~538 KB (misurati: 93.805 + 200.965 + 256.287) di lettura eager, che è la causa documentata del boot >20 minuti.
- **Reversibilita'**: Backup su disco.
- **Verifica**: Sonda Cowork: il turno #1 non apre i tre file. Enzo conferma l'incollaggio.

### `WF-03` — Trasformare il preload obbligatorio di 16 tool in un criterio a giudizio

- **File**: `Cowork_user_preferences righe 53-63 (MANDATORY TOOL PRELOAD) + riga 63 (ACK con il numero hardcoded)`
- **Livello**: cowork · **Rischio**: MEDIO · **Risparmio stimato**: 500 token · **Dipende da**: WF-01
- **Azione**: Cancellare l'obbligo incondizionato e la stringa `select:` di 601 caratteri. Sostituire con: «Quando il task tocca file, processi o git reali su Windows, carica gli strumenti nativi Windows disponibili in quella sessione — il mount sandbox tronca le scritture oltre ~900B, serve cache stale, non rilascia .git/index.lock e non mostra i symlink pnpm.» TENERE integralmente i quattro limiti misurati.
- **Perche'** (asse articolo): A3, inversione frontale: l'istruzione usa ToolSearch — il meccanismo citato dall'articolo per tenere i tool FUORI dal contesto — per forzarne 16 DENTRO al turno #1, prima di sapere quale sia il task.
- **Reversibilita'**: Backup su disco. Rischio: se il criterio non scatta, una scrittura grande viene troncata in silenzio — per questo il gotcha resta scritto per esteso.
- **Verifica**: Sonda Cowork: scrivere un file >900B e verificare che venga usato lo strumento giusto e che il file su disco abbia la dimensione attesa (`wc -c`).

### `WF-04` — Correggere i tre difetti fattuali delle preferences

- **File**: `Cowork_user_preferences righe 24 (soglia N<23), 45-51 (riferimenti rapidi, IP Mac), 58 e 79 (Desktop Commander)`
- **Livello**: cowork · **Rischio**: BASSO · **Risparmio stimato**: 200 token · **Dipende da**: WF-01
- **Azione**: Cancellare la soglia «segnalare se N < 23» (le regole sono 22: 1-18, 20-23, la 19 non esiste, quindi l'allarme è sempre vero). Correggere l'IP del Mac da 192.168.1.4 a 192.168.1.7 (la v4 dello stesso file lo annotava già: «era .4, DHCP riassegnato 2026-05» — la v5.2 ha regredito). Rimuovere i 13 riferimenti a Desktop Commander, che la regola 18 globale del 2026-07-09 prescrive di NON usare.
- **Perche'** (asse articolo): P2 + A1. Un'istruzione che dichiara inaffidabile il proprio system prompt e poi lo conferma con un check difettoso è il caso peggiore di over-constraining: non aggiunge una regola, aggiunge un dubbio permanente.
- **Reversibilita'**: Backup su disco.
- **Verifica**: Il file non contiene più 'N < 23', '192.168.1.4' né 'Desktop_Commander'. Sonda Cowork: il turno #1 non dichiara «snapshot probabilmente vecchia».

### `WF-05` — Portare il paste quirk di claude.ai dove il quirk vive davvero

- **File**: `Cowork_user_preferences (nuova riga) + C:\Users\enzospenuso\.claude\CLAUDE.md riga 60 (R16, rimozione)`
- **Livello**: cowork · **Rischio**: BASSO · **Risparmio stimato**: 100 token · **Dipende da**: WF-01
- **Azione**: Rimuovere R16 dal CLAUDE.md globale (in CLI è inerte: lì il client è il terminale) e scriverla compressa nelle preferences: «Il client claude.ai trasforma `nome.ext` in link markdown nel paste: nei comandi destinati al copy-paste usa variabili, Join-Path o apici singoli.» NON spostarla in auto-memory.
- **Perche'** (asse articolo): P2 + correzione al piano originale. Il quirk si attiva mentre il modello COMPONE l'output e fallisce nel terminale di Enzo, FUORI dal contesto: non esiste alcuna retroazione che lo faccia recuperare da una memoria o da una skill. Va residente, ma solo nello strato dove il quirk esiste.
- **Reversibilita'**: Backup su disco + git di W0-01.
- **Verifica**: `grep -c "CLIENT PASTE" ~/.claude/CLAUDE.md` -> 0; la riga è nelle preferences. Sonda Cowork: chiedere un comando shell da incollare e verificare che non contenga nomi file letterali con punto.

### `WF-06` — Eliminare le due copie .txt divergenti del blocco preload

- **File**: `C:\Users\enzospenuso\Claude Desktop\preferences_backups\MANDATORY_TOOL_PRELOAD_block_v5.1_filesystem-fix_2026-06-17.txt e MANDATORY_TOOL_PRELOAD_block_to_append.txt`
- **Livello**: cowork · **Rischio**: NULLO · **Risparmio stimato**: 0 token · **Dipende da**: WF-03
- **Azione**: Cancellare entrambi (o archiviarli in una sottocartella _archive). Drift misurato: la select: del .md ha 16 voci, quella del .txt v5.1 ne ha 15 (manca list_processes, che pure è nella prosa dello stesso file) e le righe di ACK dichiarano «16 tool caricati» e «15 tool caricati».
- **Perche'** (asse articolo): A4. Non sono residenti in contesto, ma sono un moltiplicatore di errore quando il blocco viene rincollato: tre copie della stessa fonte già disallineate.
- **Reversibilita'**: Archiviazione invece di cancellazione.
- **Verifica**: `ls preferences_backups/*.txt` -> vuoto (o solo _archive/).


## Onda WG — Onda G — Memoria di progetto

| ID | Titolo | Sede | Rischio | Tok |
|---|---|---|---|---:|
| `WG-01` | Riportare MEMORY.md a essere un indice | fuori | MEDIO | 2050 |
| `WG-02` | Fondere le sei memorie del cluster autonomia in un contratto unico | fuori | ALTO | 3500 |
| `WG-03` | Cancellare le tre memorie-mandato consumate | fuori | BASSO | 2268 |
| `WG-04` | Archiviare le memorie di cronaca e le snapshot di sessione | fuori | MEDIO | 9000 |
| `WG-05` | De-duplicare le memorie che ripetono strati già residenti | fuori | MEDIO | 5000 |
| `WG-06` | Re-indicizzare la memoria irraggiungibile e correggere i path stale | fuori | BASSO | 0 |
| `WG-07` | Aggiungere un check di parità indice/directory per le memorie | repo | BASSO | 0 |


### `WG-01` — Riportare MEMORY.md a essere un indice

- **File**: `C:\Users\enzospenuso\.claude\projects\D--heuresys-advanced\memory\MEMORY.md (10.991 byte, 66 righe)`
- **Livello**: progetto · **Rischio**: MEDIO · **Risparmio stimato**: 2050 token · **Dipende da**: WB-04, WB-05, WB-10
- **Azione**: Ridurre ogni voce a titolo + una riga descrittiva NEUTRA («cosa c'è dentro»), togliendo le prescrizioni inline. Oggi 24 voci su 55 portano l'enunciato completo della regola (divieti, override, regole permanenti) nell'unico file dello strato che è SEMPRE residente.
- **Perche'** (asse articolo): A3. Un indice che porta le prescrizioni trasforma un archivio a richiamo in un secondo strato di vincoli sempre attivi, in concorrenza con i due CLAUDE.md.
- **Reversibilita'**: Revert dal git di W0-01 (se la directory memory/ vi è inclusa) o backup manuale del file prima dell'edit.
- **Verifica**: `wc -c MEMORY.md` ≤ 3.000 byte. Sonda: chiedere un fatto contenuto in una memoria e verificare che il file venga aperto e la regola applicata.

### `WG-02` — Fondere le sei memorie del cluster autonomia in un contratto unico

- **File**: `memory\feedback_scope_discipline_no_cascade.md, feedback_batch_delegation_mode.md, feedback_claude_decides_technical.md, feedback_converge_and_plain_reporting.md, feedback_pm_what_claude_owns_how.md, feedback_full_autonomy.md`
- **Livello**: progetto · **Rischio**: ALTO · **Risparmio stimato**: 3500 token · **Dipende da**: WG-01
- **Azione**: Un solo documento «contratto di lavoro con Enzo» con la regola di decisione esplicita: chi decide cosa, quando ci si ferma davvero, e il confine osservabile della cadenza automatica («prosegui finché la prossima voce viene dal registro/menu già presentato; se non c'è, registrala e prosegui con la successiva che c'è»). Eleggere claude_decides_technical + converge come base. Cancellare la clausola session-scoped di batch_delegation (riga 25), oggi in contraddizione con la STANDING RULE della riga 15 dello STESSO file.
- **Perche'** (asse articolo): A1. Sei memorie danno istruzioni incompatibili sullo stesso atto elementare (fermarsi o proseguire) e ognuna si dichiara 'bounded by' le altre senza mai definire il confine: 5.271 token di direttive che il modello deve arbitrare prima di decidere.
- **Reversibilita'**: Backup dei sei file prima della fusione; git di W0-01 se incluso.
- **Verifica**: Sonde P1 e P3 ripetute dopo la fusione: gli esiti devono restare quelli ottenuti in Onda B (nessuna regressione). I sei file originali sono archiviati, non persi.

### `WG-03` — Cancellare le tre memorie-mandato consumate

- **File**: `memory\project_next_session_forensic_mandate.md, project_next_session_epics_mandate.md, project_next_session_db_frontend_forensics.md`
- **Livello**: progetto · **Rischio**: BASSO · **Risparmio stimato**: 2268 token · **Dipende da**: WG-01
- **Azione**: Cancellare tutti e tre (2.268 token complessivi + 3 righe residenti nell'indice). I verbali di esecuzione vivono già negli output versionati (docs/kb/full-forensic-audit/) e i residui nell'Action register, che il CLAUDE.md dichiara SoT.
- **Perche'** (asse articolo): A3. Una memoria che esiste per dire «già fatto, NON ri-eseguire» è esattamente il carico che la progressive disclosure elimina.
- **Reversibilita'**: Archiviazione in memory/_archive/ invece di cancellazione.
- **Verifica**: L'indice non contiene più le tre voci; `ls docs/kb/full-forensic-audit/` conferma che i verbali esistono altrove.

### `WG-04` — Archiviare le memorie di cronaca e le snapshot di sessione

- **File**: `memory\project_brand_session1_state.md, project_mvp3_session_state.md, project_goal003_session_state.md, project_v1_consolidation_plan.md, project_brand_identity_bundle.md, project_brand_fidelity_migration.md, project_rtl_tenant_rebuild.md, project_s953_rbac_uix_epic.md, project_post_v1_program_s987.md`
- **Livello**: progetto · **Rischio**: MEDIO · **Risparmio stimato**: 9000 token · **Dipende da**: WG-03
- **Azione**: Spostare in memory/_archive/ dopo aver ESTRATTO i gotcha ancora vivi (da brand_fidelity: i due gotcha frontend; da rtl_tenant_rebuild: nulla — contraddice I14 con la chiave 'LEGACY:'||users.id vietata; da post_v1: le decisioni già prese vanno nel register come vincoli degli item). project_brand_session1_state contiene perfino una checklist di push delegata all'utente: uno snapshot git in un file che non si aggiorna è informazione falsa per costruzione.
- **Perche'** (asse articolo): A3 + A5. ~11.500 token di cronaca di lavoro chiuso, che si presenta ancora come stato corrente.
- **Reversibilita'**: Archiviazione, non cancellazione.
- **Verifica**: L'indice elenca solo memorie vive; i gotcha estratti sono nella nuova sede e citabili. Sonda: chiedere un fatto sul rebuild RTL e verificare che la risposta usi I14 (LEGACY_EMP::), non la chiave vietata.

### `WG-05` — De-duplicare le memorie che ripetono strati già residenti

- **File**: `memory\feedback_full_alignment_doctrine.md, project_production_grade_two_tenants.md, reference_linux_pc_prod_twin.md, reference_remote_ssh_deploy_ops.md, reference_local_e2e_node22_playwright.md, project_cli_sot_takeover.md, reference_vm_deploy_self_modify_buffer.md`
- **Livello**: progetto · **Rischio**: MEDIO · **Risparmio stimato**: 5000 token · **Dipende da**: WG-04
- **Azione**: Cancellare full_alignment_doctrine (SoT = deploy/README.md, versionato e allineato agli script) e production_grade_two_tenants (già in I15 + DoD + ADR). Ridurre linux_pc_prod_twin al solo delta non presente in CLAUDE.md (pg_restore v17 vs server v16, template systemd User=ubuntu, clone-vm-db.sh da eseguire SUL linux-pc) e risolvere la sua incoerenza interna («ISOLATO» poi ritirato). Ridurre remote_ssh_deploy_ops ai gotcha non già residenti (psql remoto che si appende senza -w, cookie Secure su HTTP, collisione porta :3100). Cancellare cli_sot_takeover (ordina di leggere SOT_STATE per primo, vietato dal CLAUDE.md) e vm_deploy_self_modify_buffer (difetto risolto: il fix è nello script, righe 62-63 e 40).
- **Perche'** (asse articolo): A4. Cinque memorie duplicano quasi verbatim sezioni sempre caricate; una prescrive attivamente un comportamento vietato; una prescrive verifiche per un difetto che non si presenta più.
- **Reversibilita'**: Archiviazione in memory/_archive/.
- **Verifica**: Sonda: chiedere come si allineano i cloni e verificare che la risposta usi align-clones.sh e deploy/README.md; chiedere lo stato del progetto e verificare che NON vengano aperti i tre file SoT.

### `WG-06` — Re-indicizzare la memoria irraggiungibile e correggere i path stale

- **File**: `memory\MEMORY.md (voce mancante) + memory\project_session_start_optimization.md, project_s953_rbac_uix_epic.md, feedback_brand_before_graph_renderers.md (path)`
- **Livello**: progetto · **Rischio**: BASSO · **Risparmio stimato**: 0 token · **Dipende da**: WG-05
- **Azione**: Aggiungere in MEMORY.md la voce `reference_claude_ecosystem_alignment.md` — l'unico file su 55 non raggiungibile dall'indice, ed è proprio quello che contiene la sola regola a conseguenza irreversibile (credenziali forward-only). Correggere almeno 5 puntatori a `docs/kb/*` che oggi vivono in `docs/kb/xtras/` (verificato: xtras/ contiene DESIGN_SYSTEM_UI, AUTONOMY_R23_PROJECT, SESSION_START_FORENSICS, RBAC_UIX_PERSPECTIVES_PLAN, VISUALIZATION_RENDERERS_CLOSURE).
- **Perche'** (asse articolo): P4. Un riferimento rotto in una memoria produce esattamente la decisione a naso che la memoria doveva impedire.
- **Reversibilita'**: Edit testuale.
- **Verifica**: Tutti i path citati nelle memorie superstiti risolvono (`for p in $(grep -ho 'docs/kb/[A-Za-z_/.-]*' memory/*.md | sort -u); do [ -e "/d/heuresys-advanced/$p" ] || echo MISS $p; done` -> vuoto). L'indice elenca 55 voci quanti sono i file.

### `WG-07` — Aggiungere un check di parità indice/directory per le memorie

- **File**: `D:\heuresys-advanced\docs\kb\tools\handoff_lint.py (nuovo check, non bloccante) oppure scripts\align-claude-ecosystem.sh`
- **Livello**: progetto · **Rischio**: BASSO · **Risparmio stimato**: 0 token · **Dipende da**: WG-06
- **Azione**: Aggiungere un controllo: ogni file in memory/ deve comparire in MEMORY.md e viceversa; segnalare i path citati che non risolvono. Modellarlo sul check `project_memory` già presente in align-claude-ecosystem.
- **Perche'** (asse articolo): A6. La regola vive nello strumento, non in una lista da ricopiare: oggi nessun processo verifica la parità né la validità dei path.
- **Reversibilita'**: File versionato: revert per commit.
- **Verifica**: Rimuovere temporaneamente una voce dall'indice fa scattare il warning; ripristinarla lo spegne. FILE VERSIONATO.


## Onda WH — Onda H — bsr-method e contaminazione

| ID | Titolo | Sede | Rischio | Tok |
|---|---|---|---|---:|
| `WH-01` | Disarmare il caricamento di BEHAVIOR_RULES | fuori | BASSO | 16055 |
| `WH-02` | Correggere l'identità sbagliata già propagata nell'ecosistema condiviso | fuori | BASSO | 0 |
| `WH-03` | Ridurre BEHAVIOR_RULES alla sola regola non derivabile | fuori | BASSO | 0 |


### `WH-01` — Disarmare il caricamento di BEHAVIOR_RULES

- **File**: `D:\enzospenuso\Projects\bsr-method\CLAUDE.md riga 54 (FASE 1) e righe 11-16 (gerarchia)`
- **Livello**: macchina · **Rischio**: BASSO · **Risparmio stimato**: 16055 token · **Dipende da**: —
- **Azione**: Rimuovere l'istruzione «1. LEGGI /BEHAVIOR_RULES.md» e la clausola «IN CASO DI CONFLITTO SU METODOLOGIA -> QUESTO FILE PREVALE». È il ramo a rischio zero che chiude la collisione di nomenclatura senza toccare nulla in heuresys.
- **Perche'** (asse articolo): A3 + collisione di namespace. Il file non è tracciato da git (verificato: 'did not match any file(s) known to git') e nessuna sessione CLI è mai stata aperta lì, quindi il costo oggi è ZERO — ma è ARMATO: la prima sessione aperta in quel repo pagherebbe ~16.055 token e importerebbe 5 inversioni semantiche (R003 vs R3, R014, R022, R023, R001).
- **Reversibilita'**: File tracciato in bsr-method: revert per commit.
- **Verifica**: Aprire una sessione in D:\enzospenuso\Projects\bsr-method e verificare che BEHAVIOR_RULES.md non venga letto (nessun riferimento a R001-R032 nel primo turno). FILE VERSIONATO (repo bsr-method).

### `WH-02` — Correggere l'identità sbagliata già propagata nell'ecosistema condiviso

- **File**: `C:\Users\enzospenuso\.claude\skills\ralph-build-loop\README.md riga 117 e reference\QUEUE_SCHEMA.md riga 158`
- **Livello**: utente · **Rischio**: BASSO · **Risparmio stimato**: 0 token · **Dipende da**: WH-01
- **Azione**: README.md:117 scrive «BEHAVIOR_RULES: ~/.claude/CLAUDE.md R1-R17», fondendo in un'unica etichetta due corpi di regole distinti che usano gli stessi numeri per cose diverse, e congelando il conteggio a 17. Correggere in «Regole utente: ~/.claude/CLAUDE.md». QUEUE_SCHEMA.md:158 ha importato i profili FULL/STANDARD/LIGHT/MICRO da un file mai committato: rimuoverli o dichiararne l'origine.
- **Perche'** (asse articolo): Prova sul campo che la collisione è già uscita dal progetto dormiente per via referenziale, dentro una skill installata a livello utente che opera su heuresys-advanced.
- **Reversibilita'**: Revert dal git di W0-01.
- **Verifica**: `grep -rn "BEHAVIOR_RULES" ~/.claude/skills/` -> 0 occorrenze che identificano il CLAUDE.md globale.

### `WH-03` — Ridurre BEHAVIOR_RULES alla sola regola non derivabile

- **File**: `D:\enzospenuso\Projects\bsr-method\BEHAVIOR_RULES.md (64.220 char) -> paragrafo dentro bsr-method\CLAUDE.md + docs\archive\`
- **Livello**: macchina · **Rischio**: BASSO · **Risparmio stimato**: 0 token · **Dipende da**: WH-01
- **Azione**: Estrarre R028 (Dual-Layer SpecKit/BMAD: SPECKIT = intent/.spec.md, BMAD = execution/codice, sequenza Intent->Execution senza inversioni) come paragrafo del CLAUDE.md di bsr-method, spogliato del wrapper «ZERO TOLERANCE / 4 classi di violazione». Archiviare il resto. Delle 32 regole: 20 sono default o derivabili, 8 rituale procedurale, 3 obsolete perché importate da un altro progetto (R015 path /home/ubuntu/heuresys.com.evo, R018 SAP — verificato: 'SAP' compare SOLO dentro quel file, R020 database — bsr-method non ha DB).
- **Perche'** (asse articolo): P2 + A1. ~16.000 token per ~475 token di informazione realmente non derivabile: circa il 3%.
- **Reversibilita'**: Archiviazione; il file non è nemmeno tracciato oggi.
- **Verifica**: Il CLAUDE.md di bsr-method contiene R028 in prosa; BEHAVIOR_RULES.md è in docs/archive/. FILE VERSIONATO (repo bsr-method).


## Onda WI — Onda I — Verifica finale

| ID | Titolo | Sede | Rischio | Tok |
|---|---|---|---|---:|
| `WI-01` | Verificare che i freni di sicurezza scattino ancora | fuori | NULLO | 0 |
| `WI-02` | Misura finale prima/dopo e chiusura del ciclo | fuori | NULLO | 0 |


### `WI-01` — Verificare che i freni di sicurezza scattino ancora

- **File**: `nessuna modifica — sonde su repo e sessioni pulite`
- **Livello**: trasversale · **Rischio**: NULLO · **Risparmio stimato**: 0 token · **Dipende da**: WG-07, WH-03
- **Azione**: Per ciascuna area critica preservata, sollecitare l'azione pericolosa e verificare che il freno scatti: (a) `pnpm db:reset` -> conferma richiesta; (b) `git push --force` su main -> alternativa proposta; (c) probe di sicurezza fuori perimetro in web-qa-audit -> rifiuto R18; (d) accesso a dati COMPENSATION fuori catena organizzativa -> negato (5 test scope-*); (e) segreti in un diff staged -> segnalati; (f) zero-pending-loop con freno inserito -> non esegue e scrive .zp/last-outcome.json.
- **Perche'** (asse articolo): L'articolo esenta esplicitamente le aree critiche dal rilassamento: questa voce dimostra che l'esenzione è stata rispettata, invece di dichiararlo.
- **Reversibilita'**: N/A — sole verifiche.
- **Verifica**: Sei sonde, sei esiti attesi documentati con l'output reale. Se una sola non scatta, ripristinare la regola corrispondente prima di proseguire.

### `WI-02` — Misura finale prima/dopo e chiusura del ciclo

- **File**: `scratchpad + deploy\reports\claude-align\ (lettura)`
- **Livello**: trasversale · **Rischio**: NULLO · **Risparmio stimato**: 0 token · **Dipende da**: WI-01
- **Azione**: Ri-misurare tutte le grandezze del baseline W0-02 con gli stessi comandi; rieseguire le sonde P1/P2/P3 (N=5); leggere il verdetto CLEAN/DRIFT dei report di align. Confrontare in una tabella prima/dopo.
- **Perche'** (asse articolo): P5. Il criterio di successo NON è il risparmio: è che P1 e P2 scendano a zero e P3 sia deterministico. Se i token calano ma le sonde no, l'armonizzazione non ha funzionato.
- **Reversibilita'**: N/A.
- **Verifica**: Tabella prima/dopo con: 6 misure byte, caratteri di output degli hook (Windows e VM), /context di Enzo, turni prima del menu, verdetto dei report di align, e i 15 esiti delle sonde. Target: ~-20.000 token residenti e P1=P2=0.
