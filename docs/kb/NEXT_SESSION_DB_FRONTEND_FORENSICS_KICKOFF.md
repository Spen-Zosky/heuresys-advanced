# NEXT SESSION — Forense DB + dati + frontend (KICKOFF)

> **✅ ESEGUITO S1024-S1028** — le 4 fasi del mandato sono state completate (censimento DB, superfici, bilinguismo dati chiuso in S1027 con coverage 0 gap). Documento storico: **non ri-eseguirlo**. I residui non chiusi sono confluiti nel register di `SOT_BACKLOG.md` (#72, #73) e nel piano `docs/superpowers/specs/2026-07-25-zero-pending-plan.md`.

**Autorità del mandato**: Enzo, chiusura S1023 (2026-07-21).
**Contesto**: S1023 ha chiuso il residuo epiche GO-BRANCH (D-08 F2-F5 · D-14 F2-F4 GDPR · D-09 F5) + coda (D-59, #65, D-11, Dependabot). Il prossimo salto di qualità è una verifica forense di **dati e superfici**, con piani di intervento chirurgici.

---

## 0. Standard operativo (invariato — è il contratto, non un auspicio)

Identico a S1022/S1023 (`NEXT_SESSION_EPICS_KICKOFF.md` §0): verify-from-code/DBMS (mai dalla doc), evidence con comando+output, gate meccanici + LIVE su dati reali prima di "done", solo soluzioni professionali, Claude decide il tecnico, branch dedicato per cambi strutturali, fan-out per esplorare + sintesi nel main thread. **In più, regola esplicita di Enzo (S1023): NESSUNA distinzione tra errori pre-esistenti e nuovi/generati da me — tutti vanno trattati e risolti.**

**Doc-tank (regola permanente fino a revoca)**: il trattamento/sostituzione della doc di progetto col clone `../heuresys-advanced-docs-tank/clone-2026-07-20` avviene SOLO su richiesta diretta di Enzo. Fino ad allora il doc-tank va **gestito e tenuto aggiornato man mano che si procede** (ogni sessione che cambia stato/doc rilevante propaga l'aggiornamento al tank).

## 1. Fase 1 — Debiti tecnici: censimento forense

- Verificare la **reale consistenza e contenuto** di ogni riga di `DEBT_REGISTER.md` (stato dichiarato vs stato dal codice/DB — pattern F-A02/D-59: molte righe datano).
- **Caccia ai debiti sfuggiti**: sweep TODO/FIXME/HACK/XXX nel codice, cross-check con i finding audit (`full-forensic-audit/*2026-07-20*`), i rilievi atlas (`ATLAS_CURATED.md`, 193 rilievi), le lanes del register, i warn ricorrenti nei log PROD.
- Aggiornare `DEBT_REGISTER.md` di conseguenza (nuove righe con evidenza; chiusure con verified-by).

## 2. Fase 2 — Database: analisi capillare

Domande a cui rispondere con evidenza (psql, information_schema, pg_stat):
1. **Completezza funzionale**: ogni funzionalità/modulo (~75) ha le backing table POPOLATE che servono? (dottrina `feedback_code_over_docs`: "done" richiede tabella popolata — mappa modulo→tabelle→conteggi; punto di partenza: atlas + F-A08 "tabelle vuote 36 vs 67").
2. **Dati sporchi/inconsistenti**: violazioni semantiche oltre le 6 viste strutturali (date impossibili, enum fuori CHECK di fatto, orfani logici senza FK, duplicati logici).
3. **Tabelle/FK incompleti o mancanti**: censimento FK assenti dove la semantica li richiede (pattern #65: adjacency senza integrità; usare FK `NOT VALID` per integrità prospettica dove i dati legacy non validano).
4. **Tabelle morte**: mai lette/scritte/riferite da codice o altre tabelle (git grep + pg_stat_user_tables) → piano move-not-delete o drop con migration.
5. **Ontologia/semantica** (pilastri del progetto): il DB alimenta correttamente skills taxonomy (14k skill), ESCO, embeddings pgvector, knowledge graph? Coerenza e copertura delle catene semantiche.
6. **Bilinguismo IT/EN**: il modello dati è idoneo alla doppia lingua? (oggi le description dei reference data sono monolingua). Progettare e APPLICARE la strategia i18n a livello dati (colonne per-lingua vs tabella translations vs jsonb) e renderla funzionante.
7. **Pulizia e performance**: bloat, indici inutili/mancanti (estende il lavoro FK-index S1022), `audit.import_validation_results` 547MB (#60 G1), VACUUM/ANALYZE health.

## 3. Fase 3 — Consistenza semantica dei dati + seeding + chiusura brownfield

- **Criteri di coerenza trasversali** (individuarli È parte del task — quello di Enzo è un esempio): un utente RTL Bank (banca regionale) non deve referenziare industry/ruoli/skill/obiettivi/KPI incoerenti col dominio bancario retail; date carriera coerenti con età/anzianità; salary band coerenti col ruolo/level; org-chart senza anomalie (span, profondità); certificazioni plausibili per ruolo, ecc.
- **Ricerca web** per validare i riferimenti reali (nomenclature bancarie, NACE/ATECO corretti per una regional bank, framework di competenze del settore).
- Gap/imprecisioni → **piani di seeding** che garantiscono referenzialità corretta (idempotenti, UUID v5 deterministici — memoria `reference_deterministic_seed_uuid_rfc4122`).
- **2 soli tenant** (Heuresys System + RTL Bank): scovare ed eliminare ogni inquinamento brownfield residuo.
- **Chiusura definitiva brownfield**: oltre al freeze D-11 (fatto, flag OFF in PROD) — rimuovere/disattivare le connessioni residue verso il progetto e il DBMS legacy (config, script attivi, riferimenti runtime); da ora le analisi su contesti vecchi = task mirati che non sporcano il progetto. Documentare in ENGINE_STATUS.md / ADR se serve.

## 4. Fase 4 — Frontend e interfacce: forense per-superficie

Strategia semplice e capillare (strumenti a scelta: chrome-devtools, Playwright, CLI):
per OGNI interfaccia (admin SPA + ESS + showcase) censire **i dati che espone e come li espone**:
- codici/chiavi illeggibili dove serve la descrizione umana;
- testi non intellegibili, dati non reali, mock/hardcoded residui;
- formati scorretti (date, valute, numeri);
- **mix italiano/inglese** (incoerenze i18n — si aggancia alla Fase 2.6);
- link e navigazioni rotte;
- dataset poveri/ristretti dove il DB ha di più;
- errori e imprecisioni di ogni tipo.
Esito per pagina: scheda findings → **piani di intervento mirati e chirurgici** (API-first dove manca il dato, fix UI dove è presentazione), eseguiti coi gate consueti.

## 5. Boot della sessione

`python docs/kb/tools/session_start.py`, poi QUESTO kickoff. Le 4 fasi sono in sequenza deliberata (i fix dati precedono il forense frontend, che altrimenti fotografa problemi già destinati a cambiare).
