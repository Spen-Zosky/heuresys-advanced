# ADR-0054 — Heuresys è la piattaforma del cambiamento organizzativo, per qualunque impresa

- **Status**: ACCETTATO il 2026-11-03 da Enzo Spenuso (alle 14:16 UTC, 15:16 ora di Roma, sulla scheda «Accetti l'ADR-0054 sul posizionamento di Heuresys?» del thread «Scrivere l'ADR del posizionamento»: «Sì, accetto»)
- **Date**: 2026-11-03
- **Redatto da**: Claude Code, thread «Scrivere l'ADR del posizionamento» (mandato F0-1 del programma esecutivo del change management)
- **Decided by**: Enzo Spenuso, 2026-11-03, nel thread «Ricostruire la visione completa di Heuresys»: alle 04:33 ora di Roma le sei risposte all'intervista («il change management è al centro»; «sarà per il change management quello che SAP è per l'ERP»; primo cliente «un fornitore come SAP o Zucchetti, più un primo cliente di medie dimensioni dell'industria manifatturiera»); alle 04:34 la precisazione: «non voglio che Heuresys sia uno specialista per industry ma per modellazione organizzativa di qualunque tipo di impresa».
- **Supersedes**:
  - il posizionamento «Skills & Org Intelligence EU-native» e l'ICP «mid-market europeo 250-2000 dipendenti in settori regolati» di `docs/product/BUSINESS_SCOPE_AND_PRD.md` (§1.3-§1.5, 17 giugno 2026), che da oggi è un documento storico;
  - come posizionamento di prodotto, la formula «Organizational Intelligence & Workforce Orchestration» della visione di agosto (`docs/vision/riferimenti/posizionamento-centrale.md`). Il documento resta dov'è, nel perimetro del programma `project-dream`, e non si modifica qui: la sua catena strategia-processi-struttura-competenze-persone-gap resta valida come descrizione dello **stato** di un'organizzazione (D1).
- **Non tocca**: gli invarianti di `CLAUDE.md` (I1, I5, I7, I9, I12-I23), che restano come sono; in particolare I21 e ADR-0043 sono letti secondo D3, senza cambiarne il testo. Non tocca ADR-0053 (libertà degli agenti), che resta la regola su come l'IA scrive.
- **Builds on**: ADR-0043 (separazione dal datastore), ADR-0044 e ADR-0049 (processi e attività legati a posizioni e unità), ADR-0045 (dati contrattuali importati), ADR-0046-0048 (fascicolo, perimetro e personalizzazioni del tenant), ADR-0053 (agenti per capacità); regola trasversale di Enzo del 2026-10-31 (Heuresys è una piattaforma agentica, AI driven); decisione di Enzo del 2026-10-31 sull'affiancamento ai fornitori come SAP, Zucchetti e JetHR.
- **Contesto**: `docs/product/VISIONE_INTEGRATA_HEURESYS_20261103.md`, sezioni 1bis, 2.3 e 10, e `docs/piani/PROGRAMMA_change_management_20261103.md`, registro R-1…R-4 (entrambi nella PR #154).

> **In parole semplici.**
> 1. Heuresys serve a governare il cambiamento di un'organizzazione: sapere com'è fatta oggi, decidere come deve essere domani e accompagnare le persone nel passaggio.
> 2. Vale per qualunque impresa, di qualunque settore. Una banca o un'azienda manifatturiera sono clienti, non specializzazioni.
> 3. I modelli di settore che il datastore prepara sono un punto di partenza per fare prima, non il prodotto.
> 4. I primi clienti sono un fornitore di software gestionale come SAP o Zucchetti, che affianca Heuresys ai suoi prodotti, e poi un'impresa manifatturiera di medie dimensioni.
> 5. Heuresys non rifà ciò che fanno già i gestionali: paghe, presenze, firma elettronica. Si collega a loro.

---

## §1 — Contesto

Fino a oggi Heuresys aveva tre posizionamenti in circolazione, e nessuno dei tre era stato scritto come decisione:

1. **«Skills & Org Intelligence EU-native»** (PRD del 17 giugno, §1.5): nato dalla constatazione che «Organizational Intelligence» come nuova categoria non reggeva al mercato, con un cliente tipo di 250-2000 dipendenti in settori regolati, a partire dalle banche.
2. **«Organizational Intelligence & Workforce Orchestration»** (visione del 25 agosto, `posizionamento-centrale.md`): «trasformare il modello operativo dell'impresa in una struttura organizzativa eseguibile, misurabile e sviluppabile», con traguardo «vendibile a PMI italiane in 6 mesi» (`docs/vision/INDEX.md`).
3. **Change management** (Enzo, 3 novembre): il cambiamento al centro, e Heuresys «per il change management quello che SAP è per l'ERP».

Finché i posizionamenti restano tre, ogni funzione si può giustificare e nessuna si può escludere (VISIONE §2.3). Il PRD, inoltre, descrive un prodotto che non esiste più: dice «non è un BPM» e «layer prescrittivo progettato, non costruito», mentre oggi esistono un runtime di approvazione generico, MLCE, VRIO, maturità e advisor (VISIONE §2.3 punto 3, con i file).

Tre fatti rendono la scelta del 3 novembre concreta e non solo dichiarata:

- **Il motore c'è già.** L'agente di consolidamento confronta uno stato di riferimento (il prototipo) con lo stato reale del tenant e, voce per voce, propone corrispondenza, lacuna o personalizzazione, con una persona che decide e un registro delle decisioni (`apps/api/src/modules/tenant-consolidation/engine.ts`; specifica del consolidamento, §5 e §8). Il 1-2 novembre ha girato in produzione su RTL: 40 proposte, 40 decise dalla Direttrice HR. Una riorganizzazione è la stessa operazione con uno stato futuro al posto del prototipo.
- **Il nucleo è già indipendente dal settore.** Posizioni (I1), unità, processi e attività legati a posizioni e unità (ADR-0044, ADR-0049), competenze ESCO, accesso per catena organizzativa (I16-I22), consolidamento: nessuno di questi oggetti presuppone una banca. Il contenuto di settore in advanced è oggi solo FIN_BANKING, e il datastore ha già un prototipo metalmeccanico completo (VISIONE §1bis).
- **Il mercato tratta la riprogettazione come ricorrente e trasversale ai settori.** L'indagine McKinsey del 2025 su 2.000 dirigenti di 16 settori rileva che le riprogettazioni del modello operativo sono ormai «una parte regolare del modello operativo, non una correzione una tantum», e attribuisce l'aumento dei successi anche alla disponibilità di strumenti basati sui dati (https://www.mckinsey.com/capabilities/people-and-organization/our-insights/the-new-rules-for-getting-your-operating-model-redesign-right). La stessa fonte, nell'indagine precedente, rileva che il 60% dei dirigenti non dedica abbastanza tempo a valutare lo stato dell'organizzazione prima di riprogettarla, e che i dati usati sono spesso imprecisi o superati (https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/getting-organizational-redesign-right). È esattamente il vuoto che un modello organizzativo vivo, centrato sulla posizione, riempie. Sono dati di chi vende consulenza: si usano dichiarandone l'origine, come chiede il programma (§2).

## §2 — Decisione

**D1 — La categoria è il cambiamento organizzativo.** Heuresys è la piattaforma con cui un'impresa governa il proprio cambiamento organizzativo: conosce il proprio stato attuale (struttura, posizioni, processi, competenze, persone), descrive uno stato futuro, calcola che cosa e chi tocca il passaggio, lo accompagna e ne misura l'adozione. La formula «per il change management quello che SAP è per l'ERP» è l'ambizione di Enzo e la bussola interna, non uno slogan di vendita da usare senza prove.

Gli altri due posizionamenti non si buttano: diventano capacità al servizio di questa categoria (registro R-1 del programma). La «Organizational Intelligence» di agosto descrive lo **stato** dell'organizzazione e ne è il fondamento; le competenze del PRD di giugno sono una delle dimensioni di quello stato. Il cambiamento è il passaggio governato da uno stato a un altro.

**D2 — La specialità è la modellazione organizzativa, non un settore.** Heuresys è specialista nel modellare qualunque tipo di impresa. Ne discendono tre regole di progetto:

1. Una funzione entra nel nucleo solo se lavora su oggetti che ogni impresa ha (unità, posizioni, processi e attività, competenze, persone, incarichi, obiettivi). Una funzione che ha senso per un solo settore vive nei contenuti (prototipi, cataloghi, regole configurabili), non nel codice del nucleo.
2. Il contenuto di settore (processi tipici, mestieri, contratti collettivi, KPI di settore) è un **acceleratore di partenza**: il prototipo del datastore arriva come fascicolo (ADR-0047), il consolidamento lo piega alla lingua del tenant (specifica, §4bis) e ciò che il tenant personalizza non si sovrascrive (ADR-0048).
3. Un'impresa di un settore che il datastore non ha mai visto deve poter partire comunque da un modello utile. Per questo nel datastore si separa ciò che è comune a ogni impresa (funzioni di supporto, processi trasversali, strutture tipiche per dimensione) da ciò che è di settore: è il mandato F5-1 del programma (registro R-4). Quanto del modello sia comune si misura sui prototipi metalmeccanico e bancario; la stima del 60-70% della VISIONE (§1bis) è un'ipotesi da verificare, non un dato.

**D3 — Come si legge I21.** I21 resta com'è: i dati che derivano dall'industria di un tenant sono coerenti con essa, e in advanced un tenant vede solo il proprio perimetro delle tassonomie (ADR-0043). È una regola sui **dati** del tenant, non una scelta di **mercato**: non fa di Heuresys uno specialista di settore. Il settore di un tenant decide quale acceleratore riceve, non quali funzioni può usare.

**D4 — I primi clienti, in quest'ordine.**

1. **Un fornitore di software gestionale e HR come SAP o Zucchetti**, che affianca Heuresys ai propri prodotti (decisione di Enzo del 31 ottobre e risposta 1 del 3 novembre). Un fornitore compra integrabilità prima che pagine: API pubblica documentata, eventi verso i suoi sistemi, accesso unico. Queste voci non sono più in fondo al piano: sono la fase F2 del programma.
2. **Un'impresa manifatturiera di medie dimensioni**, a partire dal prototipo metalmeccanico già pronto nel datastore, senza farne una specializzazione (D2).

RTL Bank resta il tenant modello, su cui ogni funzione si dimostra dal vivo (ADR-0026). La dimensione «media impresa» indica dove si comincia, non un confine del prodotto: non si esclude per principio nessuna dimensione né alcun settore. Restano valide le esclusioni del PRD che dipendono dalla natura dell'organizzazione e non dal settore: un'organizzazione senza struttura da governare (una holding pura, una startup di poche persone) non ha bisogno di Heuresys.

**D5 — Le tre persone che aprono Heuresys ogni giorno** (risposta 2 di Enzo):

- il **Direttore HR**, che governa il capitale umano dell'impresa e il suo cambiamento;
- il **capo di unità**, che ha un cockpit del proprio presidio: persone, posizioni, processi della sua unità e cambiamenti in arrivo;
- il **dipendente**, che conosce l'azienda e il proprio ruolo in essa senza dover telefonare o scrivere a qualcuno.

Ogni nuova pagina o agente dichiara per quale di queste persone esiste e quale decisione le fa prendere meglio.

**D6 — I confini.** Heuresys non costruisce ciò che i sistemi che affianca fanno già: paghe, presenze, firma elettronica, benefit, dati medici, app mobile nativa (VISIONE §8.2; analisi di mercato, `AI/V8_mercato/schede_gruppi.md` riga 278). La formazione si orchestra, non si eroga. I dati contrattuali importati da un gestionale non si modificano (ADR-0045). Il reclutamento resta costruito ma dichiarato non attivo finché un cliente non lo chiede (piano interfacce, decisione 9). Non costruirli è ciò che rende sensato l'affiancamento: un fornitore non affianca un concorrente.

**D7 — L'IA è il modo di lavorare, non un modulo.** Il vincolo trasversale del 31 ottobre vale per tutto il posizionamento: Heuresys è agentica e guidata dall'IA. Nel cambiamento organizzativo l'IA prepara: abbina stati, calcola impatti, propone, misura. Quanto può scrivere da sola lo decide ADR-0053, una capacità alla volta. Restano fuori, salvo decisione esplicita e fascicolo dell'alto rischio, le proposte che producono effetti su un singolo lavoratore (AI Act, Allegato III punto 4; GDPR art. 22).

**D8 — La misura del valore.** Il «test del valore» del PRD resta la stella polare: Heuresys crea valore solo se i dati portano a decisioni diverse da quelle che l'organizzazione prenderebbe senza. Da frase diventa misura con il mandato F0-3 (decisione tracciabile, per tenant e per settimana). Nei materiali di prodotto e di vendita si usano solo dati con fonte; il «70% dei cambiamenti fallisce» non ha base empirica valida (Hughes, Journal of Change Management, 2011, https://doi.org/10.1080/14697017.2011.630506) e non si usa.

## §3 — Alternative considerate

- **Restare sul PRD di giugno** (Skills & Org Intelligence, settori regolati). Scartata: è superata dalla parola di Enzo, descrive un prodotto che oggi è cambiato, e lega Heuresys a una categoria con 27 fornitori censiti in cui il primo cliente indicato, un fornitore di gestionali, non avrebbe motivo di affiancarlo.
- **Specializzarsi per settore, a partire dalla banca.** Scartata per decisione esplicita di Enzo (04:34). Avrebbe dato un messaggio commerciale più semplice, ma avrebbe moltiplicato il codice per settore e reso ogni nuovo cliente una corsa dedicata.
- **«Organizational Intelligence» come categoria nuova.** Non scartata nel merito ma ricollocata: descrive lo stato, non il cambiamento, e il PRD aveva già mostrato che come categoria di mercato non è riconosciuta. Resta il fondamento di D1.

## §4 — Conseguenze

**Positive.** Un solo posizionamento: ogni mandato del programma si giudica su due domande, «serve al cambiamento organizzativo?» e «vale per qualunque impresa?». Il lavoro già fatto si riscuote invece di ricominciare, perché il motore del consolidamento diventa il motore del cambiamento (proposta C-1 della VISIONE). L'integrabilità sale di priorità, coerente con il primo cliente.

**Costi e rischi.** La categoria «change management» è affollata di metodo e consulenza e povera di prodotti che lavorino sul modello organizzativo vivo: è un'opportunità, ma va dimostrata con un tenant non bancario prima di dirlo a un fornitore. Il contenuto di settore oggi è solo bancario: finché il manifatturiero non è consegnato ad advanced come tenant dimostrativo, l'indipendenza dal settore è un'architettura, non una prova. Alcune pagine e parole del prodotto nascono dal bancario e andranno rilette (lavoro del piano interfacce, non di questo ADR).

**Documenti.** In questa stessa PR: `docs/product/README.md` riscritto attorno a questo ADR; `docs/product/BUSINESS_SCOPE_AND_PRD.md` marcato come storico con una nota in testa che rimanda qui (registro R-3); indice degli ADR rigenerato. Non si toccano `docs/vision/**`, che ha sessioni dedicate (CLAUDE.md, «Avvio di sessione»): la sessione del programma `project-dream` riceverà il rimando a questo ADR.

## §5 — Come si verifica

- `python docs/kb/tools/build_adr_index.py --check` esce 0 con questo ADR nell'indice.
- Ogni mandato del programma esecutivo (`docs/piani/PROGRAMMA_change_management_20261103.md`) cita, nella sua PR, a quale delle due domande di §4 risponde.
- La prova che D2 regge non è un documento: è un tenant dimostrativo manifatturiero, nato dal prototipo del datastore, su cui girano le stesse pagine e gli stessi agenti di RTL senza codice di settore.
