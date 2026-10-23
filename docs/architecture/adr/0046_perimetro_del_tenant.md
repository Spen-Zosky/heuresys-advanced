# ADR-0046 — Il perimetro del tenant: ricerche, liste di scelta e agente leggono solo dentro il fascicolo

- **Status**: ACCETTATO il 2026-10-23 da Enzo Spenuso (approvazione data in chat alle 15:19 UTC, 17:19 ora di Roma, con le raccomandazioni del riepilogo del mattino)
- **Date**: 2026-10-17
- **Decided by**: Enzo Spenuso, 2026-10-23
- **Redatto da**: Claude Code CLI, mandato PE-6.1 (onda 2 del piano di adesione completa, passo S4 della separazione)
- **Attua**: ADR-0043, regole 2, 4 e 5, passo S4
- **Relates to**: ADR-0039 (profilo del cliente sopra il catalogo; regola 4, prima frase), ADR-0040 (l'agente legge ciò che legge la persona), ADR-0041 (direzione del dato), ADR-0042 (la piattaforma genera, il cliente possiede), invariante I5 (isolamento per tenant nel middleware, mai RLS), I21 come emendato da ADR-0043
- **Poggia su**: `apps/api/src/lib/scope/gate.ts` (asse del catalogo, `RISORSE_DI_CATALOGO`), `apps/api/src/lib/scope/profilo.ts` (risoluzione del profilo per codice), `D:\heuresys-datastore\src\contratto\v0.3\` (sezione `perimetro` del pacchetto, vocabolario `schemaCatalogo`), `.programmi/esiti-onda0/CENSIMENTO_separazione.md` (lettori dei cataloghi)

> **In parole semplici.**
> 1. Oggi solo i ruoli professionali e i cruscotti sono filtrati sul profilo del cliente; competenze, indicatori, professioni, corsi e le altre liste mostrano a ogni tenant il catalogo intero.
> 2. Con il pacchetto v0.3 arriva dal datastore il perimetro del tenant: l'elenco di tutte le voci di catalogo che appartengono al suo tipo d'impresa, anche quelle non ancora usate.
> 3. Questa decisione fa passare dal perimetro ogni lettura di catalogo: elenchi, ricerche, ricerca per significato, liste di scelta delle schermate e l'agente. Un tenant vede il suo perimetro più le voci che si è creato da sé.
> 4. Anche le scritture si fermano al perimetro: chi prova ad assegnare a una persona una competenza fuori perimetro riceve un rifiuto che spiega di chiederla alla piattaforma.
> 5. Finché un tenant non ha ricevuto il suo perimetro (RTL Bank oggi), le letture restano come sono: niente si restringe prima che il perimetro esista. La commutazione di RTL Bank è dell'onda 3 (passo S5).

> I **conteggi non stanno in questo documento**: si ri-derivano con i comandi del censimento (`.programmi/esiti-onda0/lavoro/censimento_query.sql`) e con le prove elencate in fondo.

---

## Contesto

ADR-0043 ha deciso che il fascicolo è il perimetro del tenant e ha fissato l'ordine: S3 parità nel datastore (onda 1), S4 perimetro in advanced (onda 2), S5 commutazione e S6 ritiro (onda 3). Il passo S4 chiede tre cose: che il caricatore scriva il perimetro insieme al fascicolo, che ogni lettura per un tenant passi dal perimetro più le voci proprie, e che il cancello di avvio dell'asse del catalogo si estenda a tutte le risorse del censimento.

Oggi in advanced:

- l'asse del catalogo del cancello (`gate.ts`) governa quattro risorse RBAC (`job_role`, `blueprint`, `enterprise_typing`, `operating_model`) con quattro dichiarazioni (`profile`, `platform`, `open`, `tenant`); le dichiarazioni nel codice si contano con `grep -rn "catalogGate:" apps/api/src/modules | awk -F'catalogGate:' '{print $2}' | sort | uniq -c`;
- `profilo.ts` risolve per codice, lungo la catena attivazione ACTIVE → versione PUBLISHED → `sys_blueprint_content_<dominio>`, due soli domini (`job_roles`, `dashboards`), ed è fail-closed: un tenant senza attivazione ha profilo vuoto;
- i lettori del catalogo intero sono molti (il censimento ne elenca, fra gli altri, `skills`, `semantic-matching`, `capability-composition`, `kpi-definitions`, `learning-modules`, `positions`, `analytics`, `public-stats`, `occupation-classifications`, `activity-classifications`, `compensation`);
- l'agente non ha un accesso proprio ai dati: per ADR-0040 legge attraverso le rotte `/v1/*` con i permessi della persona, e le sue operazioni sono generate da `docs/kb/tools/build_agent_operations.py` a partire da `docs/kb/agent-perimetri.json`.

Il pacchetto v0.3 porta la sezione `perimetro` (R48, R49): una riga per voce di catalogo, con `schema` (vocabolario `schemaCatalogo`: `CP2021`, `ISCO_08`, `ESCO_OCCUPAZIONE`, `ESCO_COMPETENZA`, `APQC_PCF`, `ATECO_2025`, `NACE_2_1`, `CCNL_CNEL`, `INDICATORE_DATASTORE`, `ALTRO`), codice, URI, nome, `usataDalModello`, e la versione del fascicolo con quella che estende.

## Decisione

> **Ogni lettura di catalogo fatta per un tenant restituisce le voci del suo perimetro più le sue voci proprie, mai il catalogo intero; ogni scrittura che cita una voce di catalogo la accetta solo se sta nel perimetro o è propria. Il perimetro arriva solo dal fascicolo e si risolve dalla versione attiva, senza copia per tenant. Finché un tenant non ha ricevuto un perimetro, le sue letture restano quelle di oggi, e lo stato è misurato.**

### 1. Dove sta il perimetro

- Il perimetro appartiene alla **versione del modello**, come il resto del contenuto: tabella di piattaforma `sys.sys_blueprint_content_perimeters` (senza `tenant_id`, come le altre `sys_blueprint_content_*`; disegno in `.programmi/onda2/DISEGNO_tabelle-onda2.md`, tabella M1.14), scritta solo dal caricatore del pacchetto.
- Il perimetro **di un tenant** è quello della versione fissata dalle sue attivazioni ACTIVE nella finestra di validità (ADR-0047, punto 5); dove l'attivazione non fissa una versione vale, in via transitoria, la regola di oggi, cioè l'unione dei perimetri delle versioni PUBLISHED della variante, la stessa catena che `profilo.ts` percorre già. Formulazione approvata il 2026-10-23. Non si copia in una tabella del tenant: quando la versione attiva cambia, il perimetro cambia nello stesso istante, senza una seconda verità da riallineare.
- Il pacchetto dichiara se il perimetro c'è: colonna `blueprint_content_package_perimeter_status` (`DICHIARATO` | `NON_RILASCIATO`, disegno M1.1). Un pacchetto convertito con la sezione `perimetro` dichiarata vuota vale `NON_RILASCIATO`, non «perimetro vuoto».

### 2. Lo stato del tenant e la transizione

Un tenant è in uno di due stati, ricavati e mai scritti a mano:

| stato | quando | letture di catalogo |
|---|---|---|
| `PERIMETRO` | almeno un'attivazione ACTIVE ha un pacchetto con perimetro `DICHIARATO` | perimetro + voci proprie, fail-closed |
| `TRANSITORIO` | nessuna attivazione ACTIVE ha un perimetro dichiarato | come oggi: profilo per `job_role` e cruscotti (fail-closed, invariato), catalogo intero per le altre risorse |

Il ramo `TRANSITORIO` è **dichiarato nel codice con la sua data di fine**: si toglie al passo S5 (onda 3), quando RTL Bank riceve il perimetro; da lì un tenant senza perimetro vede solo le sue voci proprie, come già fa `profilo.ts`. Un controllo in `docs/kb/tools/` (`check_perimetro_tenant.py`, nuovo) elenca i tenant in `TRANSITORIO`: è un elenco informativo e non una sentinella `sys.v_*`, perché oggi RTL Bank e HEURESYS sono entrambi in quello stato e una sentinella sarebbe rossa per costruzione.

La ragione di questa scelta: nessuna lettura di oggi si restringe prima che il datastore abbia rilasciato il perimetro (ADR-0043: «niente si commuta prima che il datastore abbia tutto»).

### 3. Il risolutore unico

- Nasce `apps/api/src/lib/scope/perimetro.ts`, che generalizza `profilo.ts`: `risolviPerimetro(db, actor, catalogo)` restituisce `{ tipo: "tutto" }` (solo `PLATFORM_ADMIN`, fino a S6), `{ tipo: "transitorio" }`, oppure `{ tipo: "perimetro", chiavi, tenantId }`.
- I cataloghi sono un **insieme chiuso** in una mappa dichiarata (catalogo → tabella, colonna della chiave naturale, colonna del tenant se esiste, schema del perimetro), sul modello di `CONTENUTO` in `profilo.ts`; nessun nome di tabella arriva dall'input.
- Si risolve **per chiave naturale** (URI ESCO per competenze e professioni, codice per indicatori, ATECO, NACE, CP2021, CCNL), mai per uuid: il fascicolo nomina le voci per codice (stessa ragione della migrazione 000327).
- La forma della query è una sola, in ogni repository: `WHERE (c.<tenant> = $tenant) OR (c.<tenant> IS NULL AND c.<chiave> = ANY($chiavi))`. Per i cataloghi senza colonna del tenant manca il primo ramo, e il tenant non vi può creare voci proprie (dichiarato, non è un difetto di questo ADR).
- `profilo.ts` resta per i cruscotti; i ruoli (`job_roles`) passano al perimetro quando il pacchetto porta lo schema dei ruoli (contratto v0.3, sezione `ruoli`); fino ad allora per i ruoli vale il profilo, che è già un perimetro più stretto.

### 4. Il cancello di avvio

- La dichiarazione `profile` si rinomina `perimeter`, con lo stesso significato allargato; per una versione resta accettato `profile` come sinonimo, poi il cancello lo rifiuta.
- `RISORSE_DI_CATALOGO` si estende dalle quattro risorse di oggi a tutte quelle del censimento. L'elenco esatto delle risorse RBAC lo misura la sessione O2-07 sulle rotte di lettura (oggi i moduli di catalogo usano, fra le altre, `skill`, `skill_taxonomy`, `skill_alias`, `job_family`, `kpi`, `learning`, `occupation_classification`, `process_kpi_template`, `organization_unit_kpi_template`, `compensation_intelligence`, `matching`, `capability`): una risorsa aggiunta rende rosse le sue rotte finché non dichiarano, che è il punto.
- Dichiarazioni ammesse su una rotta di catalogo dopo questo ADR: `perimeter`, `tenant`, `platform` (solo se la rotta è ristretta a `PLATFORM_ADMIN`, verificato dal cancello sul permesso), `open` (con la ragione scritta accanto, solo per tassonomie che servono prima del perimetro, per esempio la scelta del settore alla nascita di un tenant). Dopo S6 `platform` e `open` su un catalogo di dominio fanno fallire l'avvio, come ADR-0043 dice già.
- Le rotte di **scrittura** che accettano un riferimento a una voce di catalogo (per esempio una competenza su una persona, un ruolo su una posizione, un indicatore su un obiettivo) dichiarano `catalogRef: "perimeter"` e validano il riferimento con lo stesso risolutore. Una voce fuori perimetro risponde `422` con codice `FUORI_PERIMETRO` e il testo che invita a chiederla alla piattaforma (R49). Un tenant in `TRANSITORIO` non riceve questo rifiuto.

### 5. Ricerche e ricerca per significato

- La ricerca testuale e la ricerca per significato restringono l'insieme dei candidati **prima** dell'ordinamento: il filtro sta nel `WHERE` della stessa query che ordina per distanza, mai a valle sui primi k risultati. Un filtro a valle restituirebbe meno risultati del dovuto e farebbe trapelare quanti sono fuori perimetro.
- Il confronto avviene solo fra vettori del perimetro e vettori del tenant (regola 5 di ADR-0043). Se il piano di esecuzione di una ricerca peggiora oltre misura, il rimedio è un indice adatto, misurato con `EXPLAIN (ANALYZE)` sul gemello, non il ritorno al filtro a valle.

### 6. Liste di scelta

Le liste di scelta delle schermate (`apps/web`) leggono solo da rotte `/v1/*` dichiarate `perimeter` o `tenant`. Il controllo è statico: un nuovo controllo in `docs/kb/tools/` diventa rosso se un componente di scelta chiama una rotta dichiarata `platform` fuori dalle pagine di piattaforma. Nessuna lista di scelta tiene un elenco scritto nel codice del frontend (regola dei dati vivi, `.claude/rules/frontend-live-data.md`).

### 7. L'agente

- L'agente eredita il perimetro perché legge con le rotte della persona (ADR-0040): non c'è una strada sua.
- `build_agent_operations.py` rifiuta di generare un'operazione su una rotta di catalogo dichiarata `platform` o `open`, e il controllo `check_concetti_agente.py` lo mostra in rosso. Gli strumenti dell'agente che cercano per significato chiamano la stessa rotta di ricerca del punto 5.
- Il contesto che il gateway passa al modello non contiene elenchi di catalogo copiati: solo ciò che le rotte restituiscono alla persona.

### 8. Che cosa non è perimetro

- I cataloghi del prodotto advanced (permessi, ruoli di accesso, interfacce, classi di dato, campi traducibili, mappa GDPR, direzione del dato): restano fuori dall'asse del catalogo (ADR-0043, «Che cosa resta in advanced»).
- `public-stats` pubblica numeri della piattaforma: resta `platform` con la ragione scritta e la decisione rimandata a S6, come ADR-0043 prevede.
- I dati del tenant (righe con la colonna del tenant valorizzata) non passano dal perimetro: li governa l'asse del tenant (I5).

## Opzioni scartate

- **Row-Level Security di PostgreSQL sui cataloghi.** Scartata: I5 la esclude, e il perimetro dipende dalla catena delle attivazioni, che è logica applicativa.
- **Copia del perimetro in una tabella del tenant all'attivazione.** Scartata: una seconda verità da tenere allineata a ogni cambio di versione; la catena delle attivazioni esiste già e cambia in modo atomico.
- **Filtro nel frontend o a valle della query.** Scartata: l'API e l'agente lo aggirerebbero, e la paginazione e i conteggi sarebbero falsi.
- **Un filtro scritto a mano in ogni repository, senza cancello.** Scartata: le rotte nuove nascerebbero senza filtro e nessuno se ne accorgerebbe; il cancello di avvio esiste per questo.
- **Fail-closed subito per tutti i cataloghi.** Scartata: RTL Bank non ha ancora il perimetro (arriva con S5), e perderebbe da un giorno all'altro competenze, indicatori e corsi che usa. Il ramo transitorio ha una data di fine dichiarata.
- **Perimetro assente uguale a catalogo intero, per sempre.** Scartata: contraddice la regola 2 di ADR-0043 proprio dove nessuno ha configurato il tenant.
- **Leggere il perimetro dal database del datastore a ogni richiesta.** Scartata per la stessa ragione di ADR-0043: lega la disponibilità di advanced a quella del datastore.

## Conseguenze

- Per un utente di un tenant con perimetro: elenchi, ricerche, liste di scelta e risposte dell'agente mostrano solo il suo tipo d'impresa e le voci proprie; una voce fuori perimetro chiesta per identificativo risponde `404`, come oggi fa il profilo dei ruoli, per non rivelare che esiste.
- Per chi sviluppa: ogni rotta di catalogo nuova deve dichiarare; ogni repository di catalogo usa il risolutore; i test di integrazione hanno bisogno di un tenant di prova con perimetro dichiarato (costruito nel test, mai scritto a mano nei dati).
- Per RTL Bank oggi: nessun cambiamento visibile finché resta `TRANSITORIO`.
- Costo: dentro l'onda 2, due sessioni (O2-07 e O2-08 in `.programmi/onda2/README.md`).
- Rischio principale: una lettura di catalogo che non porta il permesso di una risorsa dichiarata e sfugge al cancello. Lo coprono la misura del passo S5 sul diario delle query (ADR-0043) e la regola che il cancello conta le rotte per risorsa.

## Come si verifica che sia fatto

Le prove devono poter fallire: ognuna si mostra rossa prima del cambio.

1. Su una copia usa-e-getta del gemello, con un perimetro di prova caricato per un tenant: `/v1/skills`, `/v1/kpi-definitions`, la ricerca per significato e `/v1/job-roles` restituiscono solo voci del perimetro e voci proprie; prima del cambio restituivano voci fuori perimetro.
2. Lo stesso tenant, con l'attivazione portata a una versione senza perimetro dichiarato, torna al comportamento di oggi (`TRANSITORIO`), e `check_perimetro_tenant.py` lo elenca.
3. Una scrittura con una competenza fuori perimetro risponde `422 FUORI_PERIMETRO`; con una competenza del perimetro risponde come oggi.
4. Il cancello di avvio fallisce se una rotta di una risorsa di `RISORSE_DI_CATALOGO` non dichiara, o dichiara `platform` senza la restrizione a `PLATFORM_ADMIN` (prova di mutazione nel test del cancello).
5. `build_agent_operations.py` rifiuta un'operazione costruita apposta su una rotta `platform`.
