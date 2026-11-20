# Faldone dell'Utente: censimento e progetto della «mega API» (2026-11-18)

Richiesta di Enzo (2026-11-18): un'API che intercetti e presenti tutti i dati di una singola persona, senza esclusione alcuna, diretti e collegati, come base per progettare il Faldone dell'Utente (la pagina individuale con la storia anagrafica e professionale dalla A alla Z). Va usata anche dagli agenti.

## Il censimento, misurato

Comando (sola lettura: viste temporanee in una transazione che finisce in ROLLBACK): `psql -X -A -F $'\t' -f db/scripts/faldone/censimento.sql heuresys_advanced`. Per una persona: `psql -X -A -F $'\t' -v uid=<uuid> -f db/scripts/faldone/censimento-persona.sql heuresys_advanced` (serve un ruolo che legga tutto lo schema `sys`).

Esito sulla produzione, 2026-11-18 02:28 UTC, PostgreSQL 16.16:

| livello | che cosa | tabelle | colonne |
|---|---|---|---|
| L0 | la persona (`sys.sys_users`) | 1 | 14 |
| L1 | tabelle con una chiave esterna verso la persona (dato diretto) | 159 | 2.152 |
| L2 | tabelle figlie di una tabella L1 (dato collegato) | 40 | 397 |
| R | tabelle di decodifica riferite da L1/L2 (nomi di posizioni, unità, competenze) | 25 | 254 |
| totale | | 225 | 2.817 |

La stima di Enzo («più di 300») regge di un ordine di grandezza: i campi della persona e dei suoi dati diretti e collegati sono 2.563 (14 + 2.152 + 397), più 254 colonne di decodifica.

Due osservazioni dal censimento che hanno deciso il progetto:

- Delle chiavi esterne verso la persona, 117 sono `created_by` (61) e `updated_by` (56): dicono chi ha scritto una riga, non di chi parla. Per questo ogni legame è classificato `soggetto` (la riga parla della persona) o `relazione` (la persona vi compare per ciò che ha fatto: autrice, approvatrice, valutatrice, responsabile).
- 87 colonne sembrano puntare a una persona senza chiave esterna. Quelle che sono uuid e puntano davvero a una persona entrano come legami impliciti; le altre sono escluse una per una con la ragione scritta (`IMPLICITI_ESCLUSI` in `apps/api/src/modules/faldone/classi.ts`): testo invece di identificativo, date, chiavi interne, archivi di catalogo.

Il conteggio per singola persona non si è potuto misurare dal ruolo di sola lettura della VM, che non vede 279 tabelle `sys`: si misura dal vivo attraverso l'API stessa, dopo il rilascio.

## Il progetto

### Catalogo letto dal database, classificazione scritta a mano

Il servizio legge all'avvio da `pg_catalog` tutte le chiavi esterne a colonna singola verso `sys.sys_users` (sezioni dirette), aggiunge i legami impliciti dichiarati, e le tabelle figlie dei legami `soggetto` (sezioni collegate). La parte scritta a mano (`classi.ts`) è solo ciò che il database non sa dire: classe di dati, capitolo, titolo in italiano, sfera privata, legame soggetto. Il cricchetto `apps/api/test/faldone.integration.test.ts` diventa rosso se una tabella legata alla persona non ha la sua classificazione: «senza esclusione» vale anche per le tabelle di domani.

### Le rotte

| rotta | permesso | che cosa |
|---|---|---|
| `GET /v1/faldone/:userId` | `user:read`, catena organizzativa | indice: ogni sezione con capitolo, classe, righe, colonne, visibilità |
| `GET /v1/faldone/:userId/sezioni/:sezione?limit&offset` | come sopra | le righe di una sezione, a pagine (al più 500), con le etichette leggibili dei riferimenti |
| `GET /v1/faldone/:userId/completo?righePerSezione` | come sopra | indice e righe di ogni sezione con dati, troncatura dichiarata: per gli agenti |
| `GET /v1/me/faldone`, `/v1/me/faldone/sezioni/:sezione`, `/v1/me/faldone/completo` | `user_profile:read:self` | lo stesso, per sé stessi |

### L'accesso: le regole del dossier, sezione per sezione

Chi non può leggere la persona riceve 404. Per ogni sezione la classe decide:

| classe o sfera | in chiaro a | agli altri |
|---|---|---|
| PERSONAL, sfera privata (indirizzi, banca, familiari, documenti, istruzione, dati demografici) | sé stessi, mandati HR, perimetro mascherato, piattaforma | {omissis} |
| COMPENSATION | come il dossier: maschera per mandato tecnico, DPO, retribuzione di un vertice, conferma del secondo fattore mancante | {omissis} |
| EVALUATION | come il dossier | {omissis} |
| CREDENTIAL | sé stessi e piattaforma | {omissis} |
| SPECIAL_CATEGORY e questionari di clima | solo sé stessi | {omissis} |
| segreti (hash, token, chiavi) | nessuno | {omissis} sempre |
| legame `relazione` | chiave, legame, date e stato | il contenuto si apre dalla pagina di quell'oggetto, con i suoi permessi |

{omissis} è un valore dichiarato: il campo resta nella riga con la stringa `{omissis}`, e la sezione dice quali campi e perché. Ciò che è {omissis} non si legge nemmeno dal database. È la stessa forma che usa l'assistente di pagina.

### Prestazioni

L'indice conta le righe di tutte le sezioni con poche query composte (blocchi da 60 rami). Le sezioni si leggono a pagine. Il completo legge le sezioni con dati a gruppi di otto in parallelo. I nomi di tabella e colonna nel SQL vengono solo dal catalogo di sistema e sono quotati; i valori viaggiano come parametri.

### Fuori da questo ciclo

La pagina del Faldone nel frontend (si progetta su questa API), lo strumento dell'assistente che la legge (thread «Rifare l'assistente di pagina come Claude Desktop»).
