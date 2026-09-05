# 149 — Ogni consegna del lab va trattata come non verificata, incluse quelle già ingerite

> **item**: #149
> **stato**: IN CORSO

Regola di Enzo del 2026-08-06, **continuativa**. Prima di eseguire una consegna del lab: analisi
**adversarial** delle sue affermazioni portanti, correzione di ciò che non è coerente col
contesto globale, e annotazione **nel file** di cosa è stato rifiutato e corretto.

**La responsabilità della qualità è di chi esegue, mai del mittente.**

Non è una voce che si chiude: è un presidio. Le fasi qui sotto sono i **prossimi passi concreti**;
quando si spuntano, se ne aggiunge la successiva.

## Come si applica, in concreto

1. Si estraggono le **affermazioni portanti** della consegna — quelle su cui poggia una decisione.
2. Ognuna porta accanto **il comando che la misura**, eseguito adesso, non ereditato.
3. Ciò che la misura smentisce si corregge **nel file della consegna**, dicendo che è stato
   smentito e da cosa. Un documento che resta com'era e viene «letto con giudizio» torna intatto
   alla sessione dopo.
4. Vale anche per le consegne **già ingerite**: l'ingestione non è una verifica.

## Fasi

- [x] **F1 La verifica avversariale sulla consegna che istituisce la regola** — FATTO 2026-08-11 (S1047) · 13 affermazioni portanti, ognuna col comando che la misura: 11 confermate, 2 smentite, 1 precisazione. Smentito il conteggio «46 file (2+44)»: sono 48 — sbagliato il numero, piena la copertura (grep dell'istruzione 48/48)
- [x] **F2 Lo stato dell'inbox del lab** — FATTO 2026-08-13 (S1057) · l'inbox (`<padre del repo>/heuresys-design-lab/inbox/`) è **vuota**: contiene la sola cartella `ingerite/`, ultima consegna assorbita `2026-08-12-guardia-psql-opzioni-raggruppate`. Nessuna ingestione pendente
- [x] **F3 La verifica avversariale su `#205` (2b/2c)** — FATTO 2026-08-16 (S1066) · misure ri-fatte sul vivo; respinta come **falsa** l'affermazione portante «P2a ha costruito il motore e lo ha dimostrato»: `#132` è ACTIVE, mai implementata. Due numeri del documento già invecchiati (25→26 viste, 158→159 colonne)
- [ ] **F4 La prossima consegna che arriva, o la prossima ingerita che qualcuno cita** — budget ~30k a consegna
      ▸ **Misurato il 2026-09-05 (S1087): l'inbox e' ancora vuota.** `heuresys-design-lab/inbox/`
      contiene la sola cartella `ingerite/`, invariata dal 2026-08-24. E il presidio e' stato
      applicato dove serviva davvero: **nessuna** delle decisioni eseguite in questa sessione
      poggia su un documento del lab — poggiano tutte su misure prese sul vivo (il parco
      contratti, i tre servizi systemd, le colonne di `information_schema`, il registro delle
      fonti). Anzi, il presidio ha lavorato in senso proprio su **due affermazioni dei nostri
      stessi programmi**, che sono la stessa specie di fonte non verificata: `#219` dava il
      gemello con «Node 22.19.0 come default nvm» (misurato: **v12.22.9**) e `#242` dava la
      5.12.1 per ultima (misurata: **5.12.3**). Un documento interno invecchia come uno del lab.
      La misura si rifa', non si eredita.
      ▸ **Misurato il 2026-08-28 (S1083): nessun bersaglio.** `lab_inbox.riassunto()` torna vuota —
      nessuna consegna del lab in attesa di verifica, e nessuna è stata citata in sessione. La fase
      resta aperta perché è continuativa e si attiva su evento; dichiararla «fatta» perché oggi la
      inbox è vuota sarebbe scambiare l'assenza di lavoro per lavoro svolto.
      ▸ **Misurato il 2026-08-21 (S1077): l'inbox è ancora vuota.** `heuresys-design-lab/inbox/`
      contiene la sola cartella `ingerite/`; l'ultima consegna assorbita resta quella del
      **2026-08-16** (le cinque del Tenant Builder P2b/P3/P4 + le due sugli strumenti). Nessuna
      ingestione pendente, e nessuna decisione eseguita in questa sessione poggia su un documento
      del lab: il presidio non aveva nulla da esaminare. La misura si rifà, non si eredita.
      Il presidio scatta **prima** di eseguire, non dopo. Se una voce del register cita un
      documento del lab come fonte di una decisione, quel documento va misurato prima che la
      decisione venga eseguita.

## Chiuso quando

Mai: è un presidio continuativo. Si misura invece che **regga**: nessuna consegna eseguita senza
la sua analisi avversariale, e ogni smentita scritta nel file della consegna.
