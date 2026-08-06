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

**§5.1 — L'atlante non conosce i parametri.** Conosce metodo, path, permesso; **non**
lo schema dei parametri (query string, corpo). `hrx_concept_describe` può dire
«`GET /v1/positions` esiste», non «accetta `?tenantId=&limit=`». Senza questo, l'agente
indovina — e indovinare su una scrittura è inaccettabile. La sede naturale del rimedio
sono gli schemi Zod di `@heuresys/shared`, già per-modulo: andrebbero derivati
nell'atlante. **Non è risolto in questo ADR.**

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
tabelle, che sono **in inglese**; le domande degli utenti sono in italiano. Il modello è
multilingue, ma il divario è reale e §6 lo misura invece di assumerlo risolto.

---

## §6 — Criteria that close this ADR

Questo ADR è `PROPOSED` e **si chiude solo con una misura**, non con un'opinione:

1. **Recupero**: su 10 domande italiane reali, non costruite sul corpus, il concetto
   giusto compare fra i primi 3 in una quota che regga un'architettura. Se il recupero
   è mediocre, l'ADR va **respinto** o ristretto: un no misurato oggi vale settimane.
2. **§5.1 risolto**: l'atlante espone i parametri, o `hrx_entity_query` resta limitato
   alle sole letture senza parametri.
3. **§5.2 risolto**: il gate classifica scrittura/lettura per metodo risolto, con test
   che lo dimostrano su un'operazione di scrittura.

Finché 2 e 3 sono aperti, **nessuno strumento generico viene collegato al gateway**.

---

## §7 — What we are NOT doing

- **Non** si aggiungono strumenti per i 78 moduli scoperti (§1.2).
- **Non** si dà all'agente SQL, né diretto né mascherato da «query libera» (§3).
- **Non** si accetta un parametro `path` libero: sarebbe l'SQL diretto travestito (§3).
- **Non** si ritirano i 17 strumenti attuali (§4).
- **Non** si implementa nulla in questo ciclo: questo è un documento (§6 lo vincola).
- **Non** si tocca `MATCHING_FREETEXT_ENABLED`, né il modello `voyage-4-lite`, né gli
  indici HNSW.
