# 79 — Cancello di esposizione: un dato che nessuna API espone non è nel prodotto

> **item**: #79
> **stato**: IN CORSO

**Regola di Enzo (S1034), vincolante e RETROATTIVA**: un dato che nessuna API espone **non è nel
prodotto**. Nessun cluster si chiude finché ciò che ha scritto non è raggiungibile — endpoint,
schema condiviso, query, wiring, e **la pagina dove il dato ha un lettore umano**.

Non è una voce che si chiude: è un presidio, e il presidio è automatico e falsificabile.

```bash
python docs/kb/tools/check_exposure.py     # exit 0 = nessuna tabella scritta e non letta
```

## Come si applica

Il cancello si esegue **a ogni cluster o lavoro che popola tabelle**, non a campione e non a fine
sessione. Una tabella nuova che nasce popolata e non letta è una lacuna aperta lo stesso giorno in
cui viene creata: trovarla sei sessioni dopo costa il triplo, perché nel frattempo qualcosa ci si
è appoggiato sopra.

## Fasi

- [x] **F1 Le cinque lacune vere, trovate e colmate** — FATTO 2026-08-06 (S1035) · storia organizzativa · registro GDPR che si scriveva e non si rileggeva · istruttoria e fonti della pipeline · revisione degli obiettivi di carriera. **E una tabella morta scartata**: `sys_auth_sessions` non è usata da nessuna parte (le sessioni vere sono i token di refresh)
- [x] **F2 La verifica dopo le superfici di `#126`** — FATTO 2026-08-13 (S1057) · `check_exposure.py` → **73 tabelle scritte dal programma, 73 lette da almeno un modulo API, 0 non esposte**, exit 0 letto **sul processo**, non dai messaggi
- [ ] **F3 Il prossimo lavoro che popola tabelle** — budget ~5k per esecuzione · eseguita 2026-09-12 (S1095) su `#54` F4: `check_exposure.py` → 73 scritte, 73 lette, **0 lacune**, exit 0. Resta aperta per costruzione: si ri-esegue al prossimo lavoro che popola tabelle

  ### Esecuzione S1092 (2026-09-08) — dopo #54 F3 e #214 F6

  `python docs/kb/tools/check_exposure.py` → **73 scritte · 73 lette · 0 esentate · 0 non
  esposte**, «Nessuna lacuna di esposizione», **exit 0 letto sul processo** e non dai
  messaggi (D-24 / la lezione della pipe che maschera l'uscita).

  ⚠ **E va detto perché è verde, o il verde non prova niente.** Il lavoro di questa sessione
  **non ha popolato** alcuna tabella: ha costruito API su tabelle **vuote per progetto**
  (il recruiting si popolerà con l'uso — I12/ADR-0038). Il cancello guarda «scritto dal
  programma e non letto da nessuna API»: dove non si è scritto, non ha nulla da dire. Un
  verde qui è **corretto e non informativo**, ed è diverso da un verde che assolve.

  ▸ **Il verso opposto, misurato lo stesso giorno**, che questo cancello non guarda: con le
  ultime due fette **tutte e sette** le tabelle del recruiting hanno ora un modulo API che
  le legge — `job_requisitions` 2 · `job_postings` 2 · `candidates` 3 ·
  `candidate_applications` 3 · `interviews` 2 · `interview_feedback` 1 · `job_offers` 1.
  Prima ne mancavano due. Non è materia di questo cancello (che parte dai *dati* e cerca
  l'API), ma è la stessa proprietà vista dall'altro capo, e conviene averla scritta il
  giorno in cui è diventata vera.
      ▸ **Eseguito il 2026-09-12 (S1096) — e il buco dichiarato in S1083 è CHIUSO.** Le
      migrazioni sono la seconda fonte delle «scritte» (`INSERT INTO`/`COPY` su `sys.sys_*`,
      etichettate `mig:000NNN`; un `UPDATE` non conta, o ogni backfill diventerebbe una
      scrittura da esporre). Misurato prima di estendere: **86** tabelle popolate da migrazione,
      **11** senza `FROM`/`JOIN` nell'API — e **tre erano falsi scoperti**, perché il cancello
      sapeva leggere in un modo solo. Tre vie di lettura in più, ognuna con un caso che passa e
      uno che non passa nell'autoprova (`--selftest`, **13 su 13**): ② la costante di tabella
      (`profilo.ts`: `tabella: "sys.sys_blueprint_content_job_roles"` poi `FROM ${cfg.tabella}`),
      ③ una funzione/vista SQL invocata dall'API (`sys_blueprint_family_for_activity_class`),
      ④ il trigger su una tabella letta (`sys_auth_mfa_exemption_eligible_users` via il trigger
      di `sys_auth_mfa_exemptions`). 🔬 Trovato costruendo: la 000284 porta un blocco di rollback
      **commentato** con `CREATE OR REPLACE FUNCTION …` e ridefiniva la funzione con un corpo
      vuoto — le righe `--` si tolgono prima di cercare oggetti, e l'autoprova lo pretende.
      Le **7** rimaste sono registri della catena, allowlist di sentinelle e giornali tecnici:
      nasce `exposure_waivers.txt` (il file che il cancello leggeva e che **non esisteva**),
      una riga per tabella col motivo. Esito: **140 popolate (73 seed · 86 mig) · 133 lette ·
      7 esentate · 0 scoperte, exit 0** letto sul processo.
      ⚠ Reperto fuori da questa voce: `sys_valutazione_condivisione_eccezioni` ha **568 righe**
      (una per valutazione completata mai condivisa, mig 000396) e nessuna API la espone: la
      deroga lo dichiara «attestazione di governo», ma 568 attestazioni che HR non può vedere
      dal prodotto sono un candidato all'esposizione, non un dettaglio.
      ▸ **Eseguito il 2026-08-28 (S1083)** dopo le quattro migrazioni del blocco A, di cui **due
      popolano davvero**: `000361` (requisiti formativi delle posizioni del rischio) e `000362`
      (buste paga del tenant di piattaforma). Cancello: **73 tabelle scritte, 73 lette, 0 non
      esposte**, exit **0** letto sul processo.
      ⚠ E il cancello da solo non bastava, perché conta le tabelle che il **codice** scrive, non
      quelle che una **migrazione** popola: le due di oggi potevano essere invisibili al conteggio
      e ugualmente non esposte. Verificate a mano, una per una, ed entrambe hanno un lettore:
      `sys_position_learning_requirements` → `modules/positions/repository.ts` ·
      `sys_user_pay_slips` → `modules/me/repository.ts` e `modules/dashboard/blocchi.ts`.
      **Questo è un buco del cancello, non un dettaglio di questa esecuzione**: una migrazione che
      popola una tabella nuova, mai toccata dal codice applicativo, passerebbe inosservata. Va
      nella coda di questa voce.
      ▸ **Eseguito il 2026-08-21 (S1077)** dopo le migrazioni `000351` (fusione di competenze) e
      `000352` (vincoli di intervallo): **73 tabelle scritte, 73 lette, 0 non esposte**, exit **0**
      letto sul **processo** e non dai messaggi. Nessuna lacuna aperta da quel lavoro — che era
      prevedibile, perché sposta e vincola righe esistenti invece di popolare tabelle nuove.
      ⚠ Il giornale `staging.skill_merge_undo` **non** entra nel conteggio, ed è corretto: il
      cancello guarda ciò che il *programma* scrive, non le tabelle di servizio delle migrazioni.
      Una tabella di annullamento che nessuna API legge non è una lacuna di prodotto.
      Il cancello va eseguito **dentro** quel lavoro, prima di dichiararlo chiuso. Se apre una
      lacuna, la lacuna è parte di quel lavoro: non diventa una voce nuova del backlog.
      Il candidato più vicino è `#198` T9, che costruirà righe in otto tabelle.

## Trappola nota

L'esito si legge **sul codice d'uscita del processo**, mai dai messaggi stampati: in S1049 tre
strumenti hanno prodotto falsi verdi, uno esattamente per aver letto l'esito dai messaggi.

## Chiuso quando

Mai: è un presidio. Si misura che regga — nessun lavoro che popola tabelle chiuso senza il
cancello eseguito e verde sul processo.
