# 143 — Una squadra è un progetto: serve il modello, non un puntatore al capo

> **item**: #143 · **priorità**: P1 · **stima register**: ~4-6 sessioni
> **stato**: IN CORSO
> **fonti**: direzione di Enzo 2026-08-05 (registrata nel register) · ADR-0036 (assi) · I18

## Decisioni vincolanti (non si ri-chiedono)

- **Distinzione posta da Enzo**: «una filiale è un sotto-albero gerarchico; una squadra è
  attiva su uno scopo funzionale, ha diversi membri e un team leader che **può essere
  gerarchicamente inferiore a uno o più membri** — va inteso come capo progetto dello scopo
  assegnato. Il modello da adottare deve essere simile ai modelli di project management».
- **I18 resta**: l'appartenenza a una squadra non apre **mai** i dati sensibili. La dottrina
  esiste già; qui va implementata, non ridiscussa.

## Cosa c'è e cosa manca — già misurato (register, S1045)

- `sys_teams` ha codice, nome, unità, capo, attiva — **nessuno scopo, nessun obiettivo,
  nessuna data, nessun avanzamento**.
- **Non esiste alcuna tabella progetti** (verificato: `sys_mentorship_programs` e
  `sys_training_initiatives` sono altro).
- `lib/scope/functional.ts` ha **un solo consumatore** di produzione;
  `isInFunctionalScope`/`isFunctionalLeader` **non ne hanno alcuno**.

## Reperto già in mano a F1 — misurato in S1061 (2026-08-14), non da ri-cercare

Chiudendo `#123 (a)` è stato misurato ciò che F1 avrebbe dovuto cercare da sé:

- **174 appartenenze · 159 persone · 26 squadre.** Due appartenenze stanno in squadre senza
  unità propria e vanno escluse dal rapporto (non hanno un'unità con cui essere trasversali):
  sulle **172** che restano, **142 sono trasversali (82,6%)**, per **135 persone**.
- **3 squadre attive hanno già oggi un capo che sta più in basso nell'albero delle unità di un
  suo membro.** È **il caso che Enzo descrive**, e non è da costruire: esiste nel dato reale.
  Sono i tre casi su cui F5 dovrà fare la dimostrazione live, invece di fabbricarne uno.
- Conseguenza per il modello: la trasversalità **non è un difetto da sanare** — è stata
  registrata come forma attesa chiudendo `#123`. Chi apre F2 non deve ri-aprire quella domanda.

*(le due interrogazioni stanno nella cronaca di `#123` nel register; si ri-derivano in un
minuto sull'albero delle unità e sugli incarichi attivi — non si ricopiano i numeri, che
cambiano da soli.)*

## Censimento di F1 — «cosa si rompe» — FATTO in S1061 (2026-08-15)

F1 chiedeva *«il censimento di cosa oggi consuma `sys_teams`, per sapere cosa si rompe»*.
Misurato, ed è **piccolo**: il modello nuovo ha poca superficie da non rompere.

| dove | cosa | conseguenza per F2/F4 |
|---|---|---|
| `modules/teams` | **5 rotte** (l'intero CRUD) | è la superficie da far evolvere, non da sostituire |
| `modules/public-stats` | un solo `count(*)` su `sys_teams` | un numero in vetrina: cambia solo se cambia la semantica di «squadra» |
| `lib/scope/functional.ts` | il capo è `team_lead_user_id` **oppure** `sys_team_members` con ruolo `LEAD` | **è qui il perno di F3**: la nozione di «capo funzionale» esiste già e ha due fonti |
| `apps/web` | **una** pagina autenticata, `/me/team` | il resto delle occorrenze è vetrina, non l'entità |

**Cosa resta di F1**: la sola **validazione del modello a due entità con Enzo** — decisione di
prodotto, dichiarata sua fin dall'apertura del programma. La parte tecnica di F1 (censimento +
reperti) è chiusa: chi riprende non deve ri-misurare, deve **chiedere**.

## ✅ DECISIONE PRESA 2026-08-15 (S1062) — il modello a due entità è adottato

Enzo, aprendo la corsa autonoma di S1062, ha dato mandato esplicito di decidere al posto suo
sui punti bloccati. Questa voce è stata riletta con quel mandato, e la conclusione è che
**non era una decisione di prodotto**: il *cosa* Enzo lo ha già dichiarato il 2026-08-05 —
squadra attiva su uno scopo, capo progetto che **può stare più in basso** dei suoi membri,
modello ispirato al project management. Ciò che restava è **come modellarlo nello schema**,
che è materia tecnica.

**Adottata la proposta (a)(b)(c) qui sotto, invariata**, per tre ragioni tutte tecniche:

1. **Due entità e non una**, perché un progetto può cambiare squadra e una persona sta su più
   progetti: fonderle è comodo oggi e costoso dopo, e il costo lo paga chi separa in seguito
   dati già scritti.
2. **Appartenenza con decorrenza e scadenza**, perché senza il perimetro non sa rispondere a
   «chi c'era quando» — è lo stesso difetto che la delega (`000314`) ha già dovuto risolvere
   con `starts_on`/`ends_on`, e ripeterlo sarebbe ignorare una lezione pagata.
3. **L'autorità del capo progetto è sul lavoro, non sulle persone**: non è una scelta, è I18,
   che vale già oggi e qui va soltanto implementata.

⚠ **Resta di Enzo** una sola cosa, e non blocca F2: i **nomi di dominio** delle due entità
nel prodotto (progetto/commessa/iniziativa). Si cambia un'etichetta, non uno schema.

## Proposta tecnica di Claude — ✅ ADOTTATA (vedi sopra)

(a) **due entità**: progetto (scopo, obiettivo, date, stato) e squadra (chi ci lavora, con
ruolo) — un progetto può cambiare squadra, una persona sta su più progetti, e **fonderle costa
dopo**; (b) **appartenenza con decorrenza e scadenza**, senza cui il perimetro non sa dire «chi
c'era quando»; (c) il capo progetto vede attività, avanzamento e consegne dei membri **su quel
progetto**, mai i loro dati personali (è già I18).

## Fasi

- [x] **F1 — INDAGINE + modello validato** — **CHIUSA 2026-08-15 (S1062)**. Il censimento era già fatto in S1061 (4 consumatori di `sys_teams`, superficie piccola) e i reperti pure (142 appartenenze trasversali su 172; **3 squadre reali** hanno già un capo più in basso di un membro — il caso di Enzo esiste nel dato, non va costruito). Restava la sola validazione del modello, **presa in S1062 col mandato di decidere**: due entità, appartenenza con finestra temporale, autorità sul lavoro e non sulle persone. Dettaglio e motivazioni nella sezione «DECISIONE PRESA» qui sopra · budget ~120k
- [ ] **F2 — Modello dati** — tabelle progetto + appartenenza con decorrenza/scadenza + migrazione dei 26 team esistenti · budget ~250k
- [ ] **F3 — Asse funzionale vivo** — dare consumatori reali a `isInFunctionalScope`/`isFunctionalLeader`, oggi codice morto; l'autorità del capo progetto è **sul lavoro**, non sulle persone · budget ~250k
- [ ] **F4 — API progetti/squadre** — CRUD + avanzamento + test che provano il **confine I18** (un capo progetto NON vede i dati sensibili dei membri) · budget ~250k
- [ ] **F5 — Frontend + dimostrazione live** — con un capo progetto reale gerarchicamente inferiore a un suo membro: è il caso che dimostra il modello · budget ~250k

## Da dove si riprende

**F2 — Modello dati.** F1 è chiusa: censimento e reperti in S1061, modello deciso in S1062.
Non c'è più niente da chiedere prima di partire.

Tre cose che F1 lascia a chi apre F2:
- **La trasversalità non è un difetto da sanare** — è la forma attesa, registrata chiudendo
  `#123`. Non ri-aprire quella domanda.
- **La dimostrazione di F5 non va fabbricata**: 3 squadre reali hanno già oggi un capo
  gerarchicamente inferiore a un suo membro. Sono quelle.
- **`lib/scope/functional.ts` è il perno di F3** e la nozione di «capo funzionale» ha già
  **due fonti** (`team_lead_user_id` **oppure** un membro con ruolo `LEAD`): F2 deve decidere
  quale delle due sopravvive, o resteranno due verità sullo stesso fatto.
- ⚠ **`isInFunctionalScope`/`isFunctionalLeader` sono codice morto** — zero consumatori di
  produzione. Prima di costruirci sopra, verificare che facciano ciò che dicono: nessuno le
  ha mai esercitate, quindi non c'è prova che funzionino.
