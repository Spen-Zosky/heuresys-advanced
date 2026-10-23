# Consolidamento advanced ↔ datastore — indice

Programma aperto il 2026-10-23 su mandato di Enzo (thread «Consolidamento Advanced e Datastore» del progetto «heuresys ecosystem»). Ramo di lavoro: `claude/project-thread-adoo53` in `heuresys-advanced` e in `heuresys-datastore`. Questo indice è la fonte autorevole del programma; non sostituisce `.handoff/STATE.md`, `docs/kb/SOT_*` né i registri del datastore, che restano le fonti di stato dei due progetti.

## Perimetro

Rendere affidabile il percorso Datastore → Platform → Tenant: contratto del fascicolo, consegna, ricevimento, adozione da parte del tenant, perimetro, parità dei cataloghi, confine nei due versi, interfacce. Il programma completa ADR-0043 (accettato) e ADR-0046 (proposto) e i piani già scritti (`.programmi/onda2/`, datastore `esecuzione/onda1/`), senza duplicarli: dove un incremento coincide con una sessione già disegnata, rimanda a quella.

Fuori perimetro, dichiarato all'inizio: S5 e S6 (gesti di Enzo dopo la parità), contratto v0.4 (D-72), passo 3 della partecipazione (#270), trasloco D-85 (altro thread), backup e storia36 (altri thread).

## Documenti

| documento | contenuto |
|---|---|
| `01_RILIEVI.md` | registro dei rilievi R-01…R-53, con gravità, evidenza, classe (verificato / inferenza / non disponibile) e incremento che li chiude |
| `02_ARCHITETTURA.md` | modello di responsabilità, contratto del fascicolo di destinazione requisito per requisito, canale, flusso inverso, decisioni |
| `03_PIANO.md` | incrementi C0…C13 con dipendenze, prove, criteri di completamento e recupero; criteri di accettazione del programma |
| `04_VERIFICHE.md` | registro delle verifiche (PASS / FAIL / NON ESEGUITO) e documento di ripresa |
| `lavoro/A_contratto_gap.md` | contratto esistente contro gli otto requisiti del mandato; tabella produttore/consumatore per sezione |
| `lavoro/B_capacita.md` | matrice delle capacità (24), decisioni aperte (12), contraddizioni (K1-K13) |
| `lavoro/D_schede_riconciliazione.md` | 15 schede di famiglie omologhe, anomalie A-01…A-14 |
| `lavoro/F_webapp.md` | censimento delle pagine dei due progetti, misura pagina per pagina della voce 17 di ADR-0043, proposta per ogni webapp |
| `lavoro/G_revisione_indipendente.md` | revisione indipendente della Fase B |
| `lavoro/E_api.tsv`, `lavoro/C_*.tsv` | inventari granulari (797 rotte; schemi ricostruiti dalle migrazioni) |
| `lavoro/strumenti/` | gli script che rigenerano gli inventari (comandi nelle intestazioni) |

## Stato del programma

| fase | stato | evidenza |
|---|---|---|
| A — ricognizione e baseline | fatta sui repository; baseline dei database della VM in corso (sessione sulla VM, sola lettura) | sezione «Baseline» qui sotto |
| B — diagnosi e progetto | fatta; revisione indipendente: «APPROVABILE CON CORREZIONI», correzioni applicate a 01-03 | `lavoro/G_revisione_indipendente.md` |
| Approvazione complessiva | **approvata il 2026-10-23 in forza della delega notturna di Enzo** (messaggi delle 02:06 e 02:07 UTC: «prendere tu le migliori decisioni (quelle che mi vengono raccomandate) al posto mio», «ti delego anche quelle»), alle condizioni riportate dal coordinatore: revisione indipendente prima, niente scritture in produzione senza backup verificato e ritorno provato, niente cancellazioni, niente spese. L'approvazione copre **il piano**; ADR-0046 (correzione), ADR-0047 e ADR-0048 restano **PROPOSTI** per Enzo, perché emendano decisioni già prese (raccomandazione della revisione indipendente, R-53) | questo file |
| C — implementazione | iniziata con gli incrementi che non scrivono in produzione | `04_VERIFICHE.md` |
| D — validazione e consegna | non iniziata | — |

## Migrazioni prenotate

Per non avere due sessioni che scrivono lo stesso numero (onda 2 e consolidamento sullo stesso `db/migrations`). Ultima migrazione al 2026-10-23: advanced `000458`, datastore `0160`.

| numero | incremento | stato |
|---|---|---|
| advanced `000459` | C4 — versione fissata sull'attivazione | prenotato |
| advanced `000460` | C3 — registro dei ricevimenti e unicità `(prototipo, versione)` | prenotato |
| advanced `000461` | C11 — esemplare del vincolo globale sui formativi (la fonte si emenda in `000237`) | prenotato |

Una sessione dell'onda 2 che deve scrivere una migrazione prende il primo numero libero dopo questi, oppure aggiorna questa tabella.

## Baseline

Repository al 2026-10-23, clone di questo container: advanced `main` a `2706044` (2026-10-21 20:27 +0200), datastore `main` a `c263bda`; ramo `interfaccia-unica` del datastore su origin a `2f3c368`, non unito. Nessuna modifica preesistente nei cloni.

Database e servizi della VM: sezione da completare con il resoconto della sessione di sola lettura sulla VM (vedi `04_VERIFICHE.md`).

Verifiche iniziali sostenibili: nessun database raggiungibile da questo container; le prove dei due progetti che non richiedono il database si eseguono in Fase C e si registrano in `04_VERIFICHE.md`, separando i problemi preesistenti dalle regressioni.
