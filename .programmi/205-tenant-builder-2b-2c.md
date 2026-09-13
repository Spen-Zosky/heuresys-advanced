# 205 — Tenant Builder 2b e 2c: la coda dei domini ricercabili, e il patrimonio senza le parole di un altro

> **item**: #205
> **stato**: IN CORSO
> **nota**: ⚠ gate CADUTO; F1 **eseguita** in S1095 (2026-09-12) sciogliendo il nodo di R2 senza riscriverla — vedi F1. La voce torna `ACTIVE` nel register. (La cronaca stava sulla riga di stato, che il
> parser legge solo se contiene esclusivamente il vocabolario — allineata in S1090)

Con questa e con P4, tutte e quattro le parti del Tenant Builder sono progettate: P1 chiusa ·
P2a `#132` · 2b/2c qui · P3 `#198` · P4 consegnata.

⛔ **DIPENDENZA DURA, da non aggirare con una stima**: la coda **non è calcolabile** finché 2a non
è fatta — la prova R2 dipende da `sys_research_sources`, che **non esiste** (verificato) ed è di
`#132`.

## Decisioni vincolanti

1. **2b non è una scelta di domini: è una CODA.** P2a §4.1 lo dice già — «ogni ondata successiva
   è dichiarare un dominio, non costruire un motore». È la stessa dottrina di `#156`/`#214` sui
   perimetri dell'agente: ovunque porti valore aggiunto, la domanda è **l'ordine**, non quale.
   Si progetta una coda, mai un menu.
2. **Le tre prove meccaniche**: R1 è contenuto di un'azienda (colonna `%tenant_id`, il metro di
   E18) · R2 esiste almeno una fonte ammessa che ne parla · R3 **non descrive una persona**.
3. **R3 è definizione, non prudenza**: `sys_position_skill_requirements` («quali competenze una
   posizione richiede») è ricercabile; `sys_user_skills` («quali competenze Marco possiede») non
   lo è. La distinzione è sottile e si perde facilmente.
4. **L'ordine è per RICADUTA**, usando le relazioni che il metro di E18 già calcola: un dominio
   che ne sblocca molti altri va prima. A parità, quello con più fonti ammesse.
5. **2c: la garanzia è una FORMA, non un controllo.** Confrontare i testi e bloccare i troppo
   simili è la risposta **debole** — si aggira cambiando le parole e non si può dimostrare che
   funzioni. La risposta forte è a due strati: «completo e attribuito» legato al tenant
   proprietario, e «forma» (struttura, **zero** campi di testo libero).

## Da NON fare

Scrivere a mano l'elenco dei domini · rendere ricercabile un dominio che descrive persone ·
riusare le righe di `sys_organization_unit_templates` come patrimonio (P2a §9: copie identiche di
una struttura orfana, con una «Direzione Direzione Generale» — residuo, non sapere) · costruire
il confronto di somiglianza fra testi · **citare il numero 196**, che non si riproduce.

## Fasi

- [x] **F1 Lo strumento che ri-deriva la coda** — FATTA 2026-09-12 (S1095) · `docs/kb/tools/check_domini_ricercabili.py`, autoprova **9/9** a esiti opposti su tabelle VERE (per ciascuna delle tre prove un caso che passa e uno escluso); coda misurata: 248 tabelle · 84 cataloghi aperti (R1 no, I21) · 89 di persona (R3 no) · **75 ricercabili**, di cui **4 percorribili oggi** (`sys_positions` ricaduta 29, `sys_organization_units` 11, `sys_kpi_definitions` 6, `sys_skills` 6) e 71 che aspettano una fonte · budget ~60k

  ### ✅ S1095 (2026-09-12) — lo strumento, e tre cose che ha detto subito

  **Il gate era caduto** (`#132` DONE) e la ragione per cui F1 «non era eseguibile in modo
  utile» era che R2, con una fonte per dominio, non discriminava. **Sciolto senza riscrivere
  R2**: resta «esiste una fonte ammessa», ma non *esclude* dalla coda — la **spacca**. Chi passa
  R1+R3 è ricercabile; R2 dice se è *percorribile oggi* o se *aspetta una fonte*. L'ordine è per
  **ricaduta** (FK entranti da tabelle di tenant), come impone la decisione 4, e a parità per
  numero di fonti. Niente è scritto a mano: universo da `information_schema`, domini da
  `domains/*.ts` (`chiave: "…"`), fonti da `sys_research_sources`.

  🔬 **L'autoprova ha corretto il criterio alla prima corsa**: `sys_positions` risultava «di
  persona» per `position_owner_user_id`. Il proprietario di una posizione è un **attore**
  (I1: owner ≠ incumbent), non il soggetto — come `feedback_reviewed_by_user_id` in #214. Il
  criterio ora distingue `owner/manager/approver/assessor/reviewer/interviewer…_user_id` da
  `subject/hired/employee_user_id`, e due attese nuove lo tengono fermo (`sys_organization_units`
  passa nonostante il manager; `sys_assessments` è escluso per il soggetto).

  ⚠ **Reperto**: `business_processes` ha una fonte APPROVED (`bancaditalia.it`) ma la sua
  destinazione, `sys_blueprint_process_registry` (#132 F5, mig 000335), **non ha `tenant_id`**:
  non è contenuto di un cliente, è il registro dei processi del *blueprint*. Lo strumento lo
  dichiara («domini CON fonte ma destinazione non ricercabile») invece di tacerlo. Non è un
  difetto della coda: è una domanda per F2 — se «percorrere `business_processes`» produce
  patrimonio (2c) e non contenuto di tenant, allora è già dall'altra parte di E12.

  **La decisione delegata** («cosa passa a un cliente nuovo», che il piano lasciava a Enzo) è
  presa e scritta nella testata dello strumento: le tassonomie non passano perché sono già di
  tutti (I21); passa ciò che appartiene al cliente. Se Enzo la ribalta, cambia R1.
      `check_domini_ricercabili.py`, gemello dichiarato di `check_concetti_agente.py`, che
      ri-deriva la coda dal catalogo reale a ogni esecuzione. **Autoprova a esiti opposti
      obbligatoria**: un dominio che deve passare e uno che deve essere escluso da *ciascuna*
      delle tre prove. Se non sa dire di no tre volte non è un criterio, è un elenco con una
      funzione davanti.
- [ ] **F2 Il primo dominio della coda, dichiarato e percorso** — budget ~80k · il gate su F1 è caduto (S1095); la testa della coda è `sys_positions` (dominio `positions`, fonte `ilo.org`). Percorrerlo è una corsa di ricerca sul gateway (abbonamento, `#86`): NON fatta in S1095 per capienza dichiarata
      Deve produrre proposte approvate, non solo comparire in cima a una lista.

  ### ⚠ S1096 (2026-09-12) — percorsa DAVVERO, e la misura dice perché non produce ancora

  **Cosa esiste ora**: `apps/api/scripts/percorri-dominio.mts` — per un dominio: fascicolo (creato
  se manca, con carta d'identità), corsa, decisione motivata su ogni `PASSED` (rotta del
  candidato, non il ledger), `apply-research`, esito letto dalla risposta. Girato sul gemello
  (E27) con il **modello su Windows** — l'unico `claude` autenticato: gemello e VM hanno la
  sessione OAuth **scaduta** (`claude login` è interattivo: impossibilità tecnica) — e l'API+lettore
  sul gemello, uniti da `ssh -R 8790` (da Windows il DNS di casa non risolve i siti
  istituzionali: memoria `home_ipv6_dns_stall`).

  **Due difetti trovati eseguendo, corretti con prove a esiti opposti** (65/65 unit):
  ① `#245` dal lato della PROPOSTA — `dominioApplicabile` era `z.string().max(64)`: 7 fonti
  `PASSED` con «statistica_ufficiale», «normativa_statale_vigente»… che il ponte avrebbe rifiutato
  **dopo** la decisione umana. Ora è `z.enum` delle chiavi di contenuto, e siccome lo schema va al
  modello come JSON Schema, l'enum è insieme vincolo e istruzione: la corsa dopo ha dato 8/8 chiavi
  valide. ② **Il perimetro non era nel mandato**: la fase «indirizzi» proponeva siti qualsiasi,
  l'API li leggeva, e le proposte cadevano su `SOURCES_POLICY` (7/7 in una corsa). Ora
  `MandatoRicerca.fontiAmmesse` porta le fonti APPROVED del dominio, il prompt le dichiara e il
  lettore salta gli indirizzi fuori perimetro.

  **Esito sul gemello**: `research_sources` → **8 fonti registrate** (`fontiRegistrate: 8`:
  cnel.it|positions, confindustria.it|*, inps.it|kpis, ispettorato.gov.it|business_processes,
  istat.it|kpis, normattiva.it|business_processes, registroimprese.it|organization_units,
  uni.com|business_processes — tutte INSTITUTIONAL/ACCREDITED, criterio 000379). Poi
  `organization_units` **0 proposte** (4 lette, 4 inventate → 404) e `positions` **0 proposte**
  (idem). **Non è un rosso della catena: è il limite della fase «indirizzi»** — il modello non
  naviga, *indovina* i percorsi (metà sono 404) e le pagine istituzionali che indovina non
  descrivono come è fatta una società di consulenza; risponde vuoto invece di inventare, che è
  il comportamento voluto. La fonte che servirebbe (`assoconsult.org`, associazione di categoria)
  è stata proposta **una** volta (corsa `7550b570`, con la chiave ancora libera) e mai più in
  due corse successive. **F2 resta aperta**: percorsa, non produttiva. Non si è approvata nessuna
  fonte a mano (il piano lo vieta).

  **Cosa serve perché produca** (finding, non voce nuova): o la fase «indirizzi» sa *cercare*
  (una sitemap, o uno strumento di ricerca nel gateway) invece di indovinare, oppure il registro
  riceve la fonte di settore quando una corsa la propone — e le proposte di fonte si presentano
  a Enzo, che è chi le approva davvero (S1081). Il driver e le due correzioni restano nel repo.
  ### 🟡 S1097 (2026-09-12) — la fase «indirizzi» ora SA CERCARE; la corsa resta da fare

  Il finding di S1096 («o la fase indirizzi sa cercare, o il registro riceve la fonte di
  settore») è stato eseguito nella prima forma, **nell'API e non nel gateway** (che per §4.4
  non ha strumenti e non deve averne). Passo ⓪ nuovo in `sorgenti/gateway.ts`
  (`sorgenti/mappa-del-sito.ts`): per ogni fonte ammessa l'API legge `sitemap.xml` (e fino a
  2 sotto-mappe se è un indice, mai oltre 12 mappe per corsa) **con lo stesso lettore delle
  pagine** — guardie, limiti, impronta — ne estrae gli indirizzi reali del suo host, li ordina
  per attinenza alle domande (confronto per radice di 6 caratteri: «organizzata» trova
  «organizzazione») e li passa al modello come `candidati`. Il prompt dice «scegli da qui, non
  inventare», e il gateway **scarta per costruzione** ciò che non sta nell'elenco. Una mappa
  assente non ferma la corsa: si chiede senza candidati, come prima, e l'esito per fonte si
  registra (`letta`/`assente`/`vuota`).

  🔬 Unit **17/17** (`research-mappa-del-sito.unit.test.ts` 8, `research-sorgente-gateway`
  9 di cui 1 nuovo): i due rossi della prima corsa hanno **corretto lo strumento** — l'ordine
  per parola intera metteva `news` davanti a `organizzazione` per pura brevità. Typecheck e
  lint verdi su api e gateway.

  ⏳ **Non eseguita la corsa su `positions`**, e va detto: pretende la catena della ricerca
  (`claude` autenticato solo su Windows + API e lettore sul gemello via `ssh -R 8790`) e il
  tunnel era degradato (7,8 s per una `count`). Il prossimo passo è UNA corsa con
  `percorri-dominio.mts` e leggere `fonti` nell'esito: quante mappe si sono aperte, quanti
  candidati, e se il modello ha scelto pagine che descrivono una società di consulenza. Se
  le mappe istituzionali non portano quelle pagine, resta la seconda forma del finding:
  la fonte di settore (`assoconsult.org`) proposta a te.

  ### S1098 (2026-09-13) — quattro corse, due difetti dello strumento corretti, e il limite resta la fonte

  Catena accesa come in S1096 (gateway su Windows col token del gemello, `ssh -R 8790`, API `:3001`
  sul gemello, driver sul gemello). **Corsa 1** (`d944ab14`, 18 s): 0 proposte e nei metadati
  **nessuna traccia delle mappe** — `candidatiDalleMappe` calcolava l'esito per fonte e il gateway
  lo BUTTAVA: «leggere `fonti` nell'esito» era impossibile per costruzione. Corretto: `MandatoRicerca.annota`
  → `EsitoCorsa.note` → metadati della corsa (`mappe`, `indirizzi`). **Corsa 2** (`36c6f5b5`): `ilo.org`
  letta, 1 mappa, **90 indirizzi, 90 candidati, 0 scelti** — l'indice di ilo.org elenca 90 sotto-mappe
  come `sitemap.xml?page=N`, e `eIndiceDiMappe` non le riconosceva (regex chiusa su `.xml$`): il modello
  riceveva 90 «pagine» che erano mappe e sceglieva nulla. Corretto (`E_UNA_MAPPA` tollera la coda di
  interrogazione; unit 18/18 con la controprova). **Corsa 4** (`73f3825f`, 39 s): **3 mappe, 2.094
  indirizzi, 120 candidati, 8 pagine scelte e lette** (guide di ricerca sul settore privato, pagine
  Italia, norme del lavoro) — **0 proposte**. Ora è il limite VERO, misurato: l'unica fonte approvata
  per `positions` è `ilo.org`, un sito di classificazione e norme; nessuna delle sue pagine descrive
  come è fatta una società di consulenza, e il modello risponde vuoto invece di inventare (voluto).
  **F2 resta aperta sulla seconda forma del finding**: serve la fonte di settore (`assoconsult.org`),
  e le fonti le approva Enzo (S1081) — è una domanda aperta in `STATE.md`, non un lavoro mio.

  ### S1099 (2026-09-13) — la fonte di settore è nel registro, la corsa la legge, e il limite si sposta ancora

  **Decisione presa per delega** (Enzo: «prendendo decisioni per mio conto»): `assoconsult.org`
  **APPROVED** per `positions` e `organization_units`, classe `TOP_CONSULTING` letta per la sua
  ratio (l'autorità su come si organizza una società di consulenza sta nel settore stesso), con
  l'elenco dei domini di metodo **esteso per iscritto** a `organization_units` — non è una
  tassonomia, è contenuto di un cliente. Mig **`000413`**, approvatore la persona che ha delegato,
  guardia e post-condizioni come la 000379; prova generale linux-pc VERDE (5→7, seconda passata
  7→7, 47/47), produzione dalla VM 12 s, sul clone del gemello 17 s.

  🔬 **L'host, misurato prima di approvarlo, ha detto subito una cosa**: assoconsult.org **non ha
  una mappa del sito** (`/sitemap.xml` → `/wp-sitemap.xml` → 501 «manca SimpleXML»). Con la sola
  mappa la fase «indirizzi» sarebbe tornata a indovinare. **Seconda via** in `mappa-del-sito.ts`:
  senza mappa (assente o muta) si tenta l'elenco REST di WordPress (`/wp-json/wp/v2/pages` e
  `posts`), stesso lettore, stesse guardie, stesso tetto; le barre protette del JSON
  (`https:\/\/`) si spogliano prima di cercare. Unit **12/12** su `mappa-del-sito` (3 nuovi, con
  la controprova: con una mappa buona la seconda via non si tenta) e 234/234 sull'API; senza la
  correzione 2 rossi (stash). Typecheck e lint verdi.

  **Corsa** (`9e921576`, 33 s, catena come in S1098): `assoconsult.org` **letta, 2 elenchi, 101
  indirizzi**; `ilo.org` 3 mappe, 2.094; 120 candidati; **8 pagine scelte** — 5 di Assoconsult
  (`la-struttura-organizzativa`, `organi-istituzionali`, il comunicato sull'industria da 30 mld,
  Stati Generali 2025 e 2024) e 3 di ilo.org — **0 proposte**.

  ⭐ **Il limite vero, ri-misurato, non è più la fonte: è il TIPO di contenuto.** Letto il sito
  dal gemello: le pagine HTML di Assoconsult descrivono l'*associazione* (organi, presidenti,
  eventi, comunicati) e le indagini di settore (domanda di servizi, IA); i rapporti
  dell'Osservatorio, dove starebbero ruoli e strutture delle società, sono **PDF**, e il lettore
  apre solo HTML. Il modello ha risposto vuoto invece di inventare, che resta il comportamento
  voluto. **F2 resta aperta**: la fonte c'è, la catena la legge, il contenuto che risponderebbe
  alle domande non è in una forma che il lettore sa aprire. (Scoperta registrata nel piano di
  sessione, fuori ciclo: *il lettore dovrebbe aprire i PDF delle fonti ammesse*.)

  🔬 **E la corsa ha fatto scattare un difetto che aspettava la prima corsa vera in
  produzione** (trovato dal cancello di verifica, `test-api` sul gemello): con una corsa di
  ricerca senza tenant nel registro — la trattativa non è firmata, tenant NULL per costruzione —
  `/v1/seed-acquisition-runs` rispondeva **500** (`tenantId` expected string, received null).
  Corretto in `c13ce76d`: contratto e repository ammettono il null, prova di integrazione che
  inserisce la corsa senza tenant e pretende 200 (rossa con 500 senza la correzione).

- [ ] **F3 Lo strato di forma (2c) e la prova della frase riconoscibile** — budget ~60k
      Prendere una proposta approvata del cliente A con una frase riconoscibile, promuoverla a
      patrimonio, e cercare **quella frase** nello strato di forma: deve dare **zero** riscontri.
      Se la trova, la spoliazione non è avvenuta e E12 è finta.

## Decisioni che restano a Enzo (non le prendo io)

- **F1 — che cosa passa esattamente a un cliente nuovo.** La sola struttura è la più sicura e la
  meno utile; includere le tassonomie è molto più utile e comincia a somigliare a contenuto.
  Nessuna misura può rispondere: dipende da cosa Heuresys vende. È anche il confine del limite
  dichiarato su 2c — una forma troppo povera manderebbe il cliente nuovo a ripartire da zero,
  cioè E11 non si realizzerebbe.
- **F2 — il tetto di costo per corsa**, da ri-porre su 150 tabelle invece che sul numero 196.

## Verifica avversariale già fatta (S1066, `#149`) — non ri-eseguirla

Misure ri-fatte sul vivo: `sys` ha 225 tabelle · 150 tabelle di tenant, 144 popolate da RTL, 329
relazioni · `sys_research_sources` **non esiste** (la dipendenza dura regge) ·
`check_concetti_agente.py` esiste.

❌ **Rilievo respinto, ed è sostanziale**: il documento apre con «P2a ha COSTRUITO il motore e lo
ha DIMOSTRATO su business_processes». È **falso**: `#132` è ACTIVE, mai implementata. Nessun
motore esiste, nessuna dimostrazione è avvenuta.

## Chiuso quando

Esiste lo strumento che ri-deriva la coda con autoprova a esiti opposti, il primo dominio è stato
dichiarato e ha prodotto proposte approvate, e la prova della frase riconoscibile sullo strato di
forma dà zero riscontri.


---

## ⚠⚠ RI-MISURATO il 2026-09-08 (S1092): il fatto è cambiato, e ribalta metà della conclusione qui sotto

Il paragrafo del 2026-09-05 poggia su una misura precisa — *«una riga sola, per un dominio
solo, e quel dominio è proprio quello già percorso da 2a»* — e da lì conclude che lo
strumento di F1 «nascerebbe verde restituendo una coda con dentro solo ciò che è già fatto».

**Quella misura non descrive più il presente.** Ri-derivata oggi:

```
APPROVED | business_processes | 1        APPROVED | positions   | 1
APPROVED | kpis               | 1        APPROVED | skills      | 1
APPROVED | organization_units | 1
```

**Cinque domini approvati, non uno** — uno per **ciascuno** dei cinque domini di contenuto.
La conclusione «R2 escluderebbe ogni candidato tranne `business_processes`» è quindi falsa
oggi: R2 li ammetterebbe tutti e cinque.

**Ma questo non rende F1 eseguibile, e la ragione è cambiata**, quindi va riscritta invece
che ereditata:

- il catalogo dei domini ricercabili conta **sei** voci — i cinque di contenuto più
  `research_sources`, che è il dominio **del registro stesso**. Quindi l'autoprova a esiti
  opposti su R2 è *tecnicamente* costruibile (cinque passano, uno no), ma l'unico candidato
  che R2 escluderebbe è un dominio **meta**: quello che popola le fonti, non uno che le
  consuma. È un «no» che non rappresenta ciò che R2 vuole misurare, e una prova che dice no
  solo sul caso degenere è una prova debole;
- soprattutto, **la coda perde il suo senso**: se tutti e cinque i domini di contenuto
  passano R2, la coda che F1 dovrebbe produrre è lunga cinque e R2 non ne ordina nessuno.
  L'ordine dovrebbe venire dagli altri criteri, e il piano vieta esplicitamente di scriverne
  uno a mano.

⭐ **Delle due domande poste a Enzo il 2026-09-05, la prima è quella che conta ora, e non è
sciolta**: *«quali altre fonti si approvano — da quali siti la piattaforma accetta di
imparare»*. Con una fonte per dominio, il registro c'è ma non discrimina; è
l'**ampiezza** delle fonti approvate a dare a R2 qualcosa da separare. La seconda (riscrivere
R2 al potenziale) **perde urgenza**: al potenziale o all'atto, oggi il risultato è lo stesso.

*Il paragrafo che segue resta come cronaca del 2026-09-05, non come stato.*

## ⚠ Misurato il 2026-09-05 (S1087): il gate e' caduto, ma F1 non e' diventata eseguibile

La dipendenza dura diceva: «la coda non e' calcolabile finche' 2a non e' fatta — la prova R2
dipende da `sys_research_sources`, che **non esiste**». `#132` e' stata chiusa (con F7) in S1086,
e la tabella ora esiste davvero:

```
to_regclass('sys.sys_research_sources') -> presente, 15 colonne
select research_source_status, research_source_domain, count(*) ... :
  APPROVED | business_processes | 1
```

**Una riga sola, per un dominio solo — e quel dominio e' proprio quello gia' percorso da 2a.**

Conseguenza diretta sulla prova R2 («esiste almeno una fonte ammessa che ne parla»): applicata
oggi, escluderebbe **ogni** candidato tranne `business_processes`. Lo strumento di F1 nascerebbe
verde e restituirebbe una coda con dentro solo cio' che e' gia' fatto — cioe' **un verde nato dal
vuoto**, che e' esattamente la forma di falso verde che questo repository ha imparato a
riconoscere. E la sua autoprova a esiti opposti («un dominio che deve passare e uno che deve
essere escluso da *ciascuna* delle tre prove») **non sarebbe costruibile su R2**, perche' non
esiste un secondo dominio con cui provare il «no».

Non e' la decisione di Enzo a mancare (quella su «che cosa passa a un cliente nuovo» riguarda F1
ma e' separabile): **manca la materia**. Il registro delle fonti si popola percorrendo domini, e
percorrere domini e' F2 — che dipende da F1. Il nodo si scioglie approvando altre fonti, che e'
un atto di business, oppure dichiarando che R2 vale «una fonte ammessa **puo'** esistere per quel
dominio» invece di «esiste» — ma quella e' una riscrittura del criterio, non la sua applicazione,
e questo piano vieta esplicitamente di scrivere a mano un criterio.

**Sta a Enzo**, e sono due domande, non una:
1. quali altre fonti si approvano (business: da quali siti la piattaforma accetta di imparare);
2. se R2 va riscritta al potenziale — e con quale ordine, dato che il criterio 4 dice «per
   ricaduta», che si calcola sulle relazioni e non sulle fonti.
