# Agente di consolidamento del tenant — disegno tecnico

Versione 1 del 2026-10-30, APPROVATA da Enzo il 2026-10-30 alle 20:53 UTC (21:53 ora di Roma), con le cinque raccomandazioni del §10. Attua la specifica confermata da Enzo il 2026-10-30 alle 19:33 UTC (20:33 ora di Roma), copiata accanto a questo file in `00_SPECIFICA.md`. Il piano di lavoro che ne discende è `06_PIANO.md`. Ogni affermazione sullo stato del codice porta il file da cui viene; ciò che non ho potuto misurare in questa sessione è scritto come tale.

## 1. In parole semplici

1. Il lavoro si divide in tre pezzi già noti ad advanced: un motore nell'API che tiene il conto di tutto, un «giudice» nell'agente che legge due elenchi di voci e dice quali parlano della stessa cosa, e le pagine del Direttore HR dove una persona conferma.
2. Il giudice non ha strumenti: riceve testo e restituisce proposte. Non può leggere né scrivere niente da solo, quindi la regola «l'agente propone, advanced applica» vale per costruzione e non per disciplina.
3. Tutto ciò che si propone e si decide resta in un registro nel database di advanced, che dura giorni e settimane; il ponte di approvazione di oggi, che aspetta due minuti in memoria, non basta per decisioni di questo tipo.
4. Il prototipo approvato non si tocca: l'agente lavora su una copia per quel tenant, dove sostituisce i nomi del prototipo con quelli del tenant giro dopo giro.
5. Il datastore non entra in questo lavoro: consegna il prototipo e basta. Il gradino 3 della pagina dei vuoti, che voleva una tabella delle corrispondenze nel datastore, si ritira (§9).

## 2. Che cosa c'è già, misurato in questa sessione

| pezzo | dove | che cosa serve al consolidamento | limite misurato |
|---|---|---|---|
| Agente di advanced | `apps/agent-gateway/src/` (14 sorgenti, `ls apps/agent-gateway/src`) | il processo che parla con il modello sull'abbonamento (`subscription-auth.ts`) | non è in servizio sulla VM: il README dice «Distribuito — no», si accende a mano (`apps/agent-gateway/README.md`, sezione Status) |
| Proposta senza strumenti | `apps/agent-gateway/src/research-propose.ts`, rotta `POST /research/propose` in `server.ts:141` | lo schema da copiare: il motore vive nell'API, il gateway fa solo il passo del modello, senza strumenti, con un segreto condiviso | nessuno per il nostro uso |
| Cancello di scrittura | `apps/agent-gateway/src/write-gate.ts` | ogni scrittura dell'agente conversazionale passa da una persona | non serve qui: il giudice non scrive |
| Ponte di approvazione | `apps/agent-gateway/src/approval-bridge.ts` | — | in memoria, scade dopo 120 secondi: inadatto a decisioni che durano giorni |
| Deleghe | modulo `apps/api/src/modules/delegations/`, tabella in `db/migrations/000314_deleghe.sql` | conferire e revocare una delega, con la storia leggibile (nessuna PATCH) | l'ambito è solo `APPROVALS` o `FULL` (`000314:45`): manca la delega limitata a gruppi di dati |
| Registro dell'origine | `sys.sys_generated_record_origins`, `db/migrations/000319_registro_origine_righe_generate.sql` | dice da quale versione del modello nasce una riga del tenant | stati `GENERATED`, `CONFIRMED`, `SUPERSEDED`: manca «collegata a una voce che il tenant aveva già» |
| Personalizzazioni | ADR-0048, incremento C6 di `03_PIANO.md` (da fare) | ereditata, conservata, propria; origine e impronta per voce | C6 non è ancora nel codice |
| Strada unica di materializzazione | incremento C5 di `03_PIANO.md` (da fare) | l'adozione di una lacuna deve passare di lì | C5 non è ancora nel codice |
| Ricevimento e versione fissata | `000460` (registro dei ricevimenti), `000463` (versione sull'attivazione) | sapere con quale versione del prototipo si confronta il tenant | in produzione dal 2026-10-30 secondo la memoria del progetto; non l'ho rimisurato qui |
| Ricerca per somiglianza | modulo `semantic-matching`, pgvector (`000060`, `000062`) | — | gli embedding usano Voyage, la cui chiave sulla VM non c'è (`docs/kb/SOT_STATE.md:3461`): usarla sarebbe una spesa e una chiave nuova |
| Somiglianza fra testi | estensione `pg_trgm` (`db/migrations/000001_init_extensions.sql`) | trovare i candidati prima di chiedere al modello | nessuno |
| Pagina dell'agente | `apps/web/src/app/(authenticated)/dev/agent/page.tsx` | — | solo sviluppo, dietro `NEXT_PUBLIC_ENABLE_AGENT_DEV` |

## 3. L'architettura: tre pezzi

**Il motore**, nell'API: un modulo nuovo `apps/api/src/modules/tenant-consolidation/`, con il pattern dei sette passi del progetto (`.claude/rules/api-module-pattern.md`). Apre una sessione di consolidamento per un tenant e una versione del prototipo, prepara la copia di lavoro, fa la passata per chiavi, sceglie i candidati con `pg_trgm`, chiama il giudice a lotti, decide quali equipollenze adottare nella copia, conta i giri, scrive proposte e decisioni, applica ciò che è confermato. È puro dove può esserlo: il giudice gli arriva come parametro, così le prove girano con un doppio, come per la ricerca.

**Il giudice**, nell'agente di advanced: una rotta nuova `POST /consolidation/propose` in `apps/agent-gateway/src/server.ts`, con un file `consolidation-propose.ts` fatto come `research-propose.ts`: nessuno strumento (`allowedTools: []`), nessun server MCP, segreto condiviso con l'API, risposta solo JSON convalidata da uno schema Zod. Riceve un lotto: per ogni voce del tenant ancora libera, i suoi candidati del prototipo, con il contesto strutturale (unità madre già abbinata, livello, attività del processo, indirizzo ESCO). Restituisce coppie con cardinalità (uno a uno, uno a molti, molti a uno), motivo in italiano e fiducia da 0 a 100. È questo che la specifica chiama «una nuova capacità dell'agente che advanced ha già» (§3): stesso processo, stessa autenticazione ad abbonamento, stesso diario.

**Le pagine**, nell'SPA di amministrazione, nell'area del Direttore HR (§8).

Perché così e non con l'agente conversazionale che usa gli strumenti MCP: lo stato di un consolidamento dura giorni e deve stare nel database; un agente che decide da sé quali strumenti chiamare dovrebbe scrivere nel registro, e ogni sua scrittura chiederebbe un'approvazione di due minuti; il giudice senza strumenti non può né leggere oltre ciò che gli si dà né scrivere, quindi R-4 e R-5 della specifica valgono per costruzione. L'agente conversazionale resta utile in un secondo tempo: il Direttore potrà chiedergli «che cosa resta da decidere sulle competenze?», e lui leggerà il registro con le letture della persona (ADR-0040 R1). È la voce AC-15 del piano.

## 4. I dati

Una migrazione additiva nuova (numero prenotato `000464` in `00_INDICE.md`), con `varchar + CHECK` e `date`/`timestamptz` secondo RD-08 e RD-09, tutte le tabelle in `sys.` con il tenant in chiave esterna (I3/I4, I5). I nomi delle colonne seguono la convenzione del progetto (prefisso della tabella al singolare).

| tabella | una riga è | colonne che contano |
|---|---|---|
| `sys_tenant_consolidations` | una sessione di consolidamento | tenant; versione del prototipo (`sys_tenant_blueprint_versions` o la versione di variante fissata dall'attivazione, da decidere in AC-0); motivo (`RILASCIO`, `VERSIONE_NUOVA`, `RICHIESTA`); stato (`GIRI`, `IN_CONFERMA`, `APPLICATA`, `CHIUSA`); gruppo aperto; chi l'ha avviata e quando |
| `sys_tenant_consolidation_rounds` | un giro di un gruppo | sessione; gruppo; numero del giro; equipollenze adottate nel giro; token spesi; esito. La regola di arresto (R-14) si legge da qui: un giro con zero adozioni nuove chiude i giri del gruppo |
| `sys_tenant_consolidation_working_items` | una voce della copia di lavoro del prototipo | sessione; gruppo; chiave stabile della voce nel prototipo; nome e codice originali (non cambiano mai, R-13 terza cautela); nome tradotto; giro e proposta che l'hanno tradotta |
| `sys_tenant_consolidation_proposals` | una proposta dell'agente | sessione; gruppo; voci del prototipo e voci del tenant coinvolte (due elenchi, per la cardinalità); esito proposto (`CORRISPONDENZA`, `LACUNA`, `PERSONALIZZAZIONE`); metodo (`CHIAVE`, `VOCABOLARIO`, `SEMANTICA`); fiducia; motivo; giro; adottata nella copia sì o no; proposte da cui dipende |
| `sys_tenant_consolidation_decisions` | una decisione di una persona | proposta; decisione (`CONFERMATA`, `RIFIUTATA`, `ADOTTATA`, `NON_ADOTTATA`, `PERSONALIZZAZIONE`); forma (`NORMALIZZATA` predefinita, `FORMA_TENANT`, `NOME_PROTOTIPO` su richiesta, R-12); stato ADR-0048 che ne risulta (`EREDITATA`, `CONSERVATA`, `PROPRIA`); chi, quando, con quale delega, su quale versione, con quale motivo. Non si aggiorna mai: una revisione del Direttore è una riga nuova che sostituisce la precedente, come per le deleghe |
| `sys_platform_vocabulary_equivalences` | un'equivalenza di vocabolario comune | gruppo; termine del tenant; termine del prototipo; stato (`PROPOSTA`, `APPROVATA`, `RITIRATA`); chi l'ha approvata. È di piattaforma: nessun tenant, nessun riferimento a righe di un tenant (R-7) |

Le deleghe per gruppo si fanno estendendo quella che c'è, non con una tabella nuova: un ambito `CONSOLIDATION` in più e una colonna con i gruppi ammessi. Il CHECK sta nella `000314`, che si riapplica a ogni deploy: secondo ADR-0035 si emenda il file che lo crea e una migrazione nuova (`000465`) cambia l'esemplare esistente.

Il legame finale fra una voce del tenant e la voce del prototipo si scrive dove advanced già lo cerca: nel registro dell'origine (`sys_generated_record_origins`, con uno stato in più `LINKED` per una riga che il tenant aveva già) e nell'origine di C6 (versione e impronta). Così, all'arrivo di una versione nuova, ADR-0048 sa da sé che cosa è ereditato e che cosa è conservato, e non serve una seconda verità.

I gruppi e le tabelle del tenant che toccano, da confermare in AC-0 con lo schema vero:

| gruppo (ordine fisso, R-6) | tabelle del tenant | chiavi comuni note |
|---|---|---|
| 1 organizzazione | `sys_organization_units`, livelli gerarchici | tipo di unità dopo il vocabolario comune; livello |
| 2 posizioni e ruoli | `sys_positions`, `sys_job_roles` | occupazione ESCO del ruolo; livello (IMPIEGATO, QUADRO, DIRIGENTE coincidono già, misura del 2026-10-30) |
| 3 competenze | `sys_skills` e i legami con ruoli e posizioni | indirizzo ESCO (12 in comune su 443 e 61, misura del 2026-10-30) |
| 4 processi | processi delle unità (`sys_organization_unit_processes`), attività (ADR-0049, `000462`) | nessuna: 0 nomi uguali su 30 e 23 |
| 5 indicatori e obiettivi | `sys_kpi_definitions`, modelli di KPI di unità e processo, `sys_goals`, `sys_okrs` | nessuna nota |

## 5. Il percorso di un gruppo

1. **Il giro zero, per chiavi.** Si abbinano le voci che hanno una chiave comune (indirizzo ESCO, livello, tipo di unità tradotto dal vocabolario comune approvato). Escono proposte con metodo `CHIAVE` e fiducia alta; sono quelle che la pagina mostrerà raggruppate per un solo gesto (R-5).
2. **I giri semantici.** Per ogni voce del tenant ancora libera il motore sceglie fino a otto candidati del prototipo con la somiglianza dei nomi (`pg_trgm`, sui nomi già tradotti della copia) e con il contesto (stessa unità madre, stesso livello). Il giudice riceve i lotti e risponde. Il motore adotta nella copia le equipollenze che superano la soglia «sicura» e non entrano in conflitto con un'altra (una voce, una sola proposta sicura): ne scrive il nome tradotto, il giro e la proposta. Le altre restano proposte in attesa.
3. **L'arresto.** Si ripete finché un giro non adotta niente di nuovo (R-14). Un fusibile tecnico ferma comunque al dodicesimo giro e lo segnala come anomalia: non è la regola, è la protezione contro un ciclo che non converge.
4. **Gli esiti mancanti.** Una voce del prototipo rimasta libera diventa una proposta di lacuna; una voce del tenant rimasta libera diventa una proposta di personalizzazione.
5. **La conferma.** La sessione passa a `IN_CONFERMA` per quel gruppo. Tutte le equipollenze, anche quelle adottate dall'agente nella copia, aspettano il Direttore o un delegato (R-15).
6. **Il rifiuto.** Se una persona rifiuta un'equipollenza adottata, il motore toglie dalla copia la sua traduzione, invalida le proposte che dipendevano da lei e rifà i giri del gruppo da lì (proposta confermata in §4bis della specifica). I gruppi successivi non sono ancora aperti, quindi il rifacimento resta dentro un gruppo.
7. **Il gruppo dopo.** Si apre quando nel precedente non resta niente di incerto da decidere (§9 della specifica), così una posizione si abbina conoscendo già la sua unità.

La soglia «sicura» parte da 90 su 100 come valore iniziale e si ritara sulla prima prova vera con RTL Bank; come per le soglie di ADR-0040, accanto al numero si scrive il criterio che lo genera (la fiducia sotto la quale, nella prima prova, una persona ha rifiutato almeno un'equipollenza adottata).

## 6. L'applicazione delle decisioni

Le scritture nei dati del tenant le fa l'API con i servizi che già esistono, mai il giudice, e solo dopo una decisione (R-4):

| decisione | che cosa cambia nel tenant | stato ADR-0048 |
|---|---|---|
| corrispondenza normalizzata (predefinita) | nome e codice del tenant restano; dal prototipo arrivano i campi che il tenant non ha (descrizione, legami, riferimenti ai cataloghi); riga `LINKED` nel registro dell'origine | ereditata, salvo nome e codice, che nessuna versione nuova sovrascrive |
| corrispondenza tenuta nella forma del tenant | solo il collegamento; il tenant non riceve niente | conservata: una differenza futura del prototipo si segnala |
| corrispondenza con il nome del prototipo (su richiesta, voce per voce) | anche nome e codice prendono la forma del prototipo | ereditata |
| lacuna adottata | la voce si crea dalla strada unica di materializzazione (C5) | ereditata |
| lacuna rifiutata | niente; il rifiuto resta nel registro e l'agente non la ripropone | — |
| personalizzazione | niente sui dati; la voce è marcata propria | propria |

La specifica (§5) chiede che una voce ereditata si aggiorni con le versioni nuove ma che il suo nome e il suo codice, se sono del tenant, non vengano mai sovrascritti. ADR-0048 oggi ragiona per voce intera; serve quindi che C6 registri l'origine anche per campo, almeno per nome e codice. È una dipendenza scritta nel piano (AC-2), non una decisione nuova.

Ogni applicazione è una scrittura di massa e segue la regola del progetto: misura prima, guardia che ricontrolla la decisione al momento di applicarla, post-condizione su ciò che non doveva cambiare, giornale di ritorno in `staging.tenant_consolidation_undo` con i valori di prima. Non si cancella niente: una voce rifiutata resta, marcata.

Guardie che il motore controlla prima di mandare qualsiasi cosa al giudice o di applicare:

- solo i cinque gruppi strutturali; nessuna tabella di persone, contratti, valutazioni, retribuzioni (specifica §7);
- un elenco chiuso di colonne inviate al modello (nome, codice, descrizione, tipo, padre, livello, indirizzo ESCO, attività), mai un identificativo di persona; la prova cerca nel lotto i nomi che finiscono in `UserId`, lo stesso criterio di `persone-distinte.ts`;
- le righe importate (ADR-0045, classe I23 «importata») si leggono per abbinare ma non si modificano;
- il tenant viene dalla sessione autenticata, mai dal corpo della richiesta (I5).

## 7. Chi può fare che cosa

Permessi nuovi, con la stessa migrazione `000465` delle deleghe: `consolidation:read` (vedere avanzamento e registro), `consolidation:run` (avviare una sessione o un giro), `consolidation:decide` (confermare, rifiutare, adottare), `vocabulary:approve` (approvare un'equivalenza comune).

| chi | permessi |
|---|---|
| `HRMS_MANAGER` del tenant | read, run, decide su tutti i gruppi; vede e può rivedere ogni decisione dei delegati |
| delegato del Direttore | decide e read solo sui gruppi della sua delega `CONSOLIDATION`; la delega è registrata e revocabile con le rotte che esistono |
| `TENANT_ADMIN` | read |
| `PLATFORM_ADMIN` | read su tutti i tenant per la manutenzione; `vocabulary:approve`; nessun decide sui dati di un tenant cliente |

Per RTL Bank, finché non c'è un Direttore HR reale, conferma Enzo (specifica §6): serve un'utenza di RTL Bank con `HRMS_MANAGER` che usa lui. Esiste già o va creata: lo misuro in AC-0.

## 8. Le pagine

Sotto `apps/web/src/app/(authenticated)/consolidamento/`, solo con i componenti di `@heuresys/ui`, testi in it e en, dati sempre da `/v1/*` (nessun dato finto):

- **Avanzamento** (`/consolidamento`): per ogni gruppo quante voci collegate, adottate, rifiutate, personalizzate, da decidere; il gruppo aperto; un tenant consolidato quando tutto è deciso (R-8).
- **Gruppo** (`/consolidamento/[sessione]/[gruppo]`): in alto gli abbinamenti certi raggruppati con un solo gesto di conferma; poi gli incerti uno per uno, con i due nomi, il motivo e la fiducia; poi le lacune da adottare o rifiutare; poi le personalizzazioni. Per ogni corrispondenza tre scelte: normalizzata (predefinita), tenuta nella forma del tenant, con il nome del prototipo.
- **Registro** (`/consolidamento/registro`): chi ha deciso che cosa, quando, con quale delega; il Direttore rivede e cambia una decisione di un delegato.
- **Vocabolario comune** (`/admin/vocabolario-comune`), solo piattaforma: le equivalenze proposte dalle sessioni e quelle approvate.

## 9. Il gradino 3 della pagina dei vuoti, ripensato

Il gradino 3 della proposta del 2026-10-30 (`20261030_PROPOSTA_CONFRONTO_VIVO_VUOTI_RTL.md`) voleva che il modello abbinasse per significato processi, unità e posizioni fra la corsa della banca regionale e RTL Bank, e che il risultato restasse in una tabella delle corrispondenze nel datastore. Con la specifica confermata quel gradino non si fa: le corrispondenze di un tenant sono una sua decisione, vivono in advanced e il datastore non le tiene né le calcola (§3 della specifica). I gradini 1 e 2 restano come sono, nel codice dal 2026-10-30 (PR datastore #17 e #18).

La pagina dei vuoti resta lo strumento di Enzo per controllare la qualità del prototipo. Quando i consolidamenti esisteranno, la domanda giusta per quella pagina sarà «che cosa i tenant hanno dovuto tenere come personalizzazione, e quali lacune hanno rifiutato», perché è lì che il prototipo si mostra incompleto o sbagliato. Quel ritorno arriva per la strada del flusso inverso già deciso (C8, ADR-0047 punto 6): una proiezione con un elenco chiuso di colonne, solo conteggi per gruppo e nomi di voci strutturali, nessun dato di persona, prodotta da advanced e letta dal datastore. È la voce AC-14 del piano, dopo la prima prova vera.

Un fatto da tenere presente, misurato in questa sessione: oggi la pagina dei vuoti legge RTL Bank dalla produzione di advanced attraverso il servizio 3104 (`apps/api/src/rtl_lettura.ts` del datastore, toccato dalla PR #17). È una lettura diretta del database di advanced, che ADR-0047 punto 6 e C8 hanno già deciso di ritirare. Non la cambia questo disegno; la segnalo perché il ritorno di AC-14 la renderà superflua.

## 10. Le decisioni di Enzo

Decise il 2026-10-30 alle 20:53 UTC: Enzo ha scelto «Sì, tutte e cinque» sulla scheda di decisione del thread «Progettare l'agente di consolidamento in advanced». Valgono quindi le cinque raccomandazioni qui sotto. La voce 3 (agente in servizio sulla VM) resta legata a AC-12: il suo via sulla produzione si chiede con una frase scritta quando AC-12 è pronta.

1. **L'architettura a tre pezzi del §3**, con il giudice senza strumenti. Raccomandazione: sì; è lo schema già in uso per la ricerca, e rende impossibile una scrittura del modello.
2. **Niente Voyage per ora**: candidati con `pg_trgm` e giudizio del modello sull'abbonamento. Raccomandazione: sì; costo zero, nessuna chiave nuova; gli embedding si riconsiderano solo se la prima prova mostra che i candidati per nome mancano corrispondenze.
3. **L'agente di advanced in servizio sulla VM**, come unità di systemd accanto all'API, sull'abbonamento. È un cambiamento della produzione e richiede che la sessione di `claude` sulla VM sia autenticata (il README misurava il 2026-09-12 una sessione scaduta). Raccomandazione: sì, ma solo alla voce AC-12, con backup e ritorno provati come da delega.
4. **La delega per gruppi come estensione delle deleghe esistenti** (§4). Raccomandazione: sì; una tabella sola per tutte le deleghe, storia già leggibile.
5. **Il gradino 3 ritirato** e sostituito dal ritorno aggregato del §9. Raccomandazione: sì.

## 11. Rischi

| rischio | effetto | che cosa lo ferma |
|---|---|---|
| un'equipollenza sicura sbagliata si trascina nei giri | abbinamenti sbagliati a catena | dipendenze registrate e rifacimento dei giri al rifiuto; soglia ritarata sulla prima prova |
| i giri non convergono | consumo del modello senza fine | arresto a zero adozioni, fusibile al dodicesimo giro, token per giro nel registro |
| un dato di persona finisce nel lotto del modello | violazione della specifica §7 | elenco chiuso di colonne e prova sui nomi `*UserId` |
| il consumo dell'abbonamento di Enzo | finestra delle cinque ore esaurita durante un consolidamento grande | lotti a dimensione fissa e misura dei token per giro; il passaggio a un modello pagato lo decide Enzo al primo cliente vero (specifica §10) |
| C5 e C6 non ancora nel codice | l'adozione di una lacuna e lo stato ADR-0048 non hanno dove scrivere | sono prerequisiti dichiarati nel piano (AC-2) |

## 12. Che cosa non è in questo disegno

Il passaggio a un modello pagato per cliente (decisione di Enzo al primo cliente vero). La consegna e il ricevimento del prototipo, che sono già del programma (C2, C3). L'interfaccia conversazionale sul registro, rimandata ad AC-15. I dati delle persone, che la specifica esclude.
