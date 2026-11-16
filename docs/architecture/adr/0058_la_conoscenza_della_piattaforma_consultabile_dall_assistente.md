# ADR-0058 — La conoscenza della piattaforma è consultabile dall'assistente, con un perimetro proprio

- **Status**: ACCETTATO il 2026-11-16 da Enzo Spenuso, alle 01:44 UTC, nel thread «Pianificare le funzioni agentiche di mod in Heuresys»: «decisioni: accetto tutte le tue raccomandazioni». Le raccomandazioni accettate sono le decisioni D1-D5 del piano [PIANO_conoscenza-agentica-da-mod_20261116.md](../../piani/PIANO_conoscenza-agentica-da-mod_20261116.md), sezione 4, riportate qui come D1-D5.
- **Date**: 2026-11-16
- **Redatto da**: Claude Code, thread «Pianificare le funzioni agentiche di mod in Heuresys»
- **Richiesta**: Enzo Spenuso, 2026-11-16 alle 01:26 UTC: portare in datastore e advanced le funzionalità agentiche di mod-platform (assistenti, second brain, metodologie, strategie, riti) dove aggiungono qualcosa, e rendere la documentazione dei due repo consultabile dall'utente loggato, solo Enzo e gli apicali di RTL.
- **Analisi che lo prepara**: sezioni 1-3 del piano, lette in sola lettura su mod-platform `d8a8397d`, heuresys-advanced `921df8d2`, heuresys-datastore `4ae203cd`.
- **Builds on**: ADR-0036 (perimetro come intersezione di gerarchia e funzione), ADR-0040 (l'agente legge ciò che legge la persona), ADR-0050 D6 (gli agenti non portano mandati), ADR-0053 (capacità e tetti), ADR-0056 (principi agentici: P5, P20, P22, P23, P24; riti R3, R4, R8).
- **Non tocca**: gli invarianti di `CLAUDE.md`; ADR-0036 §5; i vettori Voyage delle entità HR (000060).

> **In parole semplici.**
> 1. I documenti di advanced e del datastore entrano in un indice della piattaforma, e l'assistente li cerca e li cita. Una pagina «Documentazione» li mostra.
> 2. Li vede Enzo, tutti. Gli apicali di un cliente vedono solo il prodotto, le scelte di architettura e le guide. Chi è apicale lo calcola la piattaforma dall'organigramma, senza un elenco di nomi.
> 3. I documenti si trasformano in vettori sulla VM, senza servizi esterni e senza spese.
> 4. L'assistente ricorda un fatto solo quando la persona glielo chiede; la persona vede e ritira ciò che ha fatto ricordare.
> 5. I riti che fanno lavorare il modello da solo hanno un tetto giornaliero e il loro consumo si vede.

## §1 — Contesto

Heuresys ha i vettori sulle entità HR (Voyage, 000060) e il full-text sul CMS del tenant (000098), ma nessun indice dei documenti dei repo, nessuna memoria della persona oltre la conversazione (000483) e nessun documento esposto nell'app. mod-platform ha un RAG ibrido (parole e significato, fusione RRF, citazioni verificate dal codice) con un modello di embedding locale, e una memoria «ricorda» su richiesta esplicita. ADR-0036 non prevede che persone di un tenant cliente leggano dati del tenant della piattaforma: serve una decisione.

## §2 — Decisione

**D1 — Due pubblici.** Ogni documento indicizzato ha un pubblico, `enzo` o `apicali`. `PLATFORM_ADMIN` (Enzo) vede tutto. Gli apicali vedono il prodotto (`docs/product/`), le ADR, `docs/kb/SOT_STATE.md` e le guide di funzionamento, e il vault del datastore. Restano `enzo` i piani, i debiti, la due diligence, i wargames, la vision, l'archivio, il brownfield e ogni documento su costi, rilasci e macchine. Un file non classificato è `enzo`. Un documento `apicali` che contiene un segreto, un percorso di macchina o un dato personale torna `enzo` per controllo automatico.

**D2 — Chi è apicale.** Persona di un tenant cliente con una posizione attiva entro `LIVELLO_VERTICE` (livelli 1-2 dell'albero delle unità, `apps/api/src/lib/scope/mask.ts:219`), oppure con il mandato HR (`HRMS_MANAGER`, `TENANT_ADMIN`). Il calcolo è dal vivo, a ogni richiesta: chi cambia posizione prende o perde l'accesso da sé. Fuori dal perimetro la risposta è 404. Questa è un'estensione dichiarata di ADR-0036: un perimetro funzionale nuovo, `knowledge`, su dati della piattaforma, che non dà accesso a nessun dato di un altro tenant.

**D3 — Vettori locali per i documenti.** Embedding `multilingual-e5-small` (384 dimensioni) calcolato nel processo dell'API sulla VM; nessun testo dei documenti esce verso un servizio esterno; nessuna spesa. Voyage resta per le entità HR. Il significato si accende solo dopo la prova di qualità (30 domande vere, almeno 8 su 10 con il documento atteso nei primi tre); sotto soglia la ricerca resta per parole.

**D4 — Riti con tetto.** I riti in cui il modello lavora senza una persona (cura della memoria, salute dell'indice, revisione periodica) girano a lotti con un tetto giornaliero, caricano il token di lunga durata degli agenti e registrano il loro consumo. Nessuna spesa nuova: è lo stesso abbonamento (P24).

**D5 — Memoria personale su richiesta.** L'assistente ricorda un fatto solo se la parola della persona lo chiede (P5, P20); un testo letto che dice «ricorda» non scrive niente. La memoria è PERSONAL, legata a persona e tenant, si cancella con la persona, e solo la persona la legge e la ritira. Quando nomina una persona o un'unità salva il riferimento, e il dato si rilegge dal vivo con i permessi di oggi. I riti propongono doppioni e contraddizioni alla persona, non fondono da sé.

## §3 — Conseguenze

- Le voci K2-K15 del piano diventano eseguibili, una PR per voce, con la dimostrazione dal vivo dopo un rilascio che decide Enzo.
- Nuove tabelle: indice dei documenti e dei pezzi, memoria personale, consumo del modello (piano, voci K3, K9, K13).
- Nuovo permesso `knowledge:read`, dato per livello e mandato secondo D2, e nuovi strumenti dell'assistente: `hrx_conoscenza_cerca` (classe A) e `hrx_memoria_ricorda` (classe B, annullabile), con le loro righe in anagrafe e nella prova avversaria.
- Una dipendenza di runtime nuova nell'API (`@huggingface/transformers`) e un modello di circa 130 MB sulla VM, fuori dal repo.
