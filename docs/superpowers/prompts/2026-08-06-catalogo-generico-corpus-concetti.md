# Mandato — catalogo generico e corpus dei concetti

**Data consegna**: 2026-08-06 (eseguito il 2026-08-07) · **Origine**: Cowork · **Esecutore**: Claude Code CLI
**Referto prodotto**: `../specs/2026-08-07-catalogo-generico-referto-di-programma.md`

**Contesto della decisione**: Enzo ha obiettato che definire a priori quali domande
l'agente possa ricevere e' un anti-pattern, perche' qualunque dato del dominio funzionale
puo' essere oggetto di domanda. Obiezione accolta. Ma la risposta NON e' collegare 73
strumenti mancanti: un catalogo con 90 strumenti degrada la selezione del modello e gonfia
il contesto a ogni turno. Si adotta un catalogo di pochi strumenti generici che navigano
il dominio, con il dizionario dei concetti derivato meccanicamente da `atlas.yaml`.

**Scopo dichiarato del ciclo**: NON implementare l'architettura, ma metterla alla prova.
Il task 2 e' il vero test: se la ricerca per somiglianza sui metadati non recupera
l'entita' giusta, l'architettura non regge e va saputo prima di costruire.

---

PROMPT CLI 02 â€” catalogo generico e corpus dei concetti (heuresys-advanced)
Generato da Cowork il 2026-08-06, dopo il rapporto del prompt 01. Autocontenuto.

--- INIZIO PROMPT ---

Lavori sul repo heuresys-advanced. Verifica la root con `git rev-parse --show-toplevel`
e dichiarala. Su Windows e' D:\heuresys-advanced.

REGOLA DI INGAGGIO
Non modificare nulla finche' non ti ho confermato il piano. Prima leggi, poi esponi un
piano con i comandi esatti, poi ti fermi e aspetti il mio ok.
Questo ciclo e' in prevalenza PROGETTAZIONE e MISURA, non implementazione. Se ti viene
voglia di scrivere il catalogo generico, fermati: non e' questo il compito.

LEGGI PRIMA DI AGIRE (obbligatorio)
- CLAUDE.md nella root
- docs/superpowers/specs/2026-08-06-substrato-semantico-verifica-e-correzioni.md (il tuo
  rapporto precedente: contiene i numeri di partenza)
- docs/kb/tools/build_atlas.py
- docs/kb/atlas/ATLAS.md e le prime 60 righe di docs/kb/atlas/atlas.yaml
- apps/agent-gateway/src/mcp-tools.ts e src/sdk-agent.ts
- apps/api/src/modules/semantic-matching/service.ts

DA DOVE VENIAMO
Il substrato semantico e' verificato e sano: quattro corpus al 100%, modello unico
voyage-4-lite, indici HNSW, ricerca kNN sensata a 400-640 ms. L'agent-gateway funziona
con 51 test verdi. Ma il suo catalogo espone 17 strumenti su oltre 90 moduli API.

LA DECISIONE ARCHITETTURALE GIA' PRESA
NON si colmano i 73 moduli mancanti aggiungendo 73 strumenti. Un catalogo con 90
strumenti degrada la selezione del modello, gonfia il contesto a ogni turno e alza il
costo per chiamata. Si adotta invece un catalogo di pochi strumenti GENERICI che sanno
navigare il dominio: trova le entita' che riguardano un concetto, descrivi l'entita',
interroga l'entita'. Il primo passo e' RAG applicato ai METADATI del dominio.
Il dizionario dei concetti non si scrive a mano: si deriva da atlas.yaml, che gia'
mappa moduli, endpoint, permessi, tabelle e pagine, e che si rigenera dal codice e dal
DB vivo. Cosi' uno schema che cambia rende l'agente capace di vedere le entita' nuove
senza che nessuno colleghi uno strumento.

QUESTO CICLO NON IMPLEMENTA L'ARCHITETTURA. La mette alla prova.

TASK 1 â€” Rigenera l'atlante e dichiara cosa copre
atlas.yaml e' fermo al commit 115d7983 del 2026-07-05: un mese, e nel frattempo sono
stati importati dati. Rigeneralo con build_atlas.py.
Riporta: quanti moduli API, quanti endpoint, quante tabelle sys.* popolate, quante
pagine. Confronta con la versione del 5 luglio e dimmi cosa e' cambiato.
Riporta anche i limiti dichiarati dallo strumento: cosa NON riesce a mappare.
Solo letture sul DB. La scrittura e' su docs/kb/atlas/, che e' di tua competenza.

TASK 2 â€” Il vero test dell'architettura: la ricerca per somiglianza sui concetti
Questo e' il task che decide se l'architettura regge. Fallo con cura.
a) Dall'atlante, deriva un corpus di "concetti del dominio". Decidi tu cosa e' un
   concetto (modulo? entita'? risorsa esposta?) e ARGOMENTA la scelta: per ognuno serve
   un testo descrittivo in italiano, ricavato da nomi, descrizioni, tabelle e permessi.
   Produci prima il corpus come FILE, non come tabella nel database.
b) Riporta quanti concetti sono, e quante chiamate Voyage servirebbero per vettorizzarli.
   FERMATI QUI e aspetta il mio ok prima di scrivere qualunque cosa nel database.
c) Su mio ok: vettorizza il corpus e misura. Scrivi 10 domande in italiano che un
   direttore del personale farebbe davvero, VARIE e non costruite sul corpus (esempi:
   "chi puo' sostituire il responsabile della filiale di Brescia", "quali competenze
   mancano di piu' in azienda", "quali obiettivi sono in ritardo"). Per ognuna riporta:
   la domanda, i primi 5 concetti recuperati con punteggio, e un tuo giudizio secco su
   se il concetto GIUSTO era fra i primi 3.
d) Concludi con un verdetto onesto: la ricerca per somiglianza sui metadati recupera
   l'entita' giusta abbastanza spesso da fondarci sopra un'architettura? Se la risposta
   e' no, DILLO. Un no misurato oggi vale settimane risparmiate.

TASK 3 â€” ADR del catalogo generico (progetto, NON codice)
Scrivi un ADR nelle convenzioni gia' in uso nel repo. Deve definire: quali sono gli
strumenti generici e la loro firma; come l'agente passa da concetto a entita' a query;
dove finiscono i 17 strumenti attuali (restano? migrano? convivono?).
VINCOLO DI SICUREZZA NON NEGOZIABILE: lo strumento che interroga NON deve fare SQL
diretto. Deve passare dagli endpoint /v1 esistenti con la sessione del chiamante
inoltrata, perche' i permessi li applica il server. Un catalogo generico che aggira
il gate RBAC trasforma un punto di forza in una falla. Se non vedi come farlo senza
SQL diretto, scrivilo come problema aperto: non risolverlo con una scorciatoia.
L'ADR deve anche dire cosa NON si fa e perche'.

TASK 4 â€” Cache degli embedding di query (piccola, concreta)
In service.ts il testo libero costruisce un embedder a ogni richiesta: una chiamata
Voyage a pagamento per ogni domanda posta, senza cache. Nel catalogo generico ogni
domanda dell'utente inizia cosi'.
Progetta e implementa una cache: chiave = hash del testo + model_id, come gia' fatto
per i corpus. Decidi tu dove vive (memoria? tabella?) e argomenta.
Test unitari: stessa query due volte = una sola chiamata all'embedder.
Non toccare il flag MATCHING_FREETEXT_ENABLED: resta com'e'.

DIVIETI
- Non implementare il catalogo generico in questo ciclo: il task 3 e' un documento
- Non scrivere nel database senza il mio ok esplicito (vedi task 2b)
- Non scrivere in SOT_STATE, SOT_BACKLOG, DEBT_REGISTER, STATE.md
- Non fare push: i commit restano locali
- Non toccare gli indici HNSW ne' il modello voyage-4-lite
- Non aggiungere strumenti al catalogo MCP attuale
- Non riportare valori di segreti
- Se un mio numero atteso diverge dalla realta', segnala la divergenza e non riallineare

SE QUALCOSA VA STORTO
Se build_atlas.py fallisce: raccogli l'errore, non riscrivere lo strumento; dopo 2
tentativi fermati. Se il task 2 da' risultati mediocri: NON aggiustare il corpus finche'
non funziona. Riportami i risultati mediocri: sono l'informazione piu' preziosa di
questo ciclo. Se non riesci a progettare il task 3 senza SQL diretto: dillo, e' un
problema architetturale vero, non una tua mancanza.

--- FINE PROMPT ---

