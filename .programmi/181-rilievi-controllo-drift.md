# 181 — I sette rilievi sul controllo di drift, e le correzioni entrate in main senza verifica

> **item**: #181
> **stato**: NON AVVIATO

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

- [ ] **F1 Decidere che fare delle 174 righe già in main** — budget ~30k
      Leggerle contro i sette rilievi: quali coprono un rilievo e reggono, quali no. L'esito è
      scritto: riprese o rifatte, e perché. Nessun «erano già lì».
- [ ] **F2 Il rilievo 1 — confermato da due lenti** — budget ~40k
      `drift-check.ts:185` + `vitest.config.ts:83`: quando il drift lancia — cioè **nel caso per
      cui il codice esiste** — il teardown interrompe la catena di Vitest e `.zp/suite.lock` non
      viene mai rilasciato. **Si è manifestato da solo**: all'apertura di S1053 il lock era su
      disco col PID 23580, morto dalle 12:38. Non ha bloccato nulla perché `suite-lock.ts` ignora
      e sovrascrive un lock stantìo — verificato leggendo il codice, non assunto — ma il residuo
      resta. La prova deve mostrare il lock **rilasciato** proprio nel caso in cui il drift lancia.
- [ ] **F3 Il rilievo 2 e gli altri di misurazione** — budget ~40k
      `drift-check.ts:147`: `censimento()` non distingue «695 colonne censite» da «nessuna colonna
      trovata», cioè il falso-verde muto. Un censimento che torna vuoto deve **dirlo**, non
      passare per un censimento riuscito.
- [ ] **F4 I tre rilievi che toccano il disegno** — budget ~40k
      Non sono correzioni di riga: vanno decisi, e la decisione va scritta accanto al codice.

## Chiuso quando

Ognuno dei sette rilievi ha un esito scritto — corretto, oppure dichiarato accettato con la
ragione — le 174 righe hanno una provenienza dichiarata, e ogni correzione porta una prova che è
stata vista fallire.
