# Prompt di ripresa — sessione S1074

> Scritto a fine S1072 (2026-08-19). Si incolla **tal quale** come primo messaggio.
> Sostituisce `mandato-S1073-prompt-ripresa.md`, che è stato eseguito per intero.

---

avvia sessione

Riprendo da #132 F4. Il piano è .programmi/132-ricerca-genera-il-modello.md; F2 e F3 sono
chiuse — il contenuto di un modello si legge dal database e l'archetipo scritto a mano non
esiste più.

CONTESTO CHE NON DEVI RI-CHIEDERMI

F4 è "il motore di ricerca", e l'indagine fatta a fine S1072 l'ha ridimensionata: il REGISTRO
delle corse esiste già — tre moduli API completi (seed-acquisition-runs, seed-candidate-records,
seed-approval-decisions) su cinque tabelle sys_seed_* — e `trigger` REGISTRA una corsa senza
eseguirla. Manca solo il motore che legge davvero una pagina web. Non parti da zero.

Tre cose misurate che valgono come vincoli:
· le cinque tabelle sono GIÀ IN USO da storia36 (12 corse): conviverci, non appropriarsene, e
  la post-condizione dovrà proteggere QUELLE righe, non solo le nuove;
· sys_seed_source_evidence è già "indirizzo + data + impronta" e approval_decisions ha già la
  decisione motivata: mancano il legame alla versione di variante e il tenant_id nullabile;
· la difesa di §4.4 (una pagina web può contenere istruzioni, e la ricerca le legge) non ha
  ancora nulla su cui appoggiarsi — va scritta INSIEME al motore, non dopo.

D-81 (BLUEPRINT_FIELD_LOCKED) si estingue qui: il register lo dichiara "non lavorabile per
costruzione" in attesa di questa voce, e il codice d'errore è già scritto nella specifica §4.8.

VINCOLO: da F3 a F6 nessuna azienda è costruibile — il modello è vuoto e il sistema si rifiuta
dicendolo (BLUEPRINT_CONTENT_EMPTY). Non è un guasto: non "aggiustarlo".

METODO DI LAVORO (è già implementato: usalo, non reinventarlo)

· Ogni voce multi-sessione ha il suo piano in .programmi/<id>-<slug>.md, con le fasi, il budget
  dichiarato e l'evidenza accanto a ogni spunta. Una spunta senza evidenza è un difetto: lo dice
  `python docs/kb/tools/programmi.py --verifica`.
· Il menu di avvio si DERIVA da register + piani (build_menu.py). Non ricopiare mai
  l'avanzamento nel register: è vietato da un cancello.
· Prima di aprire una fase, misura la capienza:
  `python docs/kb/tools/guardiano.py --budget N`. Se non ci sta, non aprirla a metà: fai
  l'indagine, che è essa stessa un deliverable, e scrivine l'esito.
· Ordine dentro la coda: prima ciò che protegge la verifica del resto, poi le voci corte, poi
  le lunghe.
· Commit atomico a ogni fase conclusa, push a fine voce. Prima di ogni push che tocca db/, la
  prova generale sul linux-pc (ci-rehearsal.sh, due passate).
· Ogni prova deve poter fallire: sabotala e verifica che diventi rossa.
· ⚠ Prima di decidere COSA SIA un oggetto del database, leggi il file che lo crea. In S1072 una
  misura vera ha suggerito una conclusione falsa DUE VOLTE, e la smentita stava a un grep di
  distanza (memoria: feedback_read_the_file_that_creates_it).
· Le decisioni di business e di esposizione dati sono mie; tutte le decisioni tecniche le
  prendi ed esegui tu.
· Alla soglia del guardiano: interrompi, registra, committa, pusha, chiudi.

DOPO LA CORSA INIZIALE, avvia in quest'ordine

 1. #132 F4→F7 — la corsa principale. Sblocca #198 T9b e #205.
 2. #219 F1 — gli otto guasti dietro i rossi della suite E2E. Corta e va per prima fra le
    secondarie: le due firme che potrebbero NON essere guasti (MFA e il test che riceve 400)
    tolgono 3 casi su 12 senza toccare il prodotto.
 3. #198 T9b — la costruzione in produzione, da rifare solo dopo che #132 F6 ha riempito un
    modello.
 4. #205 F1→F3 — si sblocca appena #132 è chiusa.
 5. #143 F2 — una squadra è un progetto: serve il modello, non un puntatore al capo.

DUE COSE APERTE CHE NON SONO VOCI (decidile tu quando le incroci)

· Il dominio "processi" ha due case: sys_blueprint_process_registry (23 righe, esisteva già) e
  sys_blueprint_content_processes (creata da #132 F1, vuota). #132 F5 deve sceglierne una, e
  la scelta non è simmetrica — attribuiscono il processo a cose diverse, una posizione contro
  una unità.
· Il clone di CI e la produzione non hanno gli stessi vincoli: su sys_source_lineage_records il
  clone porta una FK su tenant_id che la produzione non ha. Una delle due è alla deriva.
