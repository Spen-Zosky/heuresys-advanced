# Fase 3 — Coerenza semantica dati RTL Bank + piani seeding + chiusura brownfield · S1024 · 2026-07-21

> Output del fan-out F3 (4 analisi read-only, DB live :5433). RTL_BANK = banca retail regionale italiana, 158 utenti/158 posizioni. Diagnosi + piani; l'esecuzione (scritture massive) è ordinata in §5.

## §1 Org-chart & ruoli — SANO, incoerenze minori

Topologia impeccabile (1 radice CEO, 0 cicli/rotture, span max 7, piramide realistica L1=1…L4=129, 27 manager/17%). I 21 ruoli usati sono **tutti bancari plausibili**; OU e team coerenti e italiani. Incoerenze:
- **I2/I3 mancano OU Tesoreria e Internal Audit** (Audit obbligatorio per banca vigilata) — ruoli/family esistono ma inutilizzati.
- **I1/I4** Securities Dealer in filiali retail (→ Tesoreria); 12 Bank Teller nella Divisione invece che in filiale.
- **I5** OU Marketing e Legal&Compliance vuote (0 posizioni).
- **I7** `POS-c550cecf HR Manager` orfano (senza OU né owner).
- **I8-I12 igiene catalogo GLOBALE condiviso** (`sys_job_roles`/`sys_job_families` senza tenant): ~40 ruoli `PROTO-*` industriali/food (SmartFood/EcoNova), doppioni EN/IT, seniority invertite. Non agganciati a RTL_BANK ma inquinano il catalogo.

## §2 Skill / possesso / gap — il framework bancario ESISTE ma è ORFANO

- **F8 (smoking gun)**: **33 skill banking custom già curate per RTL_BANK** (KYC, AML, Basilea III/IV, IFRS 9, credit scoring, PSD2, MiFID II, private/relationship banking, stress testing, core banking, ESG…) → **0 usi** in possesso e requisiti.
- **F1/F2/F3**: possesso = seed demo di **31 skill ESCO generiche**, possesso == requisiti (stesso pool), **2 fuori-dominio** ("materiali avanzati", "regolamentazione della sosta"/parcheggi — quest'ultima richiesta al Compliance Officer).
- **F5**: 10 posizioni apicali (CEO, CRO, Finance Director, direttori) **senza alcun requisito**.
- **F6**: `sys_gap_analysis_results` = 270 righe con **position_id NULL 270/270**, import legacy testuale (skill in free-text EN, nessun FK) — la catena position↔gap è rotta. MA `sys_skill_gap_scores` (154) ha position_id popolato.
- **F7**: la catena user→position→requirement è **intatta** → il ricalcolo gap è fattibile subito.
- Catalogo: ~82 skill ESCO banking + 33 custom → materiale abbondante.

## §3 Date / carriera / retribuzioni — DESIGN buono, COLLEGAMENTI randomici

Ben fatti (preservare): bande retributive (range realistici, monotone), livelli CCNL Credito, certificazioni role-targeted (ABA Teller→22/22, CAMS→compliance/risk, 153/158 coperti), executive tier. Problemi nelle **dimensioni di collegamento seminate a caso**:
- **F2 posizione→banda randomico**: CEO(369k)→banda PR-1(55-82k); IT Director(164k)→Support band(28-42k); le 4 bande alte (IT-1,MG-1,EX-1,EX-2) = 0 posizioni. ~96 dipendenti fuori banda.
- **F3 compressione mid-tier**: Bank Teller 41k ≈ Bank Manager 51k (+23%); vuoto totale 54-105k (bimodale).
- **F1 apprendistato su 50enni** (26 righe, avg 44.5 anni, max tenure 20).
- **F4 seniority_date > hire** (152/158) + 26 pinnati al costante 2021-01-01.
- **F5/F6 batch sintetico**: 49 assunzioni nel 2006 (=20 anni fa esatti, floor rigido), 26 utenti con birth+hire entrambi al 2-dicembre (placeholder).
- **F7 executive mis-classificati** QD4 (Quadro) invece di Dirigente.
- **F9** mancano cert IVASS + MiFID/ESMA/EFPA per i ruoli advisory (Investment Advisor 15, Securities Dealer 12).
- **pay_slips scarsi**: 39 righe, solo 13/158 utenti.
- **F10** 2 utenti (Colombo, Ferri) senza birth_date/gender/contratto.

## §4 Chiusura brownfield — distinguere VIVO da INERTE

- ⚠ **`brownfield.*` è VIVO** (scritto dalla pipeline `reference-sync` attiva, scraping ESCO/ATECO — timer settimanale). **NON toccare.**
- **Già chiuso/inerte**: engine FROZEN (flag OFF in PROD → 404), schema `legacy_mirror` già droppato (000047), 0 cron/systemd invocano brownfield, extract-script tutti manuali.
- **Residui morti da droppare** (rischio nullo/basso, 0 ref runtime): `staging.tmp_*` (29), `staging.legacy_rtl_occupations`, `staging.rtl_*` (14), `temp_sdbi.pf_*` (4) + schema `temp_sdbi`, `audit.skills_junk_archive` (7846, a retention chiusa).
- **Gated su decisione Wave-3 (#17, HOLD, Enzo)**: `staging.wave1_*` (18), i 4 moduli API `brownfield-*`, il **DBMS legacy sulla VM** (`heuresys_platform`/container — unico endpoint legacy vivo; move-not-delete: snapshot→decommission).
- Nota sicurezza: `POSTGRES_PASSWORD` riusata dallo stack evo (da ruotare alla chiusura — collega D-60).

## §5 Piani di seeding — ordine di esecuzione (idempotenti, UUID v5)

**Blocco A — chiusura brownfield residui morti** (rischio NULLO, nessuna decisione): migration `DROP` di staging.tmp_*/legacy_rtl_occupations/rtl_* + temp_sdbi.pf_*+schema. Neutralizza commenti .env legacy + header DEPRECATED sugli extract-script. → eseguibile subito.

**Blocco B — skill banking end-to-end** (rischio BASSO, mapping tecnico): (1) **requisiti per ruolo** dai 33 custom + ESCO banking sui 21 titoli (incl. le 10 posizioni apicali scoperte); (2) **possesso realistico per-utente** derivato dai requisiti della posizione + gap intenzionali (70-85% coverage, proficiency talvolta < required); (3) **rimuovere le 2 skill-rumore**; (4) **ricalcolo gap** con `position_id` popolato (chiude F6), deprecare l'import legacy testuale. Catena F7 intatta → fattibile. UUID v5 deterministici.

**Blocco C — coerenza carriera/retribuzioni** (rischio MEDIO, ⚠ **decisioni di prodotto**): rimappa posizione→banda dal livello reale (F2); rimodula salari con progressione per livello + popola fascia 54-100k (F3); fix contract_type per età/anzianità (F1); fix seniority_date ≤ hire (F4); ridistribuisci coorte 2006 + batch 2-dic (F5/F6); Dirigente per gli executive (F7); pay-slips per 158 utenti (13ª/14ª); cert IVASS/MiFID; completa i 2 utenti incompleti. **La modulazione salari/date cambia la "narrativa" del tenant → richiede allineamento con Enzo su quanto spingere.**

**Blocco D — org fine-tuning** (rischio BASSO, ⚠ semi-prodotto): OU Tesoreria + Internal Audit + riposiziona dealer/teller; popola o deprecare OU Marketing/Legal vuote; fix HR Manager orfano. Igiene catalogo globale (PROTO-* fuori dominio) = separato.

**Blocco E — gated Enzo**: Wave-3 (#17) → drop/archivia staging.wave1_* + moduli API + decommission DBMS legacy VM + rotazione POSTGRES_PASSWORD.

## §6 Decisioni Enzo (S1024) + stato esecuzione

- **Blocco A** ✅ ESEGUITO (mig 000193): 34 residui brownfield morti rimossi.
- **Blocco B** (skill banking end-to-end) → esegui (tecnico, Claude decide il mapping ruolo→skill).
- **Blocco C** (retribuzioni/date) → **DECISIONE ENZO: correzione COMPLETA realistica** (rimappa banda dal livello, rimodula salari con progressione per ruolo + fascia 54-100k, fix date sintetiche/apprendistati/seniority, Dirigente per executive, pay-slip per tutti, cert IVASS/MiFID, completa i 2 utenti incompleti).
- **Blocco D** (org) → **DECISIONE ENZO: POPOLA TUTTO** (aggiungi OU Tesoreria + Internal Audit con posizioni; popola Marketing + Legal&Compliance con posizioni reali).
- **Blocco E** → resta gated su Wave-3 (#17, HOLD).
