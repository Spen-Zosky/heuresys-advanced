# PE-6.1 — piano del ciclo (onda 2, solo disegno)

Sessione S1119 (seconda apertura), 2026-10-17. Mandato assegnato da Cowork. Solo disegno: nessuna migrazione scritta o applicata, nessuna scrittura su database, nessun accesso alla produzione.

## Voci

| id | cosa | chi | fatta vuol dire | stato |
|---|---|---|---|---|
| V1 | ADR-0046, perimetro S4 (ricerche, liste di scelta, agente confinati nel fascicolo) | Claude | file `docs/architecture/adr/0046_perimetro_del_tenant.md` con decisione, alternative scartate, conseguenze, prove; indice ADR rigenerato | FATTO |
| V2 | disegno tabelle e colonne dell'onda 2, con inversa per ciascuna | Claude | file `.programmi/onda2/DISEGNO_tabelle-onda2.md`: nomi fisici, tipi, vincoli, chiavi, indici, direzione del dato, inversa | FATTO |
| V3 | piano del passo 3 della partecipazione per posizione (ADR-0044) | Claude | file `.programmi/onda2/PIANO_passo3-partecipazione.md`: 3a, 3b, sentinella, 57 OWNER, prove, inverse | FATTO |
| V4 | scomposizione in sessioni Sonnet (al massimo 10), mandati pronti | Claude | `.programmi/onda2/README.md` e dieci file `O2-NN_*.md`, ognuno con mandato, prova di chiusura, tetto | FATTO |
| V5 | rito di handoff, verdetto USCITA-SICURA | Claude | `.handoff/STATE.md` aggiornato, commit e push, `chiudi.py` leggero eseguito | FATTO (vedi esito in `.handoff/close-log.ndjson`) |

## Simulazione

- V1-V4 producono solo file markdown nel repository. Precondizione: albero pulito su `main` (vero all'avvio, `50cb97a2`). Lo strumento è la scrittura di file; la propagazione è il push su `main`, autorizzato dal CLAUDE.md del progetto, che non tocca la produzione (il deploy parte solo da `refs/heads/prod`). Nessuna voce è distruttiva.
- Le misure usate dal disegno vengono dalle migrazioni del repository (lette con `grep` sui file `db/migrations/*.sql`), dai vocabolari del contratto (`D:\heuresys-datastore\src\contratto\v0.3\vocabolari.json`, sola lettura) e dall'esito di PE-4 (`.programmi/esiti-onda0/PE-4.md`). Il database non è stato interrogato, per il vincolo del mandato: ogni conteggio sui dati che il disegno richiede è scritto come comando da eseguire nella sessione che ne ha bisogno.
- V5: `.handoff/STATE.md` si aggiorna a mano; `python docs/kb/tools/chiudi.py` legge e scrive solo `.handoff/close-log.ndjson`.

## Che cosa non si chiude in questa sessione (dichiarato all'inizio)

- Nessuna migrazione, nessun codice: sono il lavoro delle sessioni O2-01 … O2-10.
- L'approvazione di ADR-0046 e le tre decisioni del passo 3 (D-P3-1, D-P3-2, D-P3-3) spettano all'Amministratore di Sistema.
- Il rilascio di `000457` e del passo 2 di PE-4 in produzione (precondizione del passo 3) spetta all'Amministratore di Sistema.

## Registro delle scoperte (fuori da questo ciclo)

- ADR-0044, passo 3b, scrive il vincolo `CHECK (process_participant_position_id IS NOT NULL)`: con la decisione D3 già eseguita su copia, le 164 righe disattivate hanno la posizione nulla e la validazione fallirebbe. Il piano del passo 3 propone il vincolo condizionato all'attività (`NOT is_active OR position_id IS NOT NULL`) come emendamento da approvare.
- Tutte le 496 posizioni scritte per la classe H sono posizioni disattivate (esito PE-4): dopo il passo 3a nessuno dei 57 OWNER si risolve in una persona. Trattato nel piano del passo 3 (D-P3-1).
- Una vista `sys.v_*` è raccolta da `db_health.py` come sentinella a zero righe: nessuna vista di calcolo (perimetro, disponibilità, ore oltre contratto) può avere quel prefisso. Il disegno usa funzioni o calcoli nell'API.
