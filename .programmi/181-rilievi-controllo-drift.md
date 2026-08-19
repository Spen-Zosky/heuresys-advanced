# 181 — I sette rilievi sul controllo di drift, e le correzioni entrate in main senza verifica

> **item**: #181
> **stato**: CHIUSO
> **chiuso**: 2026-08-19 (S1071) — 4/4 fasi

Tre revisori adversarial hanno prodotto **7 rilievi riproducibili** sul codice di `Z-112`
(misurato S1053), **uno confermato da due lenti indipendenti** e tre che toccano il **disegno**.

**Perché conta**: è il controllo entrato in main da poche ore per accorgersi che la suite lascia
righe sul database. Un controllo con un falso-verde muto e un test che può diventare vacuo
restando verde è la **terza occorrenza della stessa classe di difetto** in due sessioni — un
controllo che esiste e non controlla.

## ⚠️ Il fatto da affrontare per primo

**Le correzioni sono ENTRATE IN MAIN SENZA ESSERE VERIFICATE.** Il commit `27c6025d` (ritiro
della modalità parallela) le ha inghiottite: un `git add -u` ha preso tutti i file modificati
invece dei soli file del ritiro. Sono **174 righe** su `drift-check.ts`,
`drift-check.integration.test.ts` e la config.

Prima di qualunque altra cosa: **valutarle e riprenderle, oppure scartarle e rifare**. Non si
costruisce sopra un codice entrato senza essere passato da una verifica.

## Perimetro e classificazione

Terreno `apps/api/test/**` + `apps/api/vitest.config.ts` — **lo stesso perimetro di `Z-112`**,
classe A. **Non riapre `Z-112`**: il suo criterio («un check post-suite conta le righe residue e
fallisce se >0») è soddisfatto e il verdetto verde resta valido. Questi sono difetti del codice
che quel cluster ha prodotto, non un criterio non raggiunto.

## Fasi

- [x] **F1 Decidere che fare delle 174 righe già in main** — FATTO 2026-08-19 · esito: **RIPRESE**,
      non rifatte, e la decisione è misurata. Lette una per una contro i sette rilievi: **le
      coprono tutte e sette**, e con la spiegazione del perché (① `throw` → `process.exitCode`, con
      l'esperimento dei due globalSetup finti · ② `colonneSorvegliate()` + il ramo che dichiara la
      cecità · ③ il test confronta con `%` invece che con `PREFISSI`, più una guardia che lo rende
      rosso invece che vacuo · ④ prefisso `IT\_SSE\_%` con l'escape spiegato · ⑤ il commento dice
      cosa il lucchetto NON protegge · ⑥ «occorrenze», non «righe» · ⑦ il conteggio corretto).
      **Provate adesso, per la prima volta**: `vitest run test/drift-check.integration.test.ts` →
      **7/7 passati**, 715 colonne ispezionate, 4 residui pre-esistenti riconosciuti, nessuno
      aggiunto. 🔬 Reperto: il commento dichiarava **695** colonne e il vivo ne censisce **715** —
      numero variabile cristallizzato, terza volta su quella riga. Tolto: ora rimanda a
      `colonneSorvegliate()`, che lo conta.
- [x] **F2 Il rilievo 1 — confermato da due lenti** — FATTO 2026-08-19 · il codice era già corretto
      (F1) e **la prova esisteva già**, tracciata: `scripts/test/drift-check-rilascia-il-lucchetto.sh`.
      Il difetto era che **non la eseguiva nessuno** — né la batteria né il cancello: un controllo
      che esiste e non controlla, cioè il difetto che questa voce racconta, applicato alla prova del
      difetto stesso. Eseguita: **5/5 verdi**, incluso «il lucchetto è stato rilasciato: la catena
      dei teardown è arrivata in fondo» e «il rilevatore ha VISTO la riga». Instradata in
      `verify_gate` come suite `drift-lock` su `drift-check.ts` e `vitest.config.ts` — non nella
      batteria, perché pretende il database e una corsa vera di Vitest. ⚠ Le rotte specifiche
      **aggiungono** typecheck+test-api invece di sostituirli: `route()` si ferma al primo match, e
      una rotta con il solo `drift-lock` avrebbe tolto il typecheck ai file più delicati.
      `drift-check.ts:185` + `vitest.config.ts:83`: quando il drift lancia — cioè **nel caso per
      cui il codice esiste** — il teardown interrompe la catena di Vitest e `.zp/suite.lock` non
      viene mai rilasciato. **Si è manifestato da solo**: all'apertura di S1053 il lock era su
      disco col PID 23580, morto dalle 12:38. Non ha bloccato nulla perché `suite-lock.ts` ignora
      e sovrascrive un lock stantìo — verificato leggendo il codice, non assunto — ma il residuo
      resta. La prova deve mostrare il lock **rilasciato** proprio nel caso in cui il drift lancia.
- [x] **F3 Il rilievo 2 e gli altri di misurazione** — FATTO 2026-08-19 · il rimedio al falso-verde
      muto esisteva dal 2026-08-10 e **non aveva prova**: per esercitare il ramo cieco serviva
      rompere i grant di un database vero, quindi non si provava mai — un rimedio senza prova è
      la stessa specie di difetto che rimedia. Estratta `esitoBaseline(mappa, colonne)`, la
      decisione isolata dal database: due test la chiamano con due numeri e tengono separati
      «nessun residuo» e «non ho guardato». **9/9**, e il sabotaggio del ramo (`if (false)`) li
      fa diventare rossi. 🔬 La prima asserzione era **mia e sbagliata** — cercava `nessun
      residuo` nel messaggio cieco, che contiene quelle parole dentro la negazione: il test è
      caduto e mi ha costretto a leggere il messaggio vero invece di presumerlo
      `drift-check.ts:147`: `censimento()` non distingue «695 colonne censite» da «nessuna colonna
      trovata», cioè il falso-verde muto. Un censimento che torna vuoto deve **dirlo**, non
      passare per un censimento riuscito.
- [x] **F4 I tre rilievi che toccano il disegno** — FATTO 2026-08-19 · i sette esiti sono scritti
      **accanto al codice** (testa di `drift-check.ts`), come `chiuso-quando` pretende. I tre di
      disegno: ③ il test vacuo → confronto con `%` più la guardia che lo rende rosso invece che
      vacuo · ④ `PREFISSI` → aggiunto `IT\_SSE\_%`, con la ragione dell'escape · ⑤ il commento
      sulla protezione → **ACCETTATO E DICHIARATO, non risolto**: il lucchetto non copre gli E2E
      Playwright, il limite è scritto dove sta il `globalSetup`, e renderlo globale sarebbe un
      lavoro a sé che nessuno ha misurato servire
      Non sono correzioni di riga: vanno decisi, e la decisione va scritta accanto al codice.

## Chiuso quando

Ognuno dei sette rilievi ha un esito scritto — corretto, oppure dichiarato accettato con la
ragione — le 174 righe hanno una provenienza dichiarata, e ogni correzione porta una prova che è
stata vista fallire.
