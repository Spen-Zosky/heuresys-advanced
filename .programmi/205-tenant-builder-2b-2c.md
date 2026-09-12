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
