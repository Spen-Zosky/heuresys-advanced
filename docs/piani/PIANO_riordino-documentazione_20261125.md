# Piano: riordino di tutta la documentazione (2026-11-25)

Stato: **fase 1 conclusa (censimento e piano), in attesa dell'approvazione di Enzo**. Nessun documento è stato spostato, modificato o cancellato. Richiesta di Enzo del 2026-11-25 nel progetto «ENZO: heuresys ecosystem», thread «Riordinare tutta la documentazione»: eliminare ciò che è superato e inutile, riallineare e aggiornare ciò che vale allo stato attuale, accorpare per domini di argomento, avere indici analitici e rimandi incrociati sul modello llm-wiki, e un meccanismo con le automazioni che tenga tutto aggiornato.

Perimetro: i repo heuresys-advanced e heuresys-datastore (tutti i file di documentazione tracciati da git: `.md`, `.mdx`, `.txt`, `.html`, `.pdf`, `.docx`, `.xlsx`) e la cartella condivisa dei file del progetto (`/mnt/project-files/`, esclusa `uploads/`). Stato di riferimento: `main` dei due repo al 2026-11-25 (advanced `3d69223`, datastore `b1abfc3`). Il piano gemello del datastore è `esecuzione/piani/124_PIANO_IL_RIORDINO_DELLA_DOCUMENTAZIONE.md` nel suo repo; il censimento dei file del progetto è in `/mnt/project-files/documentazione/`.

## 1. Esito del censimento

Ogni documento ha una riga, senza campionamento: 2.141 righe in tutto, controllate per percorso contro l'elenco di partenza (nessun mancante, nessun doppione, nessuna riga in più).

| sede | documenti | valido | da aggiornare | da accorpare | superato |
|---|---|---|---|---|---|
| heuresys-advanced | 1.284 | 167 | 108 | 77 | 932 |
| heuresys-datastore | 519 | 64 | 42 | 22 | 391 |
| file del progetto | 338 | 32 | 4 | 72 | 230 |
| **totale** | **2.141** | **263** | **154** | **171** | **1.553** |

Tre documenti su quattro sono superati: sono esiti, mandati, misure e piani di cicli chiusi, canali di scambio ritirati e copie di lavoro. Restano vivi circa 590 documenti, di cui 325 da sistemare.

Per dominio (tutte le sedi insieme):

| dominio | totale | valido | da aggiornare | da accorpare | superato |
|---|---|---|---|---|---|
| storia-archivio | 516 | 5 | 3 | 2 | 506 |
| qualita-verifica | 303 | 48 | 8 | 27 | 220 |
| consolidamento-tenant | 213 | 26 | 10 | 39 | 138 |
| stato-pianificazione | 182 | 3 | 14 | 2 | 163 |
| dati-db | 168 | 38 | 5 | 12 | 113 |
| operazioni-infra | 128 | 15 | 41 | 0 | 72 |
| prodotto-visione | 103 | 16 | 9 | 37 | 41 |
| frontend-ux | 101 | 15 | 9 | 3 | 74 |
| sicurezza-accessi | 85 | 15 | 3 | 3 | 64 |
| agenti-ia | 84 | 24 | 12 | 5 | 43 |
| governo | 70 | 18 | 28 | 0 | 24 |
| tassonomie-conoscenza | 66 | 16 | 6 | 9 | 35 |
| processi-organizzazione | 49 | 8 | 1 | 30 | 10 |
| architettura | 48 | 3 | 1 | 2 | 42 |
| api-backend | 25 | 13 | 4 | 0 | 8 |

File del censimento (una riga per documento, colonne `path`, `dominio`, `natura`, `data`, `verdetto`, `motivo`, `riferimento`, più per i repo `citato_da_codice` e `citato_da_migrazioni`):

- advanced: [riordino-documentazione_20261125/CENSIMENTO_advanced.tsv](riordino-documentazione_20261125/CENSIMENTO_advanced.tsv)
- datastore: `esecuzione/_misure/CENSIMENTO_DOCUMENTI_20261125.tsv` nel repo heuresys-datastore
- file del progetto: `/mnt/project-files/documentazione/CENSIMENTO_file-del-progetto_20261125.tsv`
- note dei lotti, con contraddizioni e gruppi da fondere: [riordino-documentazione_20261125/NOTE_DEI_LOTTI.md](riordino-documentazione_20261125/NOTE_DEI_LOTTI.md)

### Come si è fatto, e i limiti

Il censimento è stato diviso in otto lotti, ciascuno affidato a un revisore che ha confrontato ogni file con le fonti dello stato attuale (CLAUDE.md dei due repo, `.handoff/STATE.md`, `SOT_STATE.md`, `SOT_BACKLOG.md`, `DEBT_REGISTER.md`, lo Stato scritto dentro ogni ADR, `STATO_CORRENTE.md` e `DOMANDE_APERTE.md` del datastore). I limiti vanno detti:

1. **Le date di git non servono.** La storia di advanced è schiacciata: tutti i file risultano al 2026-11-22; nel datastore quasi tutti al 2026-10-26 (uno spostamento in blocco). L'età vera è stata letta da nomi e intestazioni, e la colonna `data` va presa come «ultimo tocco», non come età.
2. **Gruppi omogenei giudicati in blocco.** Le inbox ritirate, le evidenze grezze del mandato K, i log in `_misure/`, i processi FIN_BANKING e il curriculum GitHub sono stati giudicati per gruppo dopo aver aperto ciascun file almeno nell'intestazione, o un campione rappresentativo per le evidenze grezze. I file molto lunghi (OUTBOX del datastore, 12.944 righe; handover da 91 KB; CHANGELOG del vault) non sono stati letti per intero.
3. **Il verdetto è un parere, non una mossa.** Prima di spostare un file, la fase 2 ricontrolla chi lo cita (sezione 5, voce R2).

La colonna `citato_da_codice` conta i file di codice vivi che nominano il documento; `citato_da_migrazioni` le migrazioni che lo nominano nei commenti. Fra i superati, 188 sono citati dal codice e 45 da migrazioni già applicate (che non si modificano, perché cambierebbe l'impronta).

## 2. Le contraddizioni più gravi

Sono i punti in cui oggi un lettore, umano o agente, riceve un'informazione falsa. Il dettaglio con i percorsi è in NOTE_DEI_LOTTI.md.

1. **I registri di stato sono fermi a ottobre.** `.handoff/STATE.md` dice «Updated 2026-10-29»; `SOT_STATE.md` ha l'ultimo delta al 2026-09-27; `SOT_BACKLOG.md` ha l'intestazione al 2026-08-10; `DEBT_REGISTER.md` al 2026-07-21. Gli ADR 0049-0061, il consolidamento, i giri forensi del 15/11 e del 23-25/11 stanno solo in `docs/piani/` e negli ADR. Nel datastore `STATO_CORRENTE.md` è fermo al 2026-11-02 e `PROMPT_PROSSIMA_SESSIONE.md` al 2026-10-23.
2. **Il PC Windows come macchina di lavoro.** Il CLAUDE.md del datastore, `preflight/00_PREFLIGHT.md`, `preflight/07_CONTINUITA_DI_SESSIONE.md` e `docs/04_impianto/32_LA_SECONDA_MACCHINA.md` dicono ancora che si sviluppa sul PC, mentre dal 2026-10-23 il datastore vive solo sulla VM (lo dice lo stesso CLAUDE.md, più sotto). In advanced, `deploy/README.md`, `db/scripts/README.md` e `.claude/sessione/AVVIO.md` descrivono hook e tunnel Windows che `.claude/settings.json` non usa più.
3. **Il legacy come fonte.** AGENTS.md, `docs/brownfield/ENGINE_STATUS.md`, i report BROWNFIELD_*, gli ADR 0012/0014/0017/0018/0020, `xtras/RTL_STABILIZATION_PLAN.md` e le spec `rtl-tenant-rebuild*` trattano il DB legacy come fonte autorevole, contro ADR-0038 e l'invariante I12. Nel repo è ancora tracciato `docs/source_bundle/brownfield/db-export.zip`, un export del DB legacy.
4. **ADR con stato diverso da quello vero.** `ADR_INDEX.md` dà ADR-0040 «ACCEPTED» mentre il file dice «Superseded in part by ADR-0053»; ADR-0033 resta PROPOSED dal 2026-08; ADR-0002 dice Fastify 4 e ADR-0007 Next.js 15 (il codice ha Fastify 5 e Next 16); mancano 0019, 0022 e 0058 senza nota (e un piano nei file del progetto cita un ADR-0058 che non esiste). `.claude/rules/regole-di-progetto.md` cita come vigente la regola dei due assi di ADR-0027, superato da ADR-0036. Nei file del progetto ci sono copie di ADR-0047, 0048, 0051, 0052 e 0061 ancora PROPOSTE, mentre nel repo sono accettate.
5. **Il canale cowork_code_exchange descritto come vivo.** Il README di radice lo descrive come protocollo v2.2 e rimanda a un «what's next» di maggio; `INDEX_PATHS.md` ne elenca i 186 file.
6. **La questione della chiave API riaperta.** CLAUDE.md la dà per chiusa; la riaprono `docs/due-diligence/EXECUTIVE_SUMMARY.md` (azione P0), `workstreams/WS-T7.md`, `WS-P3.md`, `WS-P4.md`, la riga 802 di `SOT_BACKLOG.md`, `.zp/PROGRESS.md` (Z-201), e nel datastore `docs/04_impianto/20_LE_ROTTE_DEL_SERVIZIO.md` e il CLAUDE.md stesso, che dice che il cliente del modello ha «solo la via della chiave» mentre `src/modello/claude_code.ts` esiste.
7. **Piani e programmi con lo stato sbagliato in testa.** Programmi chiusi che si dicono «IN CORSO» (S1067, S1068, S1071, #214), programmi vivi che non hanno una voce di registro (il consolidamento), piani di novembre con voci «da fare» già nel codice (allineamento, scheda di allineamento, applet, assistente), e nel datastore EPIC_CCNL, EPIC_MODELLAZIONE e i piani 04, 19, 83, 85, 114, 115, 117 e 119 che si dicono in corso su cicli chiusi.
8. **Percorsi spezzati in documenti che istruiscono.** README, AGENTS.md e `.claude/rules/api-module-pattern.md` citano `docs/api/API_IMPLEMENTATION_PLAN.md`, che è in `docs/archive/`; `.claude/rules/frontend-live-data.md` cita i NEXT_SESSION_* superati; `apps/agent-gateway/README.md` dice «non distribuito» e la unit systemd esiste.

## 3. Il modello llm-wiki, e come si applica qui

Il modello è quello descritto da Andrej Karpathy nel gist «LLM Wiki» (aprile 2026, https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). Tre strati:

- **le fonti grezze**, immutabili: si leggono, non si riscrivono (qui: ADR, misure, esiti, la storia di git);
- **il wiki**, pagine scritte e mantenute da un modello che sintetizzano lo stato attuale per argomento, con un rimando alla fonte per ogni affermazione e rimandi incrociati fra le pagine;
- **lo schema**, il file che dice come è fatto il wiki e come si mantiene (qui: il CLAUDE.md di ciascun repo e una regola dedicata).

Due file speciali: `index.md`, il catalogo di tutte le pagine con una riga di sintesi ciascuna, raggruppate per categoria, che chi interroga legge per primo; `log.md`, il registro cronologico in sola aggiunta di ogni acquisizione, interrogazione e controllo. Tre operazioni: **ingest** (una fonte nuova aggiorna le 10-15 pagine che tocca), **query** (si risponde dal wiki partendo dall'indice), **lint** (un controllo periodico che cerca contraddizioni, affermazioni stantie, pagine orfane e rimandi mancanti, e propone le correzioni).

Che cosa abbiamo già, e che va riusato invece di rifatto:

| funzione llm-wiki | advanced | datastore |
|---|---|---|
| wiki per argomento | `docs/kb/atlas/` (vista derivata, generata da `build_atlas.py`) | il vault Obsidian `docs/` con i link `[[...]]` |
| `index.md` | `INDEX_PATHS.md` (generato da `build_index.py`, ma con radici Windows) e `ADR_INDEX.md` (`build_adr_index.py`) | `docs/00_preface/00_INDEX.md` e `preflight/01_PERCORSO_DI_LETTURA.md` |
| `log.md` | `.handoff/close-log.ndjson`, i Delta di `SOT_STATE.md` | `docs/_meta/CHANGELOG.md` |
| lint strutturale | `handoff_lint.py`, `check_istruzioni.py`, `check_marciume.py`, `atlante_fresco.py` | `docs/_meta/verifica_vault.sh` (link, conteggi, accenti, elenchi), `esecuzione/_verifica_esecuzione.sh` |
| lint di verità | nessuno | nessuno |

Il buco è l'ultima riga: tutti i controlli esistenti guardano la forma (link, elenchi, conteggi, accenti, freschezza dei generati), e nessuno si accorge che un documento dice una cosa non più vera. È esattamente il buco che ha prodotto le contraddizioni della sezione 2. Un tentativo precedente di wiki Obsidian di advanced («heuresys-advanced-wiki» in `wiki-space`, decisione B-02 del 2026-05-29) vive sul PC Windows, fuori dal repo: va ritirato insieme agli script che lo alimentano (`build_linked_manifest.py`, `build_graph_hub.py`, `build_graph_mirror.py`, `sync.ps1`).

## 4. La struttura proposta

### 4.1 Un wiki per repo, con lo stesso schema

- advanced: `docs/wiki/`; datastore: il vault `docs/` resta il wiki, con le stesse regole di pagina (non si crea una seconda cartella).
- `docs/wiki/index.md` (generato): una riga per pagina viva, con dominio, sintesi di una riga, data di aggiornamento e fonti; in testa i quindici domini.
- `docs/wiki/log.md` (in sola aggiunta): una riga per ogni ingest, lint e ritiro, con data, commit e pagine toccate. Nel datastore questo ruolo lo fa già `docs/_meta/CHANGELOG.md`.
- `docs/wiki/domini/<dominio>.md`: una pagina per dominio, sempre con le stesse sezioni: «Com'è oggi» (sintesi breve, ogni affermazione con il suo rimando), «Decisioni in vigore» (gli ADR, con il loro stato), «Come si fa» (runbook, skill, comandi del repo), «Stato e pendenze» (rimandi alle righe dei registri, mai copie), «Storia» (che cosa è stato ritirato e con quale commit), «Vedi anche» (pagine collegate, anche dell'altro repo).
- `docs/wiki/concetti/<concetto>.md`: una pagina per ogni oggetto del modello che compare in più domini (posizione, titolare, unità, tenant, mandato, perimetro, corsa, consolidamento, processo, attività, competenza, CCNL, agente, assistente). È l'indice analitico: ogni pagina di concetto elenca dove il concetto è definito, deciso, implementato e verificato.
- `docs/wiki/indice-analitico.md` (generato): termine, pagine che lo trattano, documenti fonte. Si costruisce dai metadati delle pagine (sotto) e dal glossario esistente (`GLOSSARIO_dieci-oggetti_v0.3.md`, gemello di quello del datastore).

### 4.2 I quindici domini

governo; architettura; dati-db; api-backend; frontend-ux; sicurezza-accessi; agenti-ia; processi-organizzazione; tassonomie-conoscenza; consolidamento-tenant; operazioni-infra; qualita-verifica; prodotto-visione; stato-pianificazione; storia-archivio. Sono gli stessi nei due repo, così un rimando «vedi il dominio X nel datastore» resta valido. `storia-archivio` non diventa una pagina di contenuto: è l'elenco dei ritiri.

### 4.3 I metadati di ogni documento vivo

Ogni documento vivo porta in testa un blocco di metadati, che le automazioni leggono:

```yaml
---
dominio: consolidamento-tenant
natura: riferimento        # norma | decisione | riferimento | stato | piano | esito | generato | modello
stato: vivo                # vivo | chiuso | sostituito
aggiornato_il: 2026-11-25
fonti: [docs/architecture/adr/0059_allineamento_e_consolidamento_due_modi.md, apps/api/src/modules/tenant-consolidation/]
sostituisce: []
sostituito_da: null
concetti: [consolidamento, corsa, tenant]
---
```

Un piano o un esito chiuso passa a `stato: chiuso`, la sua conoscenza utile entra nella pagina di dominio, e al giro di ritiro successivo esce dal repo.

### 4.4 Dove va ciò che è superato

Proposta (decisione D1 nella sezione 7): i 1.553 superati **escono dal repo**. Secondo le regole, si spostano in `_da_eliminare/` fuori da git (nel datastore con `bash ~/.claude/tools/da-eliminare.sh`) e si cancellano solo con il sì di Enzo; il contenuto resta comunque nella storia di git, e la pagina di dominio, nella sezione «Storia», registra il percorso e il commit da cui recuperarlo. `docs/archive/` smette di crescere: ne restano solo `SOT_BACKLOG_CHIUSI.md` e `etl-brownfield-ritirato/README.md`, che sono letti da documenti vivi.

### 4.5 I file del progetto

`/mnt/project-files/` non è una fonte di verità: è un passaggio. Un file ci resta finché il lavoro che lo ha prodotto è aperto; poi entra nel repo giusto (se serve) o esce. Fanno eccezione le schermate e le consegne per Enzo ancora in revisione. La cartella `documentazione/` tiene un `LEGGIMI.md` con questa regola e l'elenco dei file vivi.

## 5. Le automazioni

Prima gli strumenti esistenti, estesi; uno nuovo solo dove manca la funzione, e qui va detto: manca un controllo dei metadati e della verità dei documenti, quindi la voce A1 propone un solo strumento nuovo, `docs/kb/tools/check_documenti.py`, con il gemello nel datastore come sezione di `verifica_vault.sh`.

| id | cosa controlla | come | dove gira | riusa |
|---|---|---|---|---|
| A1 | metadati presenti e coerenti su ogni documento vivo (dominio e natura dell'elenco chiuso, `aggiornato_il`, `fonti` che esistono) | `check_documenti.py --metadati` | CI, workflow `state-lint.yml` (advanced) e `controlli-statici.yml` (datastore) | lo stile di `handoff_lint.py` |
| A2 | link rotti: link relativi markdown in advanced, `[[...]]` nel datastore | `check_documenti.py --link`; nel datastore la sezione 1 di `verifica_vault.sh` già lo fa | CI | `verifica_vault.sh` sezione 1 |
| A3 | freschezza: una pagina è vecchia se una delle sue `fonti` è cambiata dopo `aggiornato_il` | stessa regola di `atlante_fresco.py`, applicata a ogni pagina | CI (avviso sulla PR che tocca la fonte) e `check_marciume.py` (a tempo) | `atlante_fresco.py`, `atlas-freshness.yml`, `check_marciume.py` |
| A4 | nessun documento vivo cita un documento `stato: sostituito` o un percorso che non esiste più | `check_documenti.py --rimandi` | CI | `check_istruzioni.py` |
| A5 | affermazioni vietate perché false: canale cowork_code_exchange vivo, chiave API come blocco, PC Windows come macchina del datastore, legacy come fonte, porte ritirate | elenco di frasi e percorsi in `docs/wiki/affermazioni_vietate.txt`, con eccezioni dichiarate (come `exposure_waivers.txt`) | CI | il modello di `check_no_legacy_ingest.py` |
| A6 | stato degli ADR: `ADR_INDEX.md` coincide con lo Stato scritto in ogni file; un ADR superato ha il successore che lo dichiara | `build_adr_index.py --check` | CI, `file-generati.yml` | `build_adr_index.py` |
| A7 | registri di stato aggiornati: `.handoff/STATE.md`, `SOT_STATE.md`, `cruscotto/stato.json` e `STATO_CORRENTE.md` non più vecchi di 7 giorni rispetto all'ultimo commit su `main` | nuovo controllo D5 in `handoff_lint.py`; nel datastore una sezione di `_verifica_esecuzione.sh` | CI e `chiudi.py` | `handoff_lint.py` D3 |
| A8 | ingest: una PR che cambia una fonte dichiarata di una pagina deve toccare anche la pagina, oppure dire nel corpo «nessun effetto sulla documentazione» | regola in `verify_gate.py` | CI e `chiudi.py --livello onda` | `verify_gate.py` |
| A9 | indice e indice analitico rigenerati | `build_index.py` riscritto senza le radici Windows: produce `docs/wiki/index.md` e `indice-analitico.md` dai metadati | CI `file-generati.yml` (il generato deve coincidere) | `build_index.py`, `build_concepts.py` |
| A10 | lint di verità con un modello: legge indice e pagine, confronta le affermazioni con il codice, gli ADR e il database (in sola lettura), scrive le contraddizioni in `log.md` e apre una PR di soli documenti | agente con il token dell'abbonamento (`token-agenti.sh carica`), timer settimanale sulla VM, unità in `~/.claude/tools/token-agenti.unita` | VM | skill `project-atlas` (modo refresh) e la dottrina degli agenti |
| A11 | file del progetto vecchi: elenca i file di `/mnt/project-files/` più vecchi di 14 giorni che nessun thread aperto cita | script del coordinatore, una volta a settimana, esito nel thread | coordinatore | nessuno |

Il lint semantico (A10) propone, non decide: apre una PR di soli documenti, che segue le regole delle PR (CI verde, unione). Le automazioni da A1 ad A9 sono deterministiche e rendono rossa la CI, come gli altri cancelli.

## 6. Il piano a voci per le fasi successive

Ogni voce si chiude con una prova: comando, esito, data. Le voci che spostano file partono sempre da due campioni mostrati a Enzo, come chiedono le sue istruzioni per le operazioni in blocco.

| id | fase | cosa | chi | fatta quando |
|---|---|---|---|---|
| R1 | 2, preparazione | Enzo approva il piano e decide D1-D4 (sezione 7) | Enzo | risposta nel thread |
| R2 | 2 | mappa esatta dei rimandi: per ogni superato, chi lo cita (documenti vivi, codice, migrazioni, workflow, script), con il comando che la rigenera | thread | file della mappa nel repo, comando ripetibile |
| R3 | 2 | correggere i rimandi vivi verso i superati: README, `.claude/rules/*`, skill, workflow (`paths-ignore`), `.gitattributes`, `.gitignore`, `align-clones.sh`; spostare `cowork_reserved/batch_c5/xos_lib/cross_os_pipeline.sh` in `db/scripts/_lib/`; nel datastore gli script `banco_*` che scrivono in `_misure/` | thread | `check_documenti.py --rimandi` verde sui superati |
| R4 | 2 | metadati (sezione 4.3) e lo strumento A1-A5 con la sua prova rossa e poi verde | thread | CI verde con lo strumento attivo |
| R5 | 3, ritiro | ritiro dei superati per lotti, prima due campioni per lotto: canali e QA storici (A4, 368 file), programmi chiusi (A3, 221, con la sessione dedicata dei `.programmi`), archivio e source bundle (A5), kb e piani (A2), architettura (A1), datastore (D1, D2), file del progetto (PF) | thread | ogni lotto fuori dal repo, CI verde, voce in `log.md` |
| R6 | 3 | i file del progetto che sono copie identiche di file dei repo (fatto il 25/11 per i dati del confronto TJB-RTL e dei ruoli chiave: 25 file in `_da_eliminare/20261125_dati-persone-rtl/`, i 14 senza copia depositati prima nei repo) e i due file dell'operazione segreti del 22/10 (un elenco di percorsi e uno script, senza valori nel controllo fatto) | thread | file fuori dalla cartella condivisa |
| R7 | 4, aggiornamento | i 154 documenti da aggiornare, per dominio, cominciando da quelli che istruiscono (CLAUDE.md dei due repo, `.claude/rules`, skill, preflight, README) e dalle contraddizioni della sezione 2 | thread | A4 e A5 verdi, ogni riga del censimento chiusa |
| R8 | 4 | registri di stato riallineati a novembre: `.handoff/STATE.md`, `SOT_STATE.md`, `SOT_BACKLOG.md`, `DEBT_REGISTER.md`, `cruscotto/stato.json`, `STATO_CORRENTE.md` del datastore (con la skill `handoff`) | thread | A7 verde |
| R9 | 4 | `ADR_INDEX.md` rigenerato e stati veri (0033, 0040, 0039; note per 0019, 0022, 0058); ADR-0002 e 0007 con la versione attuale | thread | A6 verde |
| R10 | 5, wiki | le quindici pagine di dominio e le pagine di concetto, accorpando i 171 documenti da accorpare nel loro destinatario | thread (Opus per la sintesi) | ogni pagina con metadati, A3 verde |
| R11 | 5 | `index.md`, `log.md`, `indice-analitico.md` generati (A9) | thread | `file-generati.yml` verde |
| R12 | 6, automazioni | A6, A7, A8 attivi in CI; A10 come timer sulla VM, visto rosso su una contraddizione messa apposta e poi verde | thread | prova dal vivo con orario |
| R13 | 6 | CLAUDE.md dei due repo: una sezione «La documentazione» con lo schema del wiki e le tre operazioni | thread | testo unito su `main` |
| R14 | chiusura | cancellazione definitiva di `_da_eliminare/` | Enzo | il suo sì nel thread |

Il lavoro non tocca `docs/piani/forense-frontend_20261123/` finché il giro di verifica delle pagine è aperto, non tocca `_recupero_20260716/` del datastore, e non modifica migrazioni già applicate: i loro commenti che citano un file ritirato restano come sono, e la pagina di dominio dice dove trovarlo nella storia di git.

**Che cosa non si chiude in questa fase.** Tutte le voci da R1 a R14, salvo la parte di R6 già fatta il 25/11. Questa fase consegna il censimento e il piano, e si ferma all'approvazione di Enzo.

## 7. Le decisioni che spettano a Enzo

- **D1. Dove vanno i superati.** Raccomandazione: escono dal repo (in `_da_eliminare/`, cancellati col tuo sì), con la traccia nella pagina di dominio e la storia in git. Costo: nessuno, è reversibile da git. Rischio: un rimando non visto si rompe, e per questo R2 e R3 vengono prima. L'alternativa è tenerli in `docs/archive/`, che però resta un posto dove un agente può leggere cose false.
- **D2. Il wiki di advanced in `docs/wiki/`**, e il vault del datastore che resta dov'è con le stesse regole. Raccomandazione: sì.
- **D3. L'export del DB legacy tracciato** (`docs/source_bundle/brownfield/db-export.zip`). Raccomandazione: esce dal repo con il lotto A5, perché I12 dice che il legacy si consulta per i concetti e non per le righe.
- **D4. Il lint di verità con un modello (A10)** come timer settimanale sulla VM. Raccomandazione: sì; usa l'abbonamento come gli altri agenti, e propone soltanto PR di documenti.

## 8. Fuori da questo ciclo

Scoperte di passaggio, da proporre una volta e non da eseguire qui: `PIANO_velocita-ci-e-rilasci_20261122` è una proposta che aspetta un sì o un no; la spec `delivery-loop` del 2026-07-25 descrive una skill mai costruita; `SECURITY.md` riporta un indirizzo email personale da riconfermare; `proposte_advanced/README.md` del datastore propone ad advanced una migrazione 000456 il cui numero è già occupato; `qa-web/strumento/qa-web.mjs` nei file del progetto non è versionato in nessun repo. Emerse durante l'esecuzione: il programma #214 (adozione dell'agente in coda per rischio) è contraddetto da ADR-0040 e va rivisto dalla sua sessione; 473 documenti ritirati restano citati solo da altri superati che per ora restano (ADR, `docs/vision/`, note d'archivio), che quindi portano link rotti storici; i piani con voci «da fare» già fatte (applet, assistente, principi agentici, consolidamento, allineamento, change management, turni, pulizia del repo) e i programmi di `.programmi/` si riallineano nelle sessioni che li possiedono; `db/scripts/rtl-allinea/LEGGIMI.md` va riallineato da chi può misurare in produzione se J3-J6 sono applicati, perché `applica.sh` oggi elenca solo `J_testi_italiano` e `J2_testi_residui`.

## 9. Nota sui dati di RTL Bank

Tutti i dati del tenant RTL Bank, persone comprese, sono inventati: RTL è un tenant dimostrativo trattato come reale solo per sviluppo e prova (chiarimento di Enzo del 2026-11-25). I file che li contengono si trattano come ogni altro documento, secondo il loro verdetto, senza nessuna priorità o cautela per la riservatezza.

## 10. Regola dei rimandi storici (2026-11-25)

Un documento superato esce anche se lo citano solo archivi (`docs/archive/`), migrazioni già applicate, `docs/kb/COWORK_INBOX.md`, `qa_artifacts/`, `cowork_reserved/` o `docs/source_bundle/extracted_bootstrap/`: quella citazione è storia, non uso, e il file resta recuperabile dal registro dei ritiri (commit e copia nel cestino). Lo trattengono ancora un documento vivo, un sorgente o un workflow. Scelta del coordinatore sul metodo approvato da Enzo; la applica `docs/kb/tools/mappa_rimandi.py` (classi `storico` e `migrazione`, che non trattengono). Con la regola i documenti liberi passano da 611 a 777 su 1.009 (`python3 docs/kb/tools/mappa_rimandi.py --censimento docs/piani/riordino-documentazione_20261125/CENSIMENTO_advanced.tsv --out <tsv>`).

## 11. Avanzamento al 2026-11-25, sera

| voce | stato | prova |
|---|---|---|
| R1 | fatta | decisioni D1-D4 di Enzo nel thread |
| R2 | fatta | `docs/kb/tools/mappa_rimandi.py`, regola dei rimandi storici (sezione 10) |
| R3 | fatta | rules, skill e README corretti (PR #485, #486); `build_index.py` senza percorsi Windows e indice rigenerato; la libreria cross-OS si carica da `db/scripts/_lib/`; `db-export.zip` uscito (D3). Le voci `cowork_code_exchange` di `.gitattributes`, `.gitignore` e dei `paths-ignore` restano finché la cartella resta (vedi R5) |
| R4 | fatta | `check_documenti.py --selftest` rosso (1, 9) senza la regola e verde (1, 8) con; in CI con `state-lint` |
| R5 | in parte | 546 percorsi ritirati in advanced (A4, campioni, lotto B, D3) e 84 nel datastore (lotto D), registri con commit di recupero su `main`; 125 file del progetto nel cestino (lotto PF, registro nel cestino). Restano i «da accorpare» e i 26 file di `cowork_code_exchange/`, trattenuti dai rimandi di `docs/vision/` (sessione dedicata), di ADR-0017 e di `sessioni/` |
| R6 | fatta per i dati TJB-RTL e i ruoli chiave | 25 file in `_da_eliminare/` del progetto |
| R7 | in parte | 59 documenti riallineati nella PR #486; i piani e i programmi restano alle loro sessioni (sezione 8) |
| R8 | fatta | `.handoff/STATE.md`, `SOT_*`, `DEBT_REGISTER.md`, cruscotti dei due repo (PR #485, datastore #43) |
| R9 | fatta | `build_adr_index.py --check` verde |
| R10 | in parte | quindici pagine di dominio in `docs/wiki/domini/`; l'accorpamento dei «da accorpare» resta |
| R11 | fatta | `build_wiki.py --check` verde in `state-lint` |
| R12 | in parte | A1-A5 e A9 in CI; A10 (`scripts/lint-verita.sh`) provato in cloud con un agente finto, da installare sulla VM |
| R13 | fatta | sezione «Documentazione» in `CLAUDE.md` di advanced (PR #485) e sottosezione del datastore (PR #44) |
| R14 | da fare | solo con il sì di Enzo |
