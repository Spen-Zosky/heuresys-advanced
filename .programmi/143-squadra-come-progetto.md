# 143 — Una squadra è un progetto: serve il modello, non un puntatore al capo

> **item**: #143 · **priorità**: P1 · **stima register**: ~4-6 sessioni
> **stato**: NON AVVIATO
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

## Proposta tecnica di Claude — DA VALIDARE CON ENZO PRIMA DI F2

(a) **due entità**: progetto (scopo, obiettivo, date, stato) e squadra (chi ci lavora, con
ruolo) — un progetto può cambiare squadra, una persona sta su più progetti, e **fonderle costa
dopo**; (b) **appartenenza con decorrenza e scadenza**, senza cui il perimetro non sa dire «chi
c'era quando»; (c) il capo progetto vede attività, avanzamento e consegne dei membri **su quel
progetto**, mai i loro dati personali (è già I18).

## Fasi

- [ ] **F1 — INDAGINE + validazione del modello con Enzo** — fatto = la proposta (a)(b)(c) approvata o corretta da Enzo, e il censimento di cosa oggi consuma `sys_teams` (per sapere cosa si rompe). **Decisione di prodotto: è di Enzo** · budget ~120k
- [ ] **F2 — Modello dati** — tabelle progetto + appartenenza con decorrenza/scadenza + migrazione dei 26 team esistenti · budget ~250k
- [ ] **F3 — Asse funzionale vivo** — dare consumatori reali a `isInFunctionalScope`/`isFunctionalLeader`, oggi codice morto; l'autorità del capo progetto è **sul lavoro**, non sulle persone · budget ~250k
- [ ] **F4 — API progetti/squadre** — CRUD + avanzamento + test che provano il **confine I18** (un capo progetto NON vede i dati sensibili dei membri) · budget ~250k
- [ ] **F5 — Frontend + dimostrazione live** — con un capo progetto reale gerarchicamente inferiore a un suo membro: è il caso che dimostra il modello · budget ~250k

## Da dove si riprende

**F1**. La parte che serve a Enzo è la validazione del modello a due entità: è la scelta che
costa di più se presa male, e non è una decisione tecnica.
