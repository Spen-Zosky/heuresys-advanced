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
| A — ricognizione e baseline | fatta: repository e baseline della VM | sezione «Baseline» qui sotto |
| B — diagnosi e progetto | fatta; revisione indipendente: «APPROVABILE CON CORREZIONI», correzioni applicate a 01-03 | `lavoro/G_revisione_indipendente.md` |
| Approvazione complessiva | **approvata il 2026-10-23 in forza della delega notturna di Enzo** (messaggi delle 02:06 e 02:07 UTC: «prendere tu le migliori decisioni (quelle che mi vengono raccomandate) al posto mio», «ti delego anche quelle»), alle condizioni riportate dal coordinatore: revisione indipendente prima, niente scritture in produzione senza backup verificato e ritorno provato, niente cancellazioni, niente spese. L'approvazione copre **il piano**; ADR-0046 (correzione), ADR-0047 e ADR-0048 sono rimasti PROPOSTI per Enzo (R-53), che li ha **accettati il 2026-10-23 alle 15:19 UTC** («sì a tutto», con le raccomandazioni del riepilogo del mattino; domanda 1 di ADR-0047 decisa A alle 14:57) | questo file |
| C — implementazione | in corso: C0, C1 (datastore e advanced) e C2 nel codice fatti; bozze di ADR-0047 e ADR-0048 scritte (PROPOSTO); le prove sul database del datastore chieste alla sessione sulla VM | `04_VERIFICHE.md` |
| D — validazione e consegna | non iniziata | — |

## Migrazioni prenotate

Per non avere due sessioni che scrivono lo stesso numero (onda 2 e consolidamento sullo stesso `db/migrations`). Ultima migrazione al 2026-10-23: advanced `000458`, datastore `0160`.

| numero | incremento | stato |
|---|---|---|
| ~~advanced `000459`~~ | C4 — il numero è stato preso da un altro lavoro: C4 è passato alla `000463` | sostituito |
| advanced `000460` | C3 — registro dei ricevimenti e unicità `(prototipo, versione)` | scritto il 2026-10-29 |
| advanced `000461` | C11 — esemplare del vincolo globale sui formativi (la fonte si emenda in `000237`) | prenotato |
| advanced `000462` | ADR-0049 — le attività appartengono a un processo (T1 e T2 dell'onda 2, regole, legame delle richieste) | scritto il 2026-10-27, thread «Collegare le attività ai processi» |
| advanced `000463` | C4 — versione del modello fissata sull'attivazione, processi unici per versione (R-58); emenda `000008` e `000021` | scritto il 2026-10-30 |

Nota del 2026-10-27: il numero `000459` è stato preso da `000459_pe4_passo3b_partecipazione_attiva_ha_posizione.sql`, quindi C4 deve prendere un altro numero.

Una sessione dell'onda 2 che deve scrivere una migrazione prende il primo numero libero dopo questi, oppure aggiorna questa tabella.

## Baseline

Repository al 2026-10-23, clone di questo container: advanced `main` a `2706044` (2026-10-21 20:27 +0200), datastore `main` a `c263bda`; ramo `interfaccia-unica` del datastore su origin a `2f3c368`, non unito. Nessuna modifica preesistente nei cloni.

Database e servizi della VM, misurati in sola lettura il 2026-10-23 alle 02:56 UTC (V-12). Si rimisurano con `systemctl list-units 'advanced-*' 'datastore-*'`, `ss -ltnp` e `psql -l` sui due cluster.

- **Servizi attivi:** advanced-api, advanced-web, datastore-api, datastore-banco, prometheus.
- **Servizi in errore:** advanced-storia36-avanzamento e advanced-storia36-custodia (li segue un altro thread), heuresys-app.
- **Porte:** 3101 e 3103 ascoltano su localhost e Tailscale. La **3104**, il servizio che legge il tenant reale (R-20), **non è in ascolto**. 5432 e 5435 ascoltano solo su localhost.
- **Cluster `16 main` (5432):** `heuresys_advanced` (produzione), `heuresys_ci`, e database di altri progetti.
- **Cluster `16 datastore` (5435):** `heuresys_datastore`, il modello, le copie `*_vm_20261020` e `heuresys_datastore_prova_ripristino`. Le copie `*_pc_20261023` non ci sono più: presumibilmente il trasloco D-85 si è concluso, ma non l'ho verificato con il thread che lo segue.
- **Advanced in produzione:** 2 versioni PUBLISHED e 2 tenancies, coerente con la post-condizione di `000400` (R-50).
- **Ultime migrazioni:** advanced `000458`, datastore `0160`.

Verifiche iniziali sostenibili: nessun database raggiungibile da questo container; le prove dei due progetti che non richiedono il database si eseguono in Fase C e si registrano in `04_VERIFICHE.md`, separando i problemi preesistenti dalle regressioni.
