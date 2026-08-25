# Ciclo DREAM 2026-08-25 — stato alla chiusura S1080 (interruzione da guardiano)

**Chiusura**: 2026-08-25 ~17:50, per soglia finestra 5h = 80,0% ≥ 80% (regola del guardiano, verdetto incollato nel report di sessione). Il contesto era al 24,2% misurato (242k/1M) — non è lui la causa.

## Contratto del ciclo (immutato, non ri-derivare)

- **Traguardi (Enzo)**: T1 = entro 6 mesi prodotto vendibile a PMI italiane strutturate come complemento talent al gestionale HR esistente · T2 = piattaforma dimostrabile dal vivo a prospect/investitori entro pochi mesi. Doppia classificazione MoSCoW indipendente + confronto; due pesi per riga di matrice; argine MUST ≤ 1/5 per ciascun traguardo.
- **Competitor e ruoli**: Personio (concorrente diretto), Eightfold AI (metro di riferimento — mai MUST), Zucchetti (piattaforma coesistente — superfici di integrazione, non lacune).
- **Perimetro di scrittura**: SOLO `docs/vision/**`. Mai `docs/kb/`. Read-only su codice.
- **Fermate obbligatorie**: F1 piano (fatta) · F2 esclusioni censimento (presentata, **in attesa del via di Enzo**) · F3 tabella MoSCoW ×2 (non raggiunta).

## Tabella del piano — stato letto da qui alla ripresa

| id | cosa | stato |
|---|---|---|
| V0 | Contratto Fase 0 | FATTO |
| F1 | Fermata 1 — piano approvato | FATTO (2026-08-25) |
| V1 | `_raccolta/inventario_raw.md` (268 voci, 604 route, 102 pagine) | FATTO |
| V2 | `_raccolta/latenti_raw.md` (19 voci, 6 categorie) | FATTO |
| V3 | `_raccolta/architettura_raw.md` (49 voci + 5 lacune) | FATTO |
| V4 | `_raccolta/competitor_personio.md` (95 voci; vendor dietro anti-bot: contenuto via snippet indicizzati, flag dichiarato) | FATTO |
| V5 | `_raccolta/competitor_eightfold.md` (52 voci; class action su provenienza dataset segnalata) | FATTO |
| V6 | `_raccolta/competitor_zucchetti.md` (24 voci; apiportal.zucchetti.it NON risolve, portale reale dietro SSO) | FATTO |
| V7 | `_raccolta/docs_censimento.md` (1237 file, 17 esclusioni, 11 dir non lette) | FATTO |
| F2 | Fermata 2 — esclusioni mostrate integrali a Enzo | **PRESENTATA — WAIT-INPUT (via libera mai arrivato: sessione chiusa prima)** |
| V7b | Pass 2 censimento su 11 dir (~856 file): 3 agenti lanciati | **INTERROTTA — agenti fermati alla chiusura; NESSUN file `docs_censimento_pass2_{a,b,c}.md` garantito completo: alla ripresa verificare esistenza/completezza e RILANCIARE i lotti mancanti** |
| V8 | Matrice di copertura (bozza `04_MATRICE.md`, due pesi per riga) | non iniziata |
| V9 | Proposte + evidenze (bozze `05`, `06`) | non iniziata |
| V10 | dream-verifier (opus) | non iniziata |
| V11 | Doppia classificazione + confronto | non iniziata |
| F3 | Fermata 3 — tabella MoSCoW ×2 | non raggiunta |
| V12 | File finali `00`–`07` + `manifest.json` + `INDEX.md` | non iniziata |
| V13 | Commit finale | non iniziata (i commit di progresso esistono) |

## Ripresa — primi tre passi

1. Rileggere questo file e il piano; verificare quali `docs_censimento_pass2_*.md` esistono in `_raccolta/` e se dichiarano copertura completa; rilanciare i lotti mancanti (A: audit/pages+.superpowers+.agents · B: cowork_code_exchange+cowork_reserved · C: docs/superpowers+source_bundle+improvement+github+wargames+.codex-review).
2. Ottenere il via di Enzo sulla **F2** (le esclusioni integrali sono nel report di chiusura S1080 e in `_raccolta/docs_censimento.md` §Esclusioni; vaglio orchestratore: nessuna da recuperare).
3. Onda 2: matrice da `_raccolta/*` (righe = capacità lato utente; celle progetto Completo/Parziale/Latente/Assente con prova; competitor Documentato/Riportato/Non trovata evidenza; due pesi per riga).

## Reperti da non perdere (registro «fuori ciclo», si presenta una volta sola)

- Tre contraddizioni doc↔doc già individuate (dettaglio in `_raccolta/docs_censimento.md` §Contraddizioni): AGENTS.md con I12 pre-ribaltone; AGENTS.md cita `admin@heuresys.com` rimosso (mig. 000295); ADR-0026 usa la locuzione ritirata dalla OUTPUT RULE S1011.
- Tre difetti del guardiano trovati e corretti in giornata dalla sessione canonical su segnalazione di questa (231 titolo-fasi; denominatore da tabella non cieco; context-window.json sovrascritto da qualunque sessione). Residuo cosmetico: la sezione contesto stampa ancora una percentuale >100 col giudizio per-ramo «CHIUDI» invece di dichiararsi cieca — segnalato.
