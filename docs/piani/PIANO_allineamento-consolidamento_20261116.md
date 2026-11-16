# Piano a tappe: Allineamento e Consolidamento del tenant rispetto al modello

Data: 2026-11-16. Nasce dall'analisi `consolidamento/20261116_ANALISI_METODO_CONSOLIDAMENTO_MODELLO_TENANT.md` e dalle scelte di Enzo registrate lì (D1-D7, F1-F7, G1-G3, H1-H3, J1-J3, principio delle decisioni non ripetute del §15). Copiato in heuresys-advanced il 2026-11-16 dal thread che esegue la tappa A, e aggiornato qui voce per voce.

Criterio di «fatta», per ogni voce (regola di Enzo del 15/11): una misura dal vivo e la prova del risultato, cioè comando, query, URL o schermata, con il valore osservato e l'orario. Un test verde da solo vuol dire «in corso». Per una pagina la prova è un login con una persona vera del tenant nel suo profilo (per RTL il Direttore HR), su copia o in produzione come dice la voce.

Regola d'interfaccia nuova e permanente (Enzo, 2026-11-16 01:13 UTC, messaggio cmsg_01FMWxNibmDwSNyptL3ETuJqKp2Qv9eeJEzDdP1wQT96i4): ogni lavoro in corso che blocca fino alla sua conclusione mostra un'animazione evidente e, quando si può misurare l'avanzamento, una barra di avanzamento moderna e professionale. Vale per tutta la piattaforma, non solo per il consolidamento (voce A3).

Che cosa non si chiude in questo thread: tutto il piano. Questo thread ha fatto l'analisi e scrive il piano; l'esecuzione va a thread nuovi, uno per tappa o per gruppo di voci, con il modello minimo adatto (indicato nella colonna «chi»).

Fuori da questo ciclo, da riproporre una volta alla fine: le segnalazioni dal tenant al datastore (J3, AC-14); la delega del Direttore HR per gruppi di dati (R-10 della specifica del 30/10); il passaggio di una regola ad altri tenant come equivalenza di piattaforma (G2, possibile solo dopo un secondo tenant).

## Tappa A — Fondamenta

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| A1 | ADR dei due modi, Allineamento e Consolidamento: definizioni del §12, garanzie di integrità e di ricchezza, eccezioni con motivo (H3), decisione come regola (§15, G1, G2), ruoli (G3: Enzo sceglie quali tenant sono in Allineamento), precisazione di ADR-0048 e della specifica del 30/10 per i tenant in Allineamento | Claude scrive (Opus), Enzo accetta | ADR in `docs/architecture/adr/` con stato ACCETTATO e il sì di Enzo citato | fatta: `docs/architecture/adr/0059_allineamento_e_consolidamento_due_modi.md` ACCETTATO da Enzo il 2026-11-16 alle 01:35 UTC, sì citato nell’ADR |
| A2 | La misura della distanza: per un tenant e una versione di modello, uguali, parziali, diversi, solo nel modello, solo nel tenant, per ciascuno dei 24 domini del confronto dell'11/11; rotta in sola lettura e comando; la «ricchezza persa» come misura a parte | Claude (Sonnet) | su RTL contro la corsa `p20261010010521tjb` ridà i numeri di `confronto-corsa-rtl/dati_20261111/riepilogo.json` o spiega ogni differenza con una query | fatta: `pnpm --filter @heuresys/api consolidation:distance -- --tenant RTL_BANK --run p20261010010521tjb` e `GET /v1/consolidation-runs/:runId/distance`; misura dal vivo in produzione il 2026-11-16 01:50:40 UTC (2.167 righe, 508 uguali, 310 parziali, 81 diverse, 918 solo nel modello, 350 solo in RTL, ricchezza persa 16); ogni differenza dall'11/11 spiegata con le query in `docs/piani/allineamento-consolidamento/A2_distanza_RTL_20261116.md` |
| A3 | Regola dell'animazione e della barra di avanzamento: file in `.claude/rules/`, componente in `@heuresys/ui` se non c'è, censimento delle attese bloccanti già presenti | Claude (Sonnet) | regola nel repo; elenco delle pagine con un'attesa bloccante, ciascuna con la schermata dell'animazione | in corso: regola `.claude/rules/attese-bloccanti.md`; `@heuresys/ui` 1.5.0 pubblicata il 2026-11-16 (ux-design-shared PR 14); barra globale in `AppProviders` e riquadro `LavoroInCorso` nelle 6 pagine a lavoro lungo; censimento `python docs/kb/tools/censimento_attese.py --check` verde (42 pagine con un'attesa, 6 a lavoro lungo, 6 con il riquadro) e in CI; mancano le schermate dal vivo dopo il rilascio |

## Tappa B — Il bersaglio

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| B1 | Il bersaglio composto in advanced (D5): la corsa per tutto ciò che porta, ruoli e cruscotti dal modello attivo v1; costruito con `tenant-materialization/build-plan.ts` come piano, senza scrivere nel tenant | Claude (Opus) | il piano del bersaglio di RTL elenca righe per tabella con la ragione; nessuna riga viva cambiata (impronta prima e dopo) | da fare |
| B2 | Il contesto dell'agente (H1): per ogni voce evidenze, principi, decisioni e lacune del modello (`sys_blueprint_content_evidence`, `_design_principles`, `_decisions`, `_gaps`), dati del tenant nel perimetro di chi decide, ricerca web mirata nei casi dubbi; ogni raccomandazione cita la fonte | Claude (Opus) | su copia, un campione dichiarato di raccomandazioni porta la fonte; la misura dice quante su quante | da fare |

## Tappa C — Riconoscere e trasformare

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| C1 | Un agente solo (D6): l'interprete della PR 217 entra nel giudice del consolidamento, aggiornato su main, con i tipi di operazione rinomina, sposta, accorpa, dividi, crea, aggiorna, ritira, ricolloca, tieni come eccezione; parametro della fonte di verità secondo il modo | Claude (Opus) | PR unita con CI verde; giro su copia di RTL che produce operazioni di tutti i tipi pertinenti, con il conteggio per tipo | da fare |
| C2 | Candidati semantici: preselezione con le rappresentazioni esistenti (`sys_skill_embeddings`, `sys_job_role_embeddings`, `sys_esco_occupation_embeddings`) oltre ai trigrammi; contesto strutturale come prova | Claude (Opus) | su copia, quante corrispondenze in più rispetto ai soli trigrammi, sugli stessi dati | da fare |
| C3 | Nodi e legami sugli otto domini della prima tappa (D4): unità e organigramma, posizioni e ruoli, inquadramento, competenze per posizione, processi con fasi e unità, obiettivi e indicatori, criticità, persone | Claude (Opus) | la misura A2 su copia, dopo l'applicazione, dà zero differenze sugli otto domini salvo eccezioni elencate | da fare |
| C4 | Garanzia di ricchezza: per ogni voce tenuta si innestano gli attributi e i legami del modello che il tenant non ha; un valore del tenant non si tocca | Claude (Sonnet) | «ricchezza persa» uguale a zero su copia | da fare |

## Tappa D — Le decisioni non si ripetono

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| D1 | Decisione come regola (§15): l'agente scrive la regola in parole; analoghi diretti estesi da soli, indiretti (cascata, causa comune, coerenza) raggruppati con un gesto per gruppo (G1) | Claude (Opus) | su copia, il rapporto decisioni prese a mano su segnalazioni chiuse, misurato; prova che una decisione ne chiude più di una | da fare |
| D2 | Conflitti e revoca: la scelta esplicita vince sulla regola; cambiare la decisione d'origine rifà le estensioni | Claude (Sonnet) | prove d'integrazione rosse prima e verdi dopo; dimostrazione su copia | da fare |
| D3 | Persistenza: una regola vale per il tenant e per le corse future (G2) | Claude (Sonnet) | su copia, una seconda corsa con differenze coperte da regole le decide da sole; conteggio | da fare |

## Tappa E — Piano ordinato, prova, operazioni sicure

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| E1 | Ordinamento per dipendenze: chiavi esterne, contenuto del modello (`cascata.ts` generalizzata), chi sorveglia l'oggetto (`docs/kb/tools/chi_sorveglia.py`); un'operazione con una dipendenza non aggiornabile non è sicura e lo dice | Claude (Opus) | il piano di RTL non ha un'operazione prima del suo prerequisito (controllo automatico); elenco delle non sicure con il motivo | da fare |
| E2 | Prova automatica su copia prima del pulsante rosso: catena delle migrazioni riapplicata, sentinelle prima e dopo, prove d'integrazione dell'API, giro E2E delle pagine toccate | Claude (Opus) | un piano sporcato apposta viene fermato (rosso visto), quello pulito passa (verde visto) | da fare |
| E3 | Operazioni sicure che passano da sole nella bozza, con le quattro condizioni del §12 | Claude (Sonnet) | su copia, conteggio delle sicure passate da sole e di quelle trattenute con il motivo | da fare |

## Tappa F — Le persone

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| F1 | Ricollocazione degli incarichi (D3): proposta dell'agente per unità, ruolo, livello, competenze e criticità; applicazione con `approvals/effects/position-assignment.ts`; anagrafica e utenze ferme; niente demansionamento; aumenti di livello segnalati a Enzo | Claude (Opus) | su copia, ogni persona di RTL ha un posto nel bersaglio o un'eccezione; impronta di anagrafiche e utenze identica prima e dopo; sentinella degli incarichi primari a zero | da fare |
| F2 | Vista persona per persona, non vincolante (F4) | Claude (Sonnet) | login del Direttore HR su copia, schermata con il perché di una proposta e la modifica di una proposta | da fare |

## Tappa G — L'interfaccia

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| G1 | Due viste (F2): elenco delle operazioni e organigrammi affiancati, com'è e come sarà, con i cambiamenti evidenziati | Claude (Sonnet) | login del Direttore HR, schermate delle due viste sugli stessi dati | da fare |
| G2 | Filtri e raggruppamenti per azioni omologhe, estensione di quelli della PR 268 a tipo di operazione, dominio e unità | Claude (Sonnet) | un gruppo approvato con un gesto; conteggio delle operazioni toccate | da fare |
| G3 | Giro in sottofondo (J1) con avanzamento per dominio, animazione e barra (A3), avviso nelle notifiche alla fine (`sys_inbox_notifications`) accompagnato da un segnale sonoro nel browser essenziale e discreto (Enzo, 2026-11-16 01:15 UTC, messaggio cmsg_01FMWxNibmDwSNyptL3ETuJqTFALSqEHqT4vWntv7zGRHA), che si può disattivare e rispetta le preferenze del browser | Claude (Sonnet) | giro reale su copia: schermate della barra in corso e dell'avviso arrivato, suono udito alla fine (prova nel browser), tempo misurato | da fare |
| G4 | Navigazione di RTL «come sarà» su copia, non vincolante (F5) | Claude (Sonnet) | le pagine normali aperte sulla copia dopo il piano, schermata di un organigramma | da fare |
| G5 | Pulsante «Annulla l'ultimo allineamento» (F6), con anteprima, conferma e rapporto di ciò che non si è potuto rimettere | Claude (Sonnet) | su copia: approvazione, annullamento, misura A2 tornata ai valori di prima | da fare |
| G6 | Storico degli esiti (J2): distanza prima e dopo per dominio, regole, eccezioni, chi ha approvato | Claude (Sonnet) | lo storico mostra l'allineamento provato in G5 | da fare |
| G7 | Il modo per tenant (G3): solo Enzo, dalla piattaforma, mette un tenant in Allineamento; il Direttore HR vede il modo ma non lo cambia | Claude (Sonnet) | prova d'integrazione dei permessi; RTL in Allineamento, Heuresys System in Consolidamento, letti dal vivo | da fare |

## Tappa H — RTL in produzione

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| H1 | Allineamento di RTL in produzione: backup verificato da meno di 24 ore, giro, approvazione del Direttore HR, misura dopo | Claude esegue (Sonnet), approva il Direttore HR di RTL | misura A2 in produzione: zero differenze sugli otto domini salvo eccezioni elencate; esito nel registro | da fare |
| H2 | La versione composta diventa il modello attivo di RTL | Claude (Sonnet) | lettura dal vivo dell'attivazione ACTIVE sulla nuova versione e profilo dei ruoli intatto | da fare |
| H3 | Corsa nuova che riparte da sola sulla sola differenza (F7) | Claude (Sonnet) | su copia, una corsa successiva accolta fa partire il giro da sé e propone solo ciò che le regole non coprono; conteggio | da fare |

## Simulazione delle voci che scrivono o rischiano

A2, B1, B2, C2: sola lettura; nessuna guardia di scrittura serve, ma B1 misura un'impronta prima e dopo per dimostrarlo.

C1, C3, C4, D1-D3, E1-E3, F1, G5: si provano solo su una copia aperta con `bash scripts/copia-prova.sh apri <nome> "<scopo>"` e un database usa-e-getta; mai su `heuresys_ci`, che può avere una corsa in volo. Ogni scrittura porta misura prima, guardia al momento dell'esecuzione, post-condizione su ciò che non doveva cambiare e giornale di ritorno (`staging.tenant_consolidation_undo`).

Migrazioni: ogni tabella nuova in `sys.*` va nell'allowlist di storia36 nella stessa PR (regola del progetto); prova di idempotenza sul gemello o sulla copia prima del push.

H1, H2: produzione; si eseguono con la delega permanente del 13/11 (script del repo, backup verificato prima con `bash ~/.claude/tools/backup-verificato.sh heuresys_advanced`, verifiche dal vivo dopo). Ritorno: il pulsante G5 e, come rete, il backup. Nessuna cancellazione: le voci fuori modello si ritirano.

Serve Enzo: l'accettazione dell'ADR (A1); le scelte sugli aumenti di livello segnalati in F1; l'approvazione in produzione del Direttore HR di RTL (H1), che oggi è Valentina Conti e richiede la sua seconda verifica d'accesso.

## Registro delle scoperte

Vuoto all'apertura. Ciò che emerge durante l'esecuzione si scrive qui e si propone a Enzo una volta, come «fuori da questo ciclo: lo vuoi nel prossimo?».

- S1 (2026-11-16, voce A2): `apps/api/src/modules/tenant-consolidation/sorgenti.ts` legge l'indirizzo ESCO delle competenze del modello dai metadati, vuoti per 443 competenze su 443, invece che dalla colonna `blueprint_content_skill_esco_uri`, piena per 443 su 443; lo stesso per `job_role_code` ed `esco_occupation_uri` delle posizioni (vuoti per 109 su 109). Il giro zero per chiave del consolidamento non abbina mai per ESCO. Query in `docs/piani/allineamento-consolidamento/A2_distanza_RTL_20261116.md`, sezione «Scoperta».

## Chiusura

Si legge da questo file: «CICLO CHIUSO — N/N voci fatte, non resta niente» oppure «CICLO NON CHIUSO — manca la voce K, serve Enzo per Y».
