# Onda 2 in advanced — le sessioni Sonnet (PE-6)

Scritto dalla sessione PE-6.1 (S1119, 2026-10-17). Dieci sessioni, in ordine, una alla volta su questo repository. Ogni sessione ha il suo file di mandato, da passare così com'è al lancio (modello per nome: `claude-sonnet-5-5`).

Fonti del disegno, da leggere secondo quanto chiede ogni mandato: `docs/architecture/adr/0046_perimetro_del_tenant.md` (perimetro S4), `.programmi/onda2/DISEGNO_tabelle-onda2.md` (tabelle e colonne, con le regole comuni C1-C11), `.programmi/onda2/PIANO_passo3-partecipazione.md` (passo 3 di ADR-0044), ADR-0043, ADR-0044, ADR-0045.

## Sequenza

| # | sessione | mandato | dipende da | tetto proposto |
|---|---|---|---|---|
| 1 | O2-01 | `O2-01_contenuto-modello-v03.md` — migrazione del lato modello (M1) | niente | 8 USD |
| 2 | O2-02 | `O2-02_caricatore-pacchetto-v03.md` — il caricatore legge e rilegge il pacchetto v0.3 | O2-01; pacchetto v0.3 del caso banca depositato dal datastore (PE-5) | 8 USD |
| 3 | O2-03 | `O2-03_struttura-tenant.md` — processi, attività, capability, ore, responsabilità (T1-T8) | niente (può precedere O2-02) | 8 USD |
| 4 | O2-04 | `O2-04_strategia-decisioni-entita.md` — T9-T12 e il legame con le approvazioni (R19) | O2-03 | 8 USD |
| 5 | O2-05 | `O2-05_colonne-tenant-ed-esposizione.md` — colonne sulle tabelle esistenti, profili degli indicatori, contratti condivisi | O2-03, O2-04 | 8 USD |
| 6 | O2-06 | `O2-06_materializzazione-v03-e-catena.md` — attivazione v0.3 senza mani e lettura della catena (cancello G2 su copia) | O2-02, O2-03, O2-04, O2-05 | 10 USD |
| 7 | O2-07 | `O2-07_perimetro-risolutore-e-cancello.md` — S4 parte 1 | O2-01; ADR-0046 approvato | 10 USD |
| 8 | O2-08 | `O2-08_perimetro-ricerche-agente-liste.md` — S4 parte 2 | O2-07 | 10 USD |
| 9 | O2-09 | `O2-09_partecipazione-passo3a.md` — letture sulla posizione | P1-P3 del piano del passo 3 | 8 USD |
| 10 | O2-10 | `O2-10_partecipazione-passo3b.md` — scrittura vecchia spenta, sentinella | P4 del piano del passo 3 | 6 USD |

Somma dei tetti: 84 USD. Stima realistica, dalle misure dell'onda 0 (3-8 USD per sessione Sonnet): fra 45 e 70 USD. O2-09 e O2-10 possono anticipare in qualunque punto della sequenza appena le loro precondizioni sono vere, perché non toccano le tabelle delle altre sessioni.

## Che cosa dipende dall'Amministratore di Sistema

- L'approvazione di ADR-0046 (blocca O2-07 e O2-08).
- Le decisioni D-P3-1, D-P3-2, D-P3-3 e lo scostamento sul vincolo del passo 3b (blocca O2-09 e O2-10), con le raccomandazioni nel piano del passo 3.
- I rilasci: della `000457` e del passo 2 di PE-4 (P1, P2), di ogni migrazione dell'onda, del passo 3a (P4). Nessuna sessione arma `refs/heads/prod`.
- Le corse in produzione degli script fuori catena (riempimento dei processi del tenant, regole del passo 3, disattivazioni): sono scritture sui dati vivi.

## Regole comuni a ogni mandato

1. Leggi prima `CLAUDE.md` del progetto e la memoria; poi le fonti che il mandato elenca. Non si presenta il menu dell'avvio: il mandato è il compito.
2. Il piano del ciclo è un file: `.programmi/onda2/esiti/O2-NN.md`, con la tabella delle voci (id, cosa, chi, che cosa vuol dire fatta, stato), la simulazione di ogni voce prima di eseguirla e, all'inizio, che cosa non si chiude nella sessione. Lo stesso file diventa l'esito, con chiusura binaria («CICLO CHIUSO — N/N» oppure «CICLO NON CHIUSO — manca K, serve Y»).
3. Prima di toccare un oggetto condiviso: `python docs/kb/tools/chi_sorveglia.py <nome>`. Le colonne esistenti si riverificano con `\d` sul gemello, non si prendono dal disegno.
4. Nessuna scrittura sul database di produzione, nessun accesso di scrittura via tunnel, nessun rilascio, nessuna propagazione. Le prove girano su copie usa-e-getta del gemello con nome unico (`createdb -T heuresys_advanced heuresys_advanced_o2NN_<suffisso>`), che non si cancellano: si elencano nell'esito. Il clone del gemello è indietro: si migra la copia prima di provare.
5. Ogni migrazione: idempotente, provata con `bash db/scripts/prova-idempotenza.sh` e con `ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'` (catena due volte) prima del push; la sua inversa fuori catena in `db/scripts/onda2/`, provata andata e ritorno (C11). Se il clone del repository sul gemello è indietro o sporco, si esporta l'HEAD committato in una cartella nuova del gemello e si punta lì (`IDEMPOTENZA_REPO`), come in PE-4.
6. Ogni prova nuova si vede rossa prima e verde dopo; almeno una mutazione per prova.
7. Niente cancellazioni (ciò che va tolto si sposta in `_da_eliminare/`), niente `push --force`, `reset --hard`, `--no-verify`, `--amend` su commit pubblicati. Commit su `main` con percorsi espliciti (`git add <path>`, `git commit -F <file> -- <path>`), stile `feat(db): …`, `feat(api): …`, `test(api): …`, `docs(handoff): …`; push su `main` autorizzato.
8. Nei testi mai il nome proprio dell'utente: si scrive «Amministratore di Sistema».
9. Una scoperta fuori mandato va nel registro dell'esito, sezione «fuori da questo ciclo: lo vuoi nel prossimo?»; non si esegue.
10. Chiusura: `python docs/kb/tools/verify_gate.py check`, `.handoff/STATE.md` aggiornato, `python docs/kb/tools/chiudi.py` (leggero). Alla soglia di capienza (contesto 75%, finestra 5 ore 80%) si chiude in ordine.
11. Tetto di spesa: quello del mandato. A 80% del tetto si smette di aprire voci nuove e si chiude ciò che è aperto.
