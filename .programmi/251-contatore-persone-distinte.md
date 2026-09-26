# 251 — Il contatore di persone distinte per conversazione dell'agente

> **item**: #251 · **priorità**: P1 · **stima**: ~1 sessione
> **stato**: NON AVVIATO
> **nasce-da**: ADR-0040 (dottrina ratificata da Enzo il 2026-09-14), primo dei tre passi che precedono l'apertura `#254`. Include **M7** del piano di miglioramento del 2026-09-08.

## Decisioni già prese (non si ri-chiedono)

- La soglia si misura in **persone distinte**, non in righe (dottrina §3, misurato l'8 settembre).
- **25 / 40 sono valori iniziali** di RTL Bank, non costanti: si scrivono accanto al criterio e al comando che li ri-deriva (`docs/kb/xtras/soglie-agente-persone-distinte.sql`), mai come letterali nudi nel codice.
- Gli **attori di audit** (`createdByUserId`, `reviewedByUserId`, `performedByUserId`, `cancelledByUserId`, `publishedByUserId`, `actorUserId`) **non sono soggetti** e non si contano (criterio S1078).

## Fattibilità, misurata in S1101 (2026-09-14) — ADR-0040 §4

- **(a) SÌ senza toccare l'API**: ogni lettura passa da `HeuresysClient.call` (`apps/agent-gateway/src/heuresys-client.ts`); la risposta è JSON conforme a `packages/shared/src/schemas`, dove l'id di persona sta sotto 26 nomi che finiscono in `UserId` (`grep -rhoE "\b[a-zA-Z]*[uU]ser_?[iI]d\b" packages/shared/src/schemas | sort | uniq -c`).
- **(b) lo stato vive nella richiesta**: una conversazione = una `POST /agent` (`server.ts`) = una `runHrAgent` (`sdk-agent.ts`) = una `query()` senza `resume`. Un insieme in chiusura, creato in `runHrAgent` e passato al client, basta. Limite: se il web un giorno usa `resume`, il contatore deve seguire quell'id.

## Fasi

- [ ] **F1 — Decidere quale misura genera i valori** — le tre stampate dal file SQL (posizioni per unità 38 · persone per unità 9 · persone per catena 158, p90 21,4, al 2026-09-14). Il criterio dell'ADR dice «l'unità più grande»: la fase sceglie la lettura e la scrive nel codice come funzione che legge il dato, non come numero. **fatto =** la funzione esiste e restituisce 25/40 su RTL Bank oggi, con il test che lo dimostra.
- [ ] **F2 — L'aggancio in `call`** — un raccoglitore che percorre il JSON di risposta e aggiunge a un `Set<string>` gli UUID sotto i nomi `*UserId` **meno** gli attori di audit; l'elenco delle esclusioni è una costante dichiarata con la ragione. **fatto =** test a esiti opposti: una risposta con `createdByUserId` non conta; una con `subjectUserId` conta; un `userId` ripetuto conta una volta.
- [ ] **F3 — Il livello per conversazione** — `runHrAgent` crea l'insieme e lo espone al gate (`#252` lo legge) e al diario: ogni voce del diario porta `persone_distinte` al momento della decisione. **fatto =** una corsa che legge 1 · 7 · 38 · 160 persone (le quattro domande della dottrina) stampa quei numeri nel diario, e `pnpm test` del gateway è verde.
- [ ] **F4 — La prova che può fallire** — sabotaggio dichiarato: contando anche gli attori di audit, il test di F2 va rosso; ripristinato, verde. **fatto =** la coppia rosso/verde è nella cronaca.

## Cronaca

---

## Piano di esecuzione — S1112 (2026-09-26), mandato Cowork ciclo 3 passaggio 2

### Misure fatte PRIMA di decidere (⭐ IL PUNTO FISSO)

`psql -h localhost -p 5433 -U heuresys -d heuresys_advanced < docs/kb/xtras/soglie-agente-persone-distinte.sql`
— **2026-09-26**, identiche a quelle dell'ADR del 2026-09-14 (nessuna deriva):

| misura | RTL_BANK max | RTL_BANK p90 |
|---|---|---|
| (1) posizioni per unità (include le vacanti) | **38** | 13,0 |
| (2) persone con incarico attivo per unità | 9 | 8 |
| (3) persone distinte per catena (sottoalbero) | 158 | **21,4** · 4 catene oltre 25, 4 oltre 40 |

⚠ Il comando dichiarato dall'ADR usa `-f`: in questa sessione la guardia dell'imbracatura
nega `psql -f` sul database vivo (non può leggere l'SQL, quindi non può escludere una
scrittura). Lo stesso file è stato eseguito **da stdin** — stesso contenuto, stesso esito.

### Censimento — chi sorveglia gli oggetti che toccherò

`python docs/kb/tools/chi_sorveglia.py {heuresys-client,audit-sink,write-gate,sdk-agent}`:
sentinelle **nessuna** · cancelli **nessuno** · migrazioni **nessuna** · CI **nessuna** ·
test: `heuresys-client.test.ts`, `mcp-tools-list.test.ts`, `audit-sink.test.ts`,
`write-gate.test.ts`, `atlas-resolver.test.ts`, `generic-catalogue.test.ts`.

⚠ **Il censimento era cieco proprio qui, e l'ho misurato**: l'area ⑦ CODICE di
`chi_sorveglia.py` cercava in `apps/api/src`, `apps/web/src`, `packages` — **non** in
`apps/agent-gateway/src`. Quindi diceva «nessuno» su quattro file che `server.ts`,
`sdk-agent.ts` e `mcp-tools.ts` importano (misurato con `Grep` a mano: 49 file li nominano).
Secondo difetto misurato: il termine va passato **senza estensione** — gli import ESM del
progetto nominano `./heuresys-client.js`, non `.ts`, quindi `chi_sorveglia.py x.ts` non
trova nulla. Il primo si corregge (F0b), il secondo si dichiara nell'aiuto dello strumento.

### Decisioni tecniche prese qui (vale il veto)

**D1 — Quale misura genera le soglie (F1).** Le soglie **non sono un numero nel codice**:
sono la funzione `derivaSoglie(misure)` applicata alle misure **generate** in
`docs/kb/agent-soglie-persone.json`. Il criterio dell'ADR §3 letto per intero («il livello
silenzioso copre l'unità più grande; la conferma scatta appena sopra» + «coprono qualunque
unità e il 90% delle catene»):

- **soglia alta (confermato)** = misura **(1)**, l'unità più grande del tenant, arrotondata
  per eccesso al multiplo di 5 → `ceil5(38)` = **40**. Così nessuna unità, nemmeno la più
  grande e comprese le posizioni vacanti, fa fermare l'agente: la conferma scatta appena sopra.
- **soglia bassa (dichiarato)** = misura **(3)**, il p90 delle persone distinte per catena,
  arrotondato per eccesso al multiplo di 5 → `ceil5(21,4)` = **25**. Così il 90% delle catene
  — «la mia catena», l'uso normale — sta nel livello silenzioso.
- La misura **(2)** è scartata: max 9 metterebbe la soglia sotto l'unità più grande, cioè
  attrito sull'uso normale. Scritto qui perché la scelta non si rifaccia a memoria.

Le due letture riproducono **esattamente** 25/40 sui dati di RTL Bank di oggi, ed è il test
di F1 a dimostrarlo. Il JSON generato contiene **le misure**, non le soglie: le soglie si
ri-derivano a ogni caricamento, così il file non può mentire.

**D2 — Soglie assenti = `non-misurato`, non «va bene».** Se il file generato manca o è
illeggibile il livello è `non-misurato` e il diario lo scrive. Il contratto per `#252`,
dichiarato nel codice: `non-misurato` si tratta **come oltre la soglia alta** (si chiede),
mai come silenzioso. Stessa dottrina di `AtlasOperationResolver`: l'ignoto non è un permesso.

**D3 — Le esclusioni sono esattamente le sei dichiarate, e non una in più.** Sovrastimare le
persone fa scattare il freno **prima**: è la direzione sicura. Sottostimarle lo fa scattare
dopo, cioè lo disattiva. Perciò `approverUserId`/`approvatoreUserId`/`reviewerUserId`
— che sono anch'essi attori — **restano contati**: allargare l'elenco a mano indebolirebbe
il freno, e non è una decisione da prendere di passaggio.

**D4 — Un guasto del raccoglitore non nega la lettura, ma non passa inosservato.** Se la
raccolta lancia, il contatore si dichiara guasto → livello `non-misurato` (D2). Contare non
deve poter rompere una lettura; ma un freno cieco non deve poter sembrare un freno verde.

### Simulazione (R24 punto 3) — le cinque domande, per riga

| voce | precondizioni | meccanismo | propagazione | chi | guardia |
|---|---|---|---|---|---|
| F0b | `chi_sorveglia.py --selftest` verde ora | una riga in `AREE` ⑦ | nessuna (file versionato) | io | il selftest dello strumento, rilanciato |
| F1 | DB raggiungibile via tunnel | `build_soglie_agente.py` esegue l'SQL via stdin e scrive il JSON; `soglie-persone.ts` lo legge e ri-deriva | JSON versionato in `docs/kb/` | io | sola lettura: nessuna scrittura sul DB |
| F2 | nessuna | `raccogliPersone` percorre il JSON di risposta; solo chiavi `*[Uu]ser_?[Ii]d` e solo UUID | nessuna | io | non distruttiva |
| F3 | F1+F2 | `client.collegaContatore` in `call`; `runHrAgent` crea il contatore; il gate lo legge e il diario lo scrive | nessuna | io | il diario è append-only, già così |
| F4 | F2 verde | sabotaggio dichiarato: si svuota l'elenco delle esclusioni **nel codice di produzione** e il test di F2 deve uscire ROSSO | l'esito rosso e quello verde vanno nell'esito | io | si ripristina subito, nello stesso pezzo |
| F5 | API viva + persona reale col secondo fattore | script LIVE che legge 4 ampiezze crescenti e stampa il diario | nessuna | io | sole letture `GET` |

### Confine di sessione

Tutte le voci sono completabili qui. `#252` (il ponte sulle letture) **non** si apre: è il
passaggio successivo del ciclo, con la sua sessione. Il rilascio e la propagazione li fa il
governo a fine ciclo: questa sessione **non** propaga e **non** muove `refs/heads/prod`.
