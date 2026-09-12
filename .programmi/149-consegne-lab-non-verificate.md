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
- [ ] **F4 La prossima consegna che arriva, o la prossima ingerita che qualcuno cita** — budget ~30k a consegna · eseguita 2026-09-12 (S1095) su `2026-08-12-guardia-psql-opzioni-raggruppate` (citata due volte dal register, marker NON-VERIFICATO da S1094): cinque affermazioni portanti misurate una per una → esito **PARZIALE**, scritto nel file — il difetto e' confermato ma la consegna e' gia' stata eseguita (patch nel repo, `PSQL_OPZIONI_CON_VALORE` riga 772; tre casi in `_cases()`; `hook.sh selftest` 122/0; `#121` DONE), quindi meta' del documento descrive uno stato che non esiste piu'. `check_verifica_consegne.py` la legge: `esito PARZIALE · S1095`. Restano 4 consegne citate con marker NON-VERIFICATO (istruzione-vincolante, e22-e23, p3, p4): la fase resta aperta per costruzione
      ▸ **Misurato il 2026-09-08 (S1092): nessun bersaglio, e la misura resta doppia.**
      `python docs/kb/tools/lab_inbox.py` → «lab inbox: vuota», **exit 0 letto sul processo**;
      e `ls -la D:/heuresys-design-lab/inbox/` mostra la sola cartella `ingerite/`, **ferma al
      24 agosto**. Due metodi indipendenti, perché uno solo direbbe «lo strumento tace», non
      «non c'è niente».
      ⭐ **E il presidio ha lavorato davvero, su fonti che non sono del lab ma sono la stessa
      specie — affermazioni ereditate dai nostri stessi documenti**, e ne ha smentite **tre**:
      ① `.handoff/STATE.md` dava il verdetto di `verify_gate` per «ROSSO»: il file dice
      `not-measured`, che è un'altra cosa — e la misura vera sul gemello è **1883/1883 verdi**;
      ② il programma di `#169` proponeva la «terza via» delle due chiavi separate senza aver
      mai fatto la misura che esso stesso dichiarava decisiva: fatta, le due chiavi **stanno
      nello stesso posto ovunque**; ③ il programma di `#214` lasciava intendere che
      `enterprise-typing-profiles` fosse un candidato neutro: la sua porta è **già occupata**
      da un nome proprio in chiaro.
      Nessuna decisione eseguita in S1092 poggia su un documento del lab.
      ▸ **Misurato il 2026-09-07 (S1091): nessun bersaglio, e la misura è doppia.**
      `python docs/kb/tools/lab_inbox.py` → «lab inbox: vuota»; e `ls -la D:/heuresys-design-lab/inbox/`
      mostra la sola cartella `ingerite/`, con data **24 agosto** — invariata. Due metodi
      indipendenti, perché uno solo direbbe «lo strumento tace», non «non c'è niente».
      Nessuna decisione eseguita in S1091 poggia su un documento del lab: V1 poggia su
      `peso_stato.py` e `handoff_lint.py`, V2 sul codice di `verify_gate.py` letto e sulla prova
      del presidio fatta scattare, V3 su `gh run list` e su un `grep` di conteggio. ⭐ E il
      presidio ha lavorato **in senso proprio** su un'affermazione ereditata: `.handoff/STATE.md`
      dava `#219` per chiusa e la suite per verde — vero, ma l'ho **ri-misurato** con
      `gh run list` invece di ereditarlo, ed è quella misura che ha permesso di chiudere `#231`.
      La fase resta aperta perché è continuativa: dichiararla «fatta» perché oggi l'inbox è vuota
      sarebbe scambiare l'assenza di lavoro per lavoro svolto.
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
