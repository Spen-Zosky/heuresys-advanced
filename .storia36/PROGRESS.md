# storia36 — stato di esecuzione

> Piano: `docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md` (leggerlo PRIMA di toccare qualsiasi cosa).
> Regole: un cluster non si lascia a metà; ogni riga spuntata porta l'evidenza (comando + esito + data).
> Se interrotti: marcare `INTERROTTO al passo N — <evidenza>` sul cluster e committare.

## Decisioni vincolanti (Enzo, S1033)
- Finestra: **2023-08-01 → 2026-07-31** · riorg **2025-03-01** · crescita moderata · aree delicate a volumi bassi · dump prima di tutto · popolazione chiusa (nessun utente nuovo).
- **Verifica su 4 assi per OGNI cluster** (piano, sezione dedicata): **DOSSIER per-entità** (registro DERIVATO dal grafo FK, completezza 206/206 tabelle mappate; persona/processo/OU/posizione/team/cascata-KPI/tenant — la persona è solo un'istanza) · review adversarial (3 revisori, rilievi qui sotto nel diario) · self-test di ogni check (iniezione violazione → deve scattare) · riconciliazione aggregati. La riorg (C6) ri-esegue i dossier di TUTTE le entità toccate.
- **Ripetibilità** (piano, sezione "tre modi"): entrypoint `db/scripts/storia36.sh` {costruzione·custodia·avanzamento} dal C0; check = asserzioni di proprietà con finestra a PARAMETRO, mai fotografie; custodia = report + triage a 3 esiti (mancante→repair · check troppo rigido→correggi il check · rottura→item), MAI riparazione automatica di righe modificate; schedulazione settimanale al C12.

## Cluster

- [ ] **C0 Fondazioni** — dump · baseline · `00_foundation.sql` · `verify-storia36.sql` v1 (G3 lasciato ROSSO di proposito)
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

_(vuoto — il programma non è ancora partito)_
