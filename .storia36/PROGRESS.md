# storia36 — stato di esecuzione

> Piano: `docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md` (leggerlo PRIMA di toccare qualsiasi cosa).
> Regole: un cluster non si lascia a metà; ogni riga spuntata porta l'evidenza (comando + esito + data).
> Se interrotti: marcare `INTERROTTO al passo N — <evidenza>` sul cluster e committare.

## Decisioni vincolanti (Enzo, S1033)
- Finestra: **2023-08-01 → 2026-07-31** · riorg **2025-03-01** · crescita moderata · aree delicate a volumi bassi · dump prima di tutto · popolazione chiusa (nessun utente nuovo).
- **Verifica su 4 assi per OGNI cluster** (piano, sezione dedicata): **DOSSIER per-entità** (registro DERIVATO dal grafo FK, completezza 206/206 tabelle mappate; persona/processo/OU/posizione/team/cascata-KPI/tenant — la persona è solo un'istanza) · review adversarial (3 revisori, rilievi qui sotto nel diario) · self-test di ogni check (iniezione violazione → deve scattare) · riconciliazione aggregati. La riorg (C6) ri-esegue i dossier di TUTTE le entità toccate.
- **Ripetibilità** (piano, sezione "tre modi"): entrypoint `db/scripts/storia36.sh` {costruzione·custodia·avanzamento} dal C0; check = asserzioni di proprietà con finestra a PARAMETRO, mai fotografie; custodia = report + triage a 3 esiti (mancante→repair · check troppo rigido→correggi il check · rottura→item), MAI riparazione automatica di righe modificate; schedulazione settimanale al C12.

## Cluster

- [x] **C0 Fondazioni** — dump · baseline · `00_foundation.sql` · `verify-storia36.sql` v1 (G3 lasciato ROSSO di proposito) — FATTO 2026-07-27 ⚠ con self-review sostitutiva: la review adversarial a 3 agenti indipendenti è DA RILANCIARE (limite sessione, vedi diario)
- [ ] **C1 Presenze/assenze** — backfill+forward attendance · time-off multi-anno · G3 VERDE
- [ ] **C2 Performance** — 3 cicli annuali goals→check-in→review→360
- [ ] **C3 Compensation** — ricerca premio variabile (doc DOMINIO con fonti) · gates+curves+results 3 esercizi · handoff 36 mensilità · buste storiche
- [ ] **C4 Formazione** — iniziative annuali · assignments/evidence storici · certificazioni con rinnovi
- [ ] **C5 Carriera** — esperienze pre-RTL · target positions · successor readiness · requirement history
- [ ] **C6 Riorg 2025-03** — OU history (presente INVARIATO) · blueprint activations/overrides
- [ ] **C7 Approvazioni** — storico SQL fedele alla macchina a stati + recente via API · KPI templates · notification prefs
- [ ] **C8 Engagement** — cicli semestrali · dip riorg + recupero · action plans · recompute insights
- [ ] **C9 Contenuti** — categorie/media · handbook con versioni storicizzate
- [ ] **C10 Consensi/GDPR/WB/accessi** — consents 162/162 · gdpr 3-5 · wb 1-2 neutri · login events campionati
- [ ] **C11 Config piattaforma** — visualization · crosswalk classificazioni · leads · seed-pipeline auto-referenziale
- [ ] **C12 Audit finale** — batteria intera · audit semantico 206 tabelle · suite+E2E · demo live · heuresys_ci refresh · align clones

## Diario (append-only: data · cluster · cosa · evidenza)

- 2026-07-27 · C0 · dump completo pre-storia36 → `/c/Users/enzospenuso/heuresys-backups/pre-storia36.dump` 120.824.927 byte (~115 MB, >100 MB attesi) · pg_dump -Fc exit 0
- 2026-07-27 · C0 · baseline rimisurata → `.storia36/baseline-20260727.txt`: 206 tabelle sys.*, 37 vuote (conferma audit S1033)
- 2026-07-27 · C0 · `00_foundation.sql` eseguito ×2 → calendario 1096 giorni (755 lavorativi) 2023-08-01..2026-07-31; patrono = Sant'Ambrogio 7/12 (sede = Milano, deciso dal dato `sys_branches` MI-HQ); `staging.storia36_runs`: run1 rows=1096, run2 twice_run_delta=0 ✓
- 2026-07-27 · C0 · registro dossier DERIVATO dal grafo FK → `docs/kb/storia36/DOSSIER_REGISTRY.md` + `db/scripts/verify-storia36-dossier.sql`: 7 dossier (TENANT 172, PERSONA 128, UNITA_ORG 52, POSIZIONE 34, CASCATA_KPI 9, PROCESSO 6, TEAM 2) + CATALOGO 16 + PIATTAFORMA 17 = 206/206; completezza [OK] + SELFTEST verde (tabella orfana iniettata → check scattato → cleanup)
- 2026-07-27 · C0 · `verify-storia36.sql` v1 → G1 (70 colonne BUSINESS_DATE derivate dalla classificazione delle 513 colonne data — `.storia36/analysis/date-columns.md`; default finestra = fine mese CORRENTE perché il DB è produzione viva, 91k login organici) · G2 su 9 tabelle-evento vs hire · G3 · G4 · G5 (6 viste) · G6 (registro twice-run). Esito sul dato attuale: **G1/G2/G4/G5/G6 VERDI + G3 ROSSO di progetto** (375 coppie utente-mese, buste 2026-04..06 senza presenze — mesi di massa disgiunti, conferma incoerenza nota) + SELFTEST G1/G2/G4/G6 verdi (iniezione via ctid + rollback da eccezione)
- 2026-07-27 · C0 · riparazioni triage: **(c) rottura vera** — 3 contratti con end<start (batch seed 2026-06-28) riparati con valori derivati dalle righe sane (`00_repair_g4_contracts.sql`, twice-run 3→0) · **(b) check troppo rigido** — 5 review "pre-hire" erano assunti-2024 nel ciclo ANNUAL 2024 (157/161 review = anno solare): corretto il CHECK (G2 reviews → `review_period_end >= hire`), non il dato
- 2026-07-27 · C0 · entrypoint `db/scripts/storia36.sh` → custodia end-to-end provata (report `qa_artifacts/storia36/custodia-2026-07-27.md` con triage compilato, exit 1 sul rosso G3); `avanzamento` fallisce ESPLICITO (exit 2, "cluster C12 richiesto"); pattern .env come migrate.sh
- 2026-07-27 · C0 · pattern registrati: `docs/kb/DATA_PATTERNS.md` **P-07** (registro derivato dal grafo FK + allowlist falsificabile) e **P-08** (batteria di proprietà parametrica con selftest a iniezione)
- 2026-07-27 · C0 · **review adversarial**: i 3 revisori indipendenti (workflow `storia36-c0-adversarial`) sono FALLITI TUTTI per limite sessione ("You've hit your session limit · resets 7:30pm Europe/Rome") — NESSUNA review indipendente è avvenuta. Eseguita SELF-REVIEW sostitutiva con evidenze (sotto). **DA FARE a inizio prossima sessione (o dopo il reset): rilanciare la review a 3 lenti sui deliverable C0** — il prompt è nello script `storia36-c0-adversarial` (workflows della sessione a9179f79) o si ricostruisce dal piano §"Verifica su quattro assi" punto 2.
- 2026-07-27 · C0 · self-review lente TEMPORALE: pasquette 2024-04-01/2025-04-21/2026-04-06 tutte isodow=1 ✓ · patrono 3 righe 12-07 ✓ · 29 festività su feriale · ricalcolo indipendente workday 755 = 755 ✓ · TZ server Etc/UTC (cast ::date ok)
- 2026-07-27 · C0 · self-review lente DOMINIO: **solo 6 assunzioni nella finestra (tutte 2024, zero 2023-08+, zero 2025-26)** → la "narrativa di crescita" NON può poggiare sull'organico (popolazione chiusa): va espressa via evoluzione organizzativa/riorg — vincolo per C5/C6 · inquadramento 'Quadro' (1 utente) estraneo al CCNL Credito (QD1-4) → registro C3
- 2026-07-27 · C0 · self-review lente INTEGRAZIONE: trovate 21 colonne verso users che sfuggivano alla regex audit; 4 sono write-audit camuffate (`*_created_by_user_id`) → regex raffinata in `verify-storia36-dossier.sql`, PERSONA 128→126 (surveys/survey_templates fuori: erano dentro solo per l'audit di scrittura), 17 sono colonne-RUOLO (approver/reviewer/validator) e restano business · G6 rafforzato a granularità (cluster, seed_file) · modo `costruzione` provato end-to-end (seed ×3 idempotenti, exit 1 sul solo G3)
- 2026-07-27 · C0 · **rilievi per i cluster futuri** (da agenti analisi, non riparati qui — scope): C1: accrual rules etichettate 'CCNL Commercio' vs contratti CCNL Credito 2024 + 5 policy duplicate ×4 · 4 utenti employment senza attendance · parità attendance↔overtime rotta sul weekend (44 WEEKEND + 34 HOLIDAY overtime senza riga attendance) · C2: eligibility min-tenure review (assunto 15/12 con review annuale 2024) · sys_assessments period_start 0 valori vs end 303 · C3: 14 contratti con probation_end<start (sistemico) + fixed_term con durate fino a 7933gg + 13 permanent con end valorizzato + `user_pay_slip_period` in 2 formati senza UNIQUE (user,period) · C5: education records start 3 valori vs end 159
