# ADR-0057 — Allineamento e Consolidamento: due modi dello stesso motore

- **Status**: PROPOSTO il 2026-11-16, in attesa dell'accettazione di Enzo Spenuso
- **Date**: 2026-11-16
- **Redatto da**: Claude Code, thread «Heuresys PaaS/SaaS management», voce A1 del piano `docs/piani/PIANO_allineamento-consolidamento_20261116.md`
- **Richiesta**: Enzo Spenuso, decisione D1 del 2026-11-16 (messaggio delle 00:44 UTC, «ti dico sì a tutte») e approvazione del piano alle 01:16 UTC («Concordo sul piano»)
- **Poggia su**: l'analisi `consolidamento/20261116_ANALISI_METODO_CONSOLIDAMENTO_MODELLO_TENANT.md` nei file del progetto (§12 definizioni, §15 decisioni come regole, §16 H1-H3, §17 J1-J3; scelte D1-D7, F1-F7, G1-G3, H1-H3, J1-J3 di Enzo, tutte del 2026-11-16)
- **Precisa**: ADR-0048 (personalizzazioni del tenant) e la specifica dell'agente di consolidamento del 2026-10-30 (R-2, R-13, §5 «personalizzazione intoccabile», §7 «non tocca le persone», §9 «quando è finito»), solo per i tenant in Allineamento
- **Non tocca**: ADR-0035 (ritirare non è cancellare), ADR-0040 (l'agente legge ciò che legge la persona; ogni scrittura passa da un'approvazione umana), ADR-0042 (il cliente possiede), ADR-0045 (dati contrattuali importati), ADR-0046 (perimetro del tenant), ADR-0053 (quanto un agente scrive da solo), ADR-0056 (principi agentici), gli invarianti di `CLAUDE.md` (in particolare I1, I5, I15)

> **In parole semplici.**
> 1. Il motore che confronta il modello con un tenant ha due modi. In **Allineamento** vince il modello: il tenant viene portato a coincidere con lui. In **Consolidamento** vince il tenant: il modello gli si adatta.
> 2. I passi sono sempre gli stessi: bersaglio, riconoscimento, operazioni, piano ordinato, prova su una copia, approvazione, misura. Cambia solo chi vince quando le due parti dicono cose diverse.
> 3. In tutti e due i modi niente si rompe (si adotta una voce con tutto ciò che dipende da lei, provato prima su una copia) e niente si perde (si tiene una voce senza rinunciare a ciò che il modello sa di lei).
> 4. Una decisione presa una volta diventa una regola e chiude da sola le segnalazioni uguali: la stessa scelta non si chiede due volte.
> 5. Solo Enzo mette un tenant in Allineamento. Un tenant è in Consolidamento finché Enzo non lo cambia. RTL Bank sarà il primo tenant in Allineamento.

---

## §1 — Contesto

Il consolidamento in produzione dal 2026-11-15 (modulo `apps/api/src/modules/tenant-consolidation/`) implementa la specifica del 2026-10-30: il tenant tiene i suoi dati, il modello prende la nomenclatura del tenant (R-13), una personalizzazione non si tocca (§5), l'agente non tocca le persone (§7), il lavoro è finito quando ogni voce ha una decisione (§9). È l'obiettivo giusto per un cliente vero.

Per RTL Bank Enzo ha deciso il contrario: la corsa del modello è la fonte di verità nell'armonizzazione (2026-11-10, 16:06 ora di Roma), RTL è un tenant di prova in cui si cambia tutta la catena relazionale tenendo ferme solo anagrafica e utenze (regola del 2026-11-10), e il catalogo dei 21 processi è stato approvato lo stesso giorno. L'analisi del 2026-11-16 ha misurato che il motore di oggi, per come è disegnato, tocca 5 dei 24 domini del confronto dell'11/11 e di quei 5 risolve il nome ma non la struttura (§3 e §4 dell'analisi, limiti L1-L9).

Il 2026-11-16 Enzo ha scelto (D1) di non scrivere un secondo motore, ma di dare al motore due modi, e ha chiesto di definire con precisione la differenza fra i due (F3).

## §2 — Decisione

### D1 — I due modi

Il motore del confronto fra modello e tenant ha un parametro, il **modo del tenant**, con due valori.

**Allineamento.** Il modello è la fonte di verità e il tenant deve coincidere con lui. Ogni differenza si risolve portando il tenant al modello: si rinomina, si sposta, si accorpa o si divide, si crea, si aggiorna un attributo, si ritira (mai si cancella, ADR-0035), si ricollocano le persone. Il tenant tiene solo le eccezioni che una persona ha approvato una per una, ciascuna con un motivo scritto (D5). Si chiude quando la distanza misurata dal vivo è zero, eccezioni approvate escluse (D7). Si usa per RTL Bank e per ogni tenant di prova o dimostrativo; per un cliente vero solo se lo chiede.

**Consolidamento.** Il tenant è la fonte di verità e il modello si adatta a lui. Ogni voce del tenant resta, con il suo nome e il suo codice; il modello le si collega, le porta ciò che il tenant non ha e le offre le voci che le mancano, che il tenant accetta o rifiuta. Niente si ritira senza una scelta del tenant. Si chiude quando ogni differenza ha una decisione e nessuna ricchezza del modello è andata persa senza saperlo. Si usa per i clienti veri, ed è la specifica del 2026-10-30 così com'è.

Il motore è uno: stessi passi (bersaglio, riconoscimento di nodi e legami, operazioni tipizzate, piano ordinato per dipendenze, prova su copia, approvazione, misura), stesso registro delle decisioni (`sys.sys_tenant_consolidation_decisions`), stesso giornale di ritorno (`staging.tenant_consolidation_undo`), stesso agente (D6 dell'analisi: l'interprete della PR 217 entra nel giudice del consolidamento). Il modo decide solo il valore predefinito di ogni scelta, cioè chi vince quando le due parti dicono cose diverse.

| quando | Allineamento | Consolidamento |
|---|---|---|
| una voce corrisponde ma ha un altro nome | prende nome e codice del modello | tiene nome e codice del tenant (R-2) |
| una voce del tenant non è nel modello | si ritira, marcata «fuori modello», salvo eccezione | resta come personalizzazione |
| una voce del modello non è nel tenant | si crea, con la sua cascata | si offre; il tenant adotta o rifiuta |
| un legame è diverso (madre, unità, ruolo, livello) | si sposta come dice il modello | si tiene quello del tenant e si segnala |
| un incarico dipende da una posizione che cambia | la persona si ricolloca (D3 dell'analisi) | non si tocca |
| fine del lavoro | distanza zero, eccezioni escluse | ogni differenza ha una decisione, ricchezza persa zero |

### D2 — La garanzia di integrità, quando si adotta il dato del modello

Un'operazione non è mai una riga sola: è la voce più tutto ciò che dipende da lei (la cascata). La cascata si calcola da tre fonti, mai da un elenco scritto a mano: i legami del database (chiavi esterne e viste che usano la colonna), i legami del contenuto del modello (`tenant-consolidation/cascata.ts`), e chi nel codice e nei riti guarda l'oggetto (`python docs/kb/tools/chi_sorveglia.py <nome>`). Un'operazione la cui cascata tocca qualcosa che il motore non sa aggiornare (un codice usato in una migrazione ripetibile, un valore sotto un CHECK, un codice citato nel codice dell'API o del frontend) **non è sicura**: l'agente lo dice e propone l'alternativa.

La prova che non si è rotto niente si fa su una copia usa-e-getta, prima dell'approvazione, con i controlli che il repo ha già: la catena delle migrazioni riapplicata (`db/scripts/prova-idempotenza.sh`), le viste sentinella contate prima e dopo (come fa `approvazione.ts`), le prove d'integrazione dell'API e il giro E2E delle pagine toccate. Se uno cade, il piano non arriva al pulsante di approvazione.

### D3 — La garanzia di ricchezza, quando si tiene il dato reale

Tenere il dato del tenant vuol dire tenere il suo nome, il suo codice e il suo posto nella struttura, non rinunciare a ciò che il modello sa di lui. Per ogni voce tenuta il motore innesta ciò che il modello porta e il tenant non ha (descrizione, livello CCNL, criticità con il motivo, competenze richieste, indicatori e obiettivi, obblighi e formazione, sede e organico, carriere), con la regola già in uso per sede e organico (000490): un valore che il tenant ha è suo e non si tocca, uno che non ha arriva dal modello. La misura è la **ricchezza persa**: per ogni voce tenuta, quanti attributi e legami del modello non sono stati portati né rifiutati da una persona. Deve essere zero, in tutti e due i modi.

### D4 — L'operazione sicura

Un'operazione passa da sola nella bozza (F3) solo se valgono insieme quattro condizioni: la fiducia dell'agente è almeno quella di soglia (oggi 90, `tenant-consolidation/engine.ts`); la cascata è completa e tutta aggiornabile dal motore (D2); la prova sulla copia è verde; l'operazione non tocca persone e non è fra i divieti di settore (per una banca le separazioni di vigilanza e i processi obbligatori del profilo bancario della PR 217, applicati nel filtro e non solo nel prompt). Passare da sola vuol dire entrare nella bozza, non nei dati vivi: resta visibile e si può togliere fino all'approvazione. È coerente con ADR-0053 (un'azione reversibile e provata, con registro e ritorno) e con ADR-0040 (la scrittura nei dati vivi passa dall'approvazione).

### D5 — Le eccezioni in Allineamento

Tenere il dato del tenant contro il modello, in Allineamento, è un'eccezione e richiede un motivo scritto: lo propone l'agente, la persona lo conferma. L'eccezione non scade, ma si ripresenta quando una corsa nuova cambia proprio quella voce del modello (H3).

### D6 — Le decisioni diventano regole

Ogni decisione di una persona diventa una regola scritta in parole dall'agente, con i tratti del caso che l'hanno determinata, un perimetro (il tenant, questa corsa e le successive), un'origine (la decisione, chi e quando) e l'elenco delle segnalazioni a cui si è estesa (§15 dell'analisi).

- Gli analoghi **diretti** (stesso tipo di operazione, stesso dominio, stessa natura della differenza) si estendono da soli; gli analoghi **indiretti** (cascata, causa comune, coerenza) si mostrano raggruppati e si confermano con un solo gesto per gruppo (G1).
- Un'estensione entra nella bozza, mai nei dati vivi, porta scritto «decisa dalla regola R, nata dalla decisione D», e vale solo se la segnalazione supera le condizioni di D4; altrimenti è «analoga ma non estendibile», con il motivo.
- Una scelta esplicita di una persona vince sempre su una regola, e il conflitto si segnala. Se la decisione d'origine cambia o si toglie, le estensioni si rifanno con lei.
- Una regola vale per tutto il tenant e per le corse future (G2). Non esce dal tenant: per valere altrove diventa un'equivalenza del vocabolario comune (`sys.sys_platform_vocabulary_equivalences`), con il sì di Enzo (R-7 della specifica).

### D7 — La misura della distanza è il criterio di chiusura

Per un tenant e una versione di modello, la **distanza** conta, per ciascuno dei domini del confronto, le voci uguali, parziali, diverse, solo nel modello e solo nel tenant, più la ricchezza persa (D3). È uno strumento in sola lettura (voce A2 del piano). Ogni giro si prova prima su una copia e si chiude solo con la distanza prima e dopo, dominio per dominio, scritta nel registro della corsa (`sys.sys_blueprint_runs`). Un tenant in Allineamento è allineato quando la distanza è zero salvo le eccezioni elencate; un tenant in Consolidamento è consolidato quando ogni differenza ha una decisione e la ricchezza persa è zero.

### D8 — Chi decide che cosa

- Il **modo** di un tenant lo sceglie solo Enzo, dalla piattaforma. Un tenant è in Consolidamento finché Enzo non lo mette in Allineamento. Il Direttore HR del tenant vede il modo ma non lo cambia (G3).
- I **dati** del tenant li approva il Direttore HR del tenant (`HRMS_MANAGER`) o un suo delegato, come nella specifica (§6); per RTL Bank oggi è il Direttore HR del tenant.
- Le **regole di piattaforma** (equivalenze di vocabolario comuni, divieti di settore) le approva Enzo.
- Advanced non modifica mai il modello approvato del datastore. Le eccezioni che si ripetono diventano segnalazioni per il datastore, che Enzo decide se portare nella prossima corsa (J3, fuori dalla prima tappa).

## §3 — Che cosa cambia di ADR-0048 e della specifica del 2026-10-30

Per un tenant in **Consolidamento** non cambia niente: ADR-0048 e la specifica valgono come sono scritti.

Per un tenant in **Allineamento**:

1. La regola predefinita di R-2 e la traduzione del modello nella lingua del tenant di R-13 non valgono come predefinito: la voce prende nome e codice del modello. La traduzione resta utile nei giri preliminari del riconoscimento, dove fa trovare più corrispondenze, e una voce tenuta come eccezione conserva il nome del tenant.
2. La «personalizzazione intoccabile» (§5 della specifica) diventa un'eccezione con motivo (D5): senza eccezione approvata una voce che il modello non ha si ritira. Il ritiro è quello di ADR-0048: la voce resta, marcata «fuori modello», e non si cancella.
3. Una voce «conservata» nel senso di ADR-0048 è, in Allineamento, un'eccezione approvata; se la persona non la approva, all'arrivo della versione la voce si aggiorna come una ereditata.
4. L'agente può proporre di spostare gli incarichi delle persone (§7 della specifica): solo l'incarico (`sys.sys_user_position_assignments`), con l'effetto esistente `approvals/effects/position-assignment.ts` (mai cancellazioni, mai due incarichi primari, guardia di tenant). Restano fermi anagrafica, utenze, credenziali, contratti, valutazioni e retribuzioni; niente demansionamento, e un aumento di livello che la corsa porterebbe si segnala a Enzo perché costa.
5. «Quando è finito» (§9 della specifica) diventa la misura di D7, non la sola contabilità delle decisioni.

Tutto il resto della specifica vale in tutti e due i modi: l'agente legge e propone e non scrive mai da solo nei dati vivi; non cancella; non tocca i dati importati (ADR-0045); non esce dal perimetro del tenant (ADR-0046); ogni decisione è registrata.

## §4 — Conseguenze

- Il piano `docs/piani/PIANO_allineamento-consolidamento_20261116.md` esegue questa decisione a tappe (A-H). Il modo per tenant si costruisce nella voce G7, con la sua prova d'integrazione dei permessi; fino ad allora nessun tenant è in Allineamento nei dati, e il motore di oggi resta il Consolidamento della specifica.
- La misura della distanza (A2) si costruisce per prima, perché è la prova di ogni tappa successiva.
- Le prove della garanzia d'integrità (D2) e delle operazioni sicure (D4) girano solo su copie usa-e-getta (`scripts/copia-prova.sh`), mai su `heuresys_ci` né sulla produzione.
- L'approvazione in produzione per RTL Bank (tappa H) avviene con un backup verificato da meno di 24 ore, l'approvazione del Direttore HR del tenant e la misura dopo.

## §5 — Alternative scartate

- **Due motori separati**, uno per tipo di tenant: scartata perché raddoppia agenti, criteri e registri sullo stesso problema (limite L7 dell'analisi).
- **Cambiare il modello nel datastore** perché coincida con RTL: scartata, il modello approvato non si tocca da advanced (R-13, prima cautela) e il modo in cui il datastore crea i modelli non cambia (D5 dell'analisi).
- **Allineamento per tutti i tenant**: scartata, contraddice ADR-0042 per un cliente vero, che possiede la sua organizzazione.
