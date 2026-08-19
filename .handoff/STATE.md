# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-19 (S1072).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

⚠⚠ **IL MOTORE COSTRUISCE ANCORA UNA BANCA, e questa volta l'ha fatto in produzione.** `#198` T9b
ha creato un'azienda vera partendo dall'archetipo: 184 righe, tutte tracciate, prove A/B/C
superate. Ma era **la terza banca**, ed Enzo l'ha visto subito. L'azienda è stata **disfatta per
intero** (conteggi tornati esatti, RTL e Heuresys contati riga per riga: intatti). La causa è
`apps/api/src/modules/tenant-materialization/blueprints.ts` — 296 righe di banca cablata — e
`#132` F3 è la fase che la ritira.

## Last session brief (S1072 «la prova che riesce e mostra il difetto»)

Il filo: **una prova può passare e dire che il lavoro è sbagliato**. T9b è verde su tutti i suoi
criteri e ha comunque prodotto la cosa che non si vuole; la corsa integrale dei test ha trovato
sei rossi che erano miei; la prova generale ha fermato due migrazioni prima della CI.

**Chiusa**: `#142` (le otto famiglie di cruscotto hanno pagina, dati veri e sei login reali).
**Avanzate**: `Z-251` F2+F3 · `#211` F3 · `#214` F5 + terzo perimetro · `#132` **F1**.
**Aperta**: `#218`, la direttiva di Enzo sui residui del legacy senza referente.

⭐ **DUE CORREZIONI DI ENZO che orientano il seguito**: *«ogni volta crei una banca e questo è un
errore grossolano»* — e, più a fondo, *«è il flusso di creazione che deve generare anche quegli
oggetti»*: un'azienda di un tipo mai visto non deve **trovare** famiglia e modello, deve
**produrli**. È `#132` F6.

⚠ **DUE MIEI ERRORI DELLA STESSA SPECIE**, entrambi scritti accanto al lavoro: ho chiesto conferma
per T9b senza dire che l'azienda sarebbe stata **necessariamente** una banca; e ho letto «0 su 9»
come «225 righe orfane» quando il file che le crea diceva cosa fossero. Misurare una cosa vera non
autorizza a concluderne un'altra.

## Top priorities (prossima sessione)

1. **`#132` F2 — il motore legge il piano dalle tabelle, non dal file.** F1 ha appena creato la
   casa (mig. `000327`: cinque tabelle di contenuto agganciate alla versione). F2 è la seconda
   implementazione di `BuildSource`, e apre la strada a F3, che cancella le 296 righe di banca.
   Piano in `.programmi/132-ricerca-genera-il-modello.md`.
2. **`#211` F4 — il criterio di verde della suite E2E.** La corsa integrale è **rossa**: 352
   passati, **13 falliti**, 82 non eseguiti su 448. I 13 NON sono i sette corretti in F3 — sono
   altri, mai triati. Finché il criterio non è dichiarato, quel rosso resta invisibile.
3. **`#218` F1 — il censimento dei residui del legacy senza referente locale.** Direttiva di Enzo:
   per ognuno eliminare (preferito) o creare il referente. Serve prima il numero.

## Open questions

- **Il residuo che la suite E2E lascia in produzione.** Una «Famiglia di collaudo» creata da un
  test e mai ripulita ha fatto fallire un deploy. La suite web non ha un controllo di drift come
  quella API: voce da aprire, o capitolo di `#181`.
- **`sys_compensation_bands` ospita 29 righe che non sono bande** (contratti e sigle senza
  importi): una tabella che porta due specie. Nominato in `#215`, mai bonificato.
- **I 13 rossi della corsa E2E integrale non hanno ancora un triage.** Diversi dai sei di `#211`
  F0: quelli erano noti e nominati, questi no.

## Verification

I numeri non si scrivono qui: si scrive il comando che li produce (⭐ PUNTO FISSO).

```bash
python docs/kb/tools/session_start.py        # menu + salute, un solo giro
python docs/kb/tools/guardiano.py            # contesto e finestra 5h, misurati
python docs/kb/tools/handoff_lint.py         # coerenza di stato e register (bloccante)
python docs/kb/tools/programmi.py --verifica # integrità dei piani multi-sessione
ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'   # prima di ogni push su db/
bash scripts/verifica-deploy.sh              # cosa gira DAVVERO sulle macchine
```
