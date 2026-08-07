# Mandato — substrato semantico: verifica, due correzioni, copertura piena

**Data consegna**: 2026-08-06 · **Origine**: Cowork (Claude Opus) · **Esecutore**: Claude Code CLI
**Referto prodotto**: `../specs/2026-08-06-substrato-semantico-verifica-e-correzioni.md`

**Contesto della decisione**: Cowork aveva prodotto un inventario verificato del substrato
AI/RAG accertando che pgvector, gli indici HNSW e i quattro corpus esistevano, ma quattro
punti non erano verificabili senza accendere l'API. Questo mandato chiude quei punti e
corregge due difetti trovati leggendo il codice.

**Nota**: uno dei numeri attesi in questo mandato era sbagliato — "7 utenti scoperti".
Quelle 7 persone sono fuori corpus, non scoperte. Il referto segnala correttamente la
divergenza. Il numero resta qui come consegnato: e' cio' che spiega la segnalazione.

---

PROMPT CLI â€” verifiche AI/RAG e correzione embedding (heuresys-advanced)
Generato da Cowork il 2026-08-06. Autocontenuto: incollalo in Claude Code CLI cosi' com'e'.

--- INIZIO PROMPT ---

Lavori sul repo heuresys-advanced. Verifica prima di tutto la root con
`git rev-parse --show-toplevel` e dichiarala: su Windows e' D:\heuresys-advanced,
sulla VM e' /home/ubuntu/heuresys.com.evo. Non assumerla.

REGOLA DI INGAGGIO
Non modificare nulla finche' non ti ho confermato il piano. Prima leggi, poi espone
un piano in chat con i comandi esatti, poi ti fermi e aspetti il mio ok.

LEGGI PRIMA DI AGIRE (obbligatorio)
- CLAUDE.md nella root (vincoli di progetto, chi scrive dove, freeze in vigore)
- apps/api/src/modules/semantic-matching/backfill.ts
- apps/api/src/modules/semantic-matching/repository.ts
- apps/api/test/semantic-matching-backfill.test.ts
- le ultime 40 righe di docs/kb/COWORK_INBOX.md

CONTESTO IN TRE RIGHE
Il substrato semantico esiste ed e' popolato: pgvector 0.8.5, indici HNSW su tutte e
quattro le tabelle embedding, circa 14.000 vettori competenza. L'agent-gateway
funziona: 51 test verdi, autenticazione su abbonamento provata dal vivo.
Restano due difetti e tre verifiche mai eseguite. Questo e' il tuo compito.

OBIETTIVO
Alla fine devono essere vere quattro cose: sappiamo se l'API e la ricerca semantica
rispondono davvero con numeri alla mano; il salto-per-hash del backfill confronta
anche il modello di embedding; esiste uno strumento che misura la copertura
vettoriale; i vettori mancanti sono colmati, ma solo dopo un mio ok separato.

TASK 1 â€” Accendi l'API e prova la ricerca semantica
Avvia l'API in locale e interroga il modulo semantic-matching con almeno 3 query in
italiano su competenze reali. Riporta per ognuna: la query, i primi 5 risultati con
punteggio di somiglianza, il tempo di risposta in millisecondi.
Riporta anche chi tiene aperta la porta 5433 verso il database, con il comando che lo
dimostra. Se e' un tunnel SSH avviato a mano, dillo chiaramente: e' fragilita' nota.
Solo letture. Nessun reindex in questo task.

TASK 2 â€” Il salto-per-hash deve confrontare anche il modello
Difetto accertato: in backfill.ts la funzione backfillCorpus salta un elemento se
l'hash del testo coincide. Confronta solo il testo, mai la colonna model_id, che pure
esiste in tutte e quattro le tabelle. Conseguenza: il giorno che cambi modello di
embedding, ogni riga viene saltata e resti con un corpus misto, vecchi vettori
mescolati ai nuovi. Somiglianze sbagliate, in silenzio, senza errori.
Correggi: le funzioni read*Hashes in repository.ts devono restituire la coppia
(hash, model_id), e backfillCorpus deve saltare solo se coincidono entrambi.
Non cambiare la firma pubblica di runBackfill. Non toccare gli indici HNSW.
backfillCorpus deve restare testabile senza rete e senza database, come oggi.
Aggiungi due casi al test esistente: stesso testo piu' stesso modello si salta;
stesso testo piu' modello diverso si ri-embedda. Entrambi verdi.

TASK 3 â€” Strumento di misura della copertura
Crea docs/kb/tools/check_embedding_coverage.py seguendo le convenzioni degli
strumenti gia' presenti in quella directory: ri-derivazione dal database vivo, zero
numeri scritti a mano, idempotente.
Per ogni corpus deve riportare: righe sorgente, righe con vettore, righe scoperte,
percentuale, modelli distinti presenti, data del vettore piu' vecchio e piu' recente.
Esce con codice 1 se un corpus e' sotto il 100% o se compare piu' di un modello.
Solo letture. Nessuna dipendenza nuova se puoi evitarla.

TASK 4 â€” Colmare i vettori mancanti â€” FERMATI E CHIEDIMELO
Questo task tocca il database reale e consuma chiamate a pagamento verso Voyage.
Corrisponde al cluster Z-070 che in COWORK_INBOX.md risulta classificato per errore
in corsia sicura. Non eseguirlo insieme agli altri e non eseguirlo di iniziativa.
Quando arrivi qui: fermati, dimmi quanti vettori mancano e quante chiamate servono,
e aspetta un mio ok esplicito che nomini il task 4.
Se te lo autorizzo: lancia il task 3 e riporta i numeri PRIMA, poi
`pnpm embeddings:backfill`, poi di nuovo il task 3 e riporta i numeri DOPO.

VERIFICHE â€” copia l'output esatto, non riassumerlo
I numeri attesi sono stati misurati il 2026-08-06. Se qualcosa diverge, segnala la
divergenza: non allineare l'atteso alla realta' osservata.
1. select 'skills', (select count(*) from sys.sys_skills), (select count(*) from sys.sys_skill_embeddings);
   atteso: skills | 14039 | 14039
2. select 'job_roles', (select count(*) from sys.sys_job_roles), (select count(*) from sys.sys_job_role_embeddings);
   atteso: job_roles | 176 | 137   -> 39 scoperti
3. select 'users', (select count(*) from sys.sys_users), (select count(*) from sys.sys_user_profile_embeddings);
   atteso: users | 163 | 156   -> 7 scoperti
4. select model_id, count(*), min(created_at)::date, max(created_at)::date from sys.sys_skill_embeddings group by 1;
   atteso: un solo modello voyage-4-lite, entrambe le date 2026-06-06
5. pnpm --filter @heuresys/api exec vitest run test/semantic-matching-backfill.test.ts
   atteso: tutti verdi, compresi i due casi nuovi
6. pnpm --filter @heuresys/agent-gateway exec vitest run
   atteso: 6 file, 51 test verdi (nessuna regressione)

DIVIETI
- Non scrivere in docs/kb/SOT_STATE, SOT_BACKLOG, DEBT_REGISTER, STATE.md
- Non eseguire il task 4 senza un mio ok che lo nomini (ripetuto: vedi task 4)
- Non fare push: i commit restano locali finche' non ti dico io
- Non toccare gli indici HNSW: sono corretti, verificati il 2026-08-06
- Non aggiungere strumenti MCP all'agent-gateway: e' materia del ciclo successivo
- Non "migliorare" l'architettura del backfill oltre il task 2. Se vedi un modo
  migliore scrivimelo, non implementarlo
- Non riportare mai valori di segreti: solo il nome della variabile e se e' valorizzata

SE QUALCOSA VA STORTO
Se l'API non parte: raccogli il log, non tentare fix architetturali; dopo 2 tentativi
fermati e dimmelo. Se la ricerca semantica risponde con risultati insensati: non
correggere niente, riportami query e risultati, e' un'informazione non un bug da
chiudere. Se il database non risponde sulla 5433: fermati, e' la fragilita' che il
task 1 deve documentare, non aggirare.

--- FINE PROMPT ---

