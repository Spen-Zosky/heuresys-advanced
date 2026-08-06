# ADR-0033 — Catalogo di strumenti generici sui metadati di dominio, invece di uno strumento per modulo

**Status**: PROPOSED — subordinato alla misura di §6
**Date**: 2026-08-07
**Author**: CLI session
**Decision authority**: Enzo Spenuso (direzione data 2026-08-07)
**Builds on**: ADR-0021 (tunnel), ADR-0027 (autorizzazione bi-assiale), I5 (mai RLS), I17 (pavimento ESS)
**Non-goal**: questo ADR **non** implementa nulla. Definisce la forma e i criteri per accettarla o respingerla.

---

## §1 — Context

### §1.1 — Il catalogo copre una frazione del dominio

L'agent-gateway espone **17 strumenti in lettura** (più ~18 in scrittura) su
`apps/agent-gateway/src/mcp-tools.ts`. L'atlante rigenerato il 2026-08-07 conta
**95 moduli API e 569 route**: il catalogo vede meno di un quinto della superficie, e
la distanza cresce a ogni modulo nuovo — nell'ultimo mese ne sono comparsi **12**
(`advisor`, `gdpr`, `talent-review`, `time-off`, `whistleblowing`, …), nessuno dei quali
è raggiungibile dall'agente.

### §1.2 — Perché non si colma aggiungendo 78 strumenti

La strada ovvia — uno strumento per modulo — è respinta per tre ragioni misurabili:
il catalogo entra **per intero nel contesto a ogni turno** (costo per chiamata che
cresce linearmente col dominio); la selezione del modello degrada quando le
alternative sono ~95 anziché ~17; e ogni modulo nuovo richiederebbe una mano umana
che colleghi lo strumento, cioè il difetto si ripresenterebbe al modulo 96.

### §1.3 — Il dizionario non si scrive a mano

`docs/kb/atlas/atlas.yaml` mappa già moduli → endpoint → permessi → tabelle → pagine,
e **si rigenera dal codice e dal database vivo**. Un dizionario derivato da lì eredita
quella proprietà: uno schema che cambia rende l'agente capace di vedere le entità nuove
**senza che nessuno colleghi uno strumento**. È questa la ragione architetturale della
scelta, non il risparmio di righe.

---

## §2 — Decision — tre strumenti, non novantacinque

| Strumento | Firma | Cosa fa |
|---|---|---|
| `hrx_concepts_search` | `(query: string, limit?: number)` | Ricerca semantica sui **metadati** di dominio. Ritorna concetti con punteggio, prefisso, permessi richiesti, tabelle. Nessun dato di business. |
| `hrx_concept_describe` | `(conceptId: string)` | Espande un concetto: elenco **chiuso** delle operazioni disponibili (metodo, path, permesso, se è scrittura). |
| `hrx_entity_query` | `(conceptId: string, operationId: string, params?: object)` | Esegue **una** delle operazioni dichiarate da `describe`, via `HeuresysClient` verso `/v1`. |

**Il concetto è il modulo API**, non l'endpoint né la tabella. L'endpoint (569) è troppo
fine e ripetitivo — `GET /` e `GET /:id` dello stesso modulo direbbero quasi la stessa
cosa; la tabella (269) ha nomi poveri e non è ciò che l'agente *chiama*. Il modulo è
l'unità che l'agente deve **scegliere** per poi agire.

### §2.1 — Il percorso: concetto → entità → interrogazione

1. L'utente chiede in linguaggio naturale → `hrx_concepts_search` restituisce i moduli
   candidati **con i permessi che richiedono**, così il modello sa già cosa servirà.
2. `hrx_concept_describe` sul candidato scelto → l'elenco chiuso delle operazioni.
3. `hrx_entity_query` esegue l'operazione **per identificatore**, non per URL.

Tre giri invece di uno: è il costo dichiarato della scelta, ed è la ragione per cui i
17 strumenti attuali **non vengono ritirati** (§4).

---

## §3 — Security — il vincolo non negoziabile, e come è soddisfatto

**Lo strumento che interroga non fa SQL.** Non è un vincolo nuovo da inventare: è già
il modo in cui funziona il catalogo attuale — ogni strumento passa da
`HeuresysClient.call()` verso `/v1` **con la sessione del chiamante inoltrata**, e i
permessi li applica il server con `requirePermission`. Il catalogo generico riusa
esattamente quel client. Un catalogo che aggirasse il gate RBAC trasformerebbe il
punto di forza della piattaforma in una falla.

**Secondo vincolo, aggiunto qui**: `hrx_entity_query` accetta un **`operationId`**, non
un path. L'agente non compone URL: sceglie da un elenco chiuso derivato dall'atlante.
Un parametro `path: string` libero sarebbe l'equivalente HTTP dell'SQL diretto — la
superficie che il vincolo intende chiudere si riaprirebbe dalla porta accanto.

**Terzo**: `hrx_concepts_search` ritorna **solo metadati** (nomi di modulo, permessi,
tabelle). Nessun dato di business attraversa la ricerca semantica, quindi il recupero
non può diventare un canale di fuga: per leggere un dato bisogna passare da
`hrx_entity_query`, cioè dal server e dai suoi permessi.

---

## §4 — Cosa succede ai 17 strumenti attuali: **convivono**

Non migrano e non vengono ritirati. Tre ragioni:

- **Sono verificati.** 51 test verdi coprono quel percorso; sostituirli con un generico
  non ancora misurato scambierebbe una certezza per una promessa.
- **Costano meno.** Un percorso caldo noto si chiude in **un** giro; il generico ne
  chiede tre. Per «elenca le unità organizzative» il generico è più lento e più caro.
- **Hanno firme precise.** `hrx_tenant_materialize(tenantId, archetypeKey, mode)` porta
  una semantica che nessuna firma generica esprime.

Il generico copre la **coda lunga** — i 78 moduli senza strumento — non i percorsi già
serviti. Se col tempo l'uso mostrasse che alcuni dei 17 sono ridondanti, si ritireranno
uno alla volta con la misura davanti, non per simmetria.

---

## §5 — Open problems — dichiarati, non risolti con scorciatoie

**§5.1 — L'atlante non conosce i parametri** — ✅ **RISOLTO il 2026-08-07.**

L'atlante porta ora, per ogni route, la **forma** di `querystring`, `params` e `body`:
nome dello schema, campi, tipo, opzionalità, `format` (es. `uuid`) e **valori ammessi
degli enum** — quest'ultimo è ciò che impedisce all'agente di inventare uno stato che il
server rifiuterebbe. Esempio reale su `GET /v1/positions`: `criticality` con
`CRITICAL|HIGH|MEDIUM|LOW`, `organizationUnitId` string/uuid, `limit` e `offset`.

**Estratto a runtime, non con una regex** (`docs/kb/tools/dump_route_schemas.ts`, invocato
da `build_atlas.py`): gli schemi compongono — `.optional()`, `.extend()`, riferimenti
incrociati, `z.coerce` — e una regex li leggerebbe male proprio nei casi che contano.
L'autorità sulla forma è Zod, quindi ciò che l'atlante dichiara è ciò che il server
accetterà davvero. Degrada come `--no-db`: se `tsx` manca, l'atlante esce senza i
parametri anziché non uscire (`--no-schemas` per saltarlo di proposito).

**Copertura misurata**: 569 route, **478 dichiarano parametri (84%)** — le altre non ne
hanno; **555 blocchi parametro, 555 risolti (100%), 0 irrisolti**.

Due casi limite sono rappresentati per quello che sono, invece di essere nascosti sotto
«irrisolto»: uno schema **vuoto** (`z.strictObject({})`, due route MFA) esce come
`fields: []`, che dice *«non mandare nulla»* — l'opposto di *«non so cosa mandare»*; e le
**tre route** che dichiarano lo schema **inline** (`params: z.object({ id: z.uuid() })`)
escono come `schema: (inline)` con la dichiarazione grezza accanto, perché fingere di
averla risolta sarebbe peggio che dichiararla.

L'idempotenza dello strumento — proprietà su cui l'atlante si regge — è stata **ri-provata
dopo la modifica**: due esecuzioni consecutive producono file identici.

**Resta fuori**: la forma della **risposta**. Sapere cosa torna aiuterebbe l'agente, ma
§5.1 riguarda ciò che il chiamante deve **mandare**; allargarlo qui sarebbe scope creep.

**§5.2 — Il gate HITL classifica per NOME dello strumento.** `mcp-tool-names.ts`
distingue lettura e scrittura per elenco di nomi. Con un solo `hrx_entity_query`
generico quel criterio **smette di funzionare**: il nome non dice più se l'operazione
scrive. Il gate dovrà decidere sul **metodo HTTP dell'operazione risolta**, il che
sposta la classificazione da statica a dinamica — cioè tocca il punto più delicato
dell'impianto di sicurezza. Va progettato a parte, con i suoi test, prima che un solo
strumento generico venga collegato.

**§5.3 — Dove vivono i vettori dei concetti.** Il corpus è piccolo (95 voci): può stare
in memoria e ricostruirsi all'avvio, oppure in tabella. La scelta dipende dall'esito di
§6 e non si anticipa.

**§5.4 — La lingua del corpus.** I testi dei concetti sono derivati da nomi di moduli e
tabelle, che sono **in inglese**; le domande degli utenti sono in italiano.
**Misurato (§6): non è il collo di bottiglia.** Il modello multilingue attraversa il
divario — `whistleblowing` esce a **0.4911** su *«segnalazioni anonime»* e
`training-initiatives` a **0.4322** su *«corsi di formazione»*, senza che una sola parola
italiana compaia nei loro testi. Resta però la ragione per cui i punteggi assoluti sono
bassi in valore (0.27-0.49): sono utili come **ordinamento**, non come soglia. Un
eventuale filtro «sotto X non rispondere» non va tarato su questi numeri.

**§5.5 — Le domande di aggregazione non hanno un concetto** *(emerso dalla misura)*.
«Quante persone lavorano nella direzione crediti» non ha un modulo che la nomini: è una
**interrogazione**, non un dominio. Servirà uno strato che, scelto il concetto, sappia
comporre il calcolo — ed è lo stesso strato che §5.1 richiede per i parametri. Finché non
esiste, il catalogo generico sa dire *dove guardare*, non *quanto fa*.

---

## §6 — Criteria that close this ADR

Questo ADR è `PROPOSED` e **si chiude solo con una misura**, non con un'opinione:

1. **Recupero** — ✅ **MISURATO il 2026-08-07: passa, con due mancati istruttivi.**
   Dieci domande italiane da direttore del personale, scritte guardando il mestiere e
   **non** il corpus, con l'atteso dichiarato **prima** di vedere i risultati.

   **Metro grezzo: 6/10 nei primi 3** (7/10 nei primi 5).
   **Metro corretto: 8/10**, e la correzione va spiegata perché è avvenuta *dopo* aver
   visto i risultati: otto dei nomi che avevo dichiarato attesi — `skill-gaps`,
   `learning`, `okr`, `attendance`, `evaluations`, `inbox`, … — **non esistono come
   moduli**. Non è stato cambiato il criterio («il concetto giusto è nei primi 3?»), è
   stato corretto un errore di fatto nel metro. Entrambi i numeri restano agli atti.

   Due domande dove **il recupero ha battuto il mio atteso**:
   - *«chi può sostituire il responsabile della filiale di Brescia»* → ha restituito
     `successor-readiness` **0.4075**, `successor-candidates` 0.3945, `succession-pools`
     0.3749. Io mi aspettavo `career-paths`. I suoi sono migliori.
   - *«quali corsi di formazione deve fare chi lavora in filiale»* → `training-initiatives`
     **0.4322** al primo posto, che è esattamente il modulo dei corsi. Il mio atteso
     nominava un modulo `learning` che non esiste.

   **I due mancati veri hanno la stessa natura, e conta più del punteggio**:
   *«quali competenze mancano di più in azienda»* (`skills` fuori dai primi 5) e
   *«quante persone lavorano nella direzione crediti»* (`organization-units`, `positions`
   e `users` tutti fuori). Entrambe chiedono un **calcolo su dati**, non
   l'identificazione di un dominio. La ricerca sui metadati recupera **il dominio**, non
   **l'aggregazione**: i testi dei concetti descrivono *di cosa si occupa un modulo*, non
   *quali domande sa rispondere*. Nessun aggiustamento del corpus è stato tentato — il
   corpus resta quello derivato meccanicamente.

   **Conseguenza per l'architettura**: `hrx_concepts_search` è adeguato a **instradare
   verso il dominio**. Non è adeguato, da solo, a rispondere a domande di aggregazione, e
   l'ADR non deve promettere che lo sia.
2. **§5.1 risolto** — ✅ **fatto il 2026-08-07**: l'atlante espone i parametri di tutte
   le 478 route che ne hanno, 555 blocchi su 555 risolti.
3. **§5.2 risolto**: il gate classifica scrittura/lettura per metodo risolto, con test
   che lo dimostrano su un'operazione di scrittura. **APERTO.**

Finché **3** è aperto, **nessuno strumento generico viene collegato al gateway**. È
rimasto l'unico sbarramento, ed è quello giusto: riguarda l'applicazione dei permessi,
non la comodità dell'agente.

---

## §7 — What we are NOT doing

- **Non** si aggiungono strumenti per i 78 moduli scoperti (§1.2).
- **Non** si dà all'agente SQL, né diretto né mascherato da «query libera» (§3).
- **Non** si accetta un parametro `path` libero: sarebbe l'SQL diretto travestito (§3).
- **Non** si ritirano i 17 strumenti attuali (§4).
- **Non** si implementa nulla in questo ciclo: questo è un documento (§6 lo vincola).
- **Non** si tocca `MATCHING_FREETEXT_ENABLED`, né il modello `voyage-4-lite`, né gli
  indici HNSW.
