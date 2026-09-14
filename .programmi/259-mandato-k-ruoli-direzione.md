# 259 — Mandato K: ruoli senza titolare e direzione del dato (I23)

> **item**: #259 · **priorità**: P1 · **stima**: 26-28 sessioni (sezione 12 del mandato)
> **stato**: IN CORSO
> **nasce-da**: le decisioni di Enzo del 2026-09-14 (nove, otto chiuse, D5 rinviata) sul dossier PARTE_K/K2/K3 di Cowork; testo operativo `.programmi/mandati/K-mandato-v2.md`.

## Questo file è un PUNTATORE, non lo stato

Lo stato del mandato K vive in **`.programmi/K-ruoli-direzione/STATO.md`** (una riga per voce, 43 voci, con il proprio meccanismo di ripresa: `tools/dove_siamo.py`, sezione 3 del mandato). Questo file esiste perché il register vuole un piano di primo livello per ogni voce ACTIVE; le fasi qui sotto sono le sei del mandato e si spuntano SOLO quando il cancello d'uscita della fase è superato in `STATO.md`.

## Decisioni già prese (non si ri-chiedono) — sezione 2 del mandato

D1=B (sinonimi governati da chi governa le competenze, nasce `skill_alias:manage`) · D2=A (`HRMS_MANAGER` resta plenipotenziario, I22 invariato) · D3=A (`gdpr:erase` tolto a `HRMS_MANAGER`: unica eccezione, guardia G-D2) · D4=B (l'incarico passa dalle approvazioni) · **D5 RINVIATA** (si riapre alla chiusura di I-D col numero dei conflitti; la CLI non decide) · D6=A (quattro tabelle «importate, porta non ancora costruita») · D7=A (I23, stati nativo/importato/ibrido) · D8=A (`HIRING_MANAGER` con perimetro organigramma) · D9=B (ruoli di piattaforma vedono solo i clienti assegnati → voce R-0).

## Fasi

- [x] **F0a — Fondazione: stato, strumenti, sola lettura, migrazioni, workflow, censimento, baseline** — 2026-09-14 S1102 — evidenza: `.programmi/K-ruoli-direzione/STATO.md` (F0.1, F0.5, F0.6, F0.7, F0.2, F0.3 = CHIUSA), `esiti/F0.2_censimento_C1.md`, `evidenze/baseline_202609142318.txt`, `evidenze/F0.5_controprova.txt`.
- [ ] **F0b — Fondazione: la prova di ripresa (F0.4, K-PROVA)** — INTERROTTO al passo 10 di proposito (sezione 3.5: la prova chiude e riapre la sessione) — 2026-09-14: `000415` applicata e riconosciuta a caldo; la sessione 2 legge il caso (ii) a freddo, scrive `000416` e `000417`. **fatto =** cancello d'uscita di F0 superato, K-PROVA RITIRATA.
- [ ] **F1 — Indagini** — W1 + W2 + tre code in linea; **fatto =** sei file in `esiti/` con verdetti, D5 in `ATTESA_ENZO` col numero dei conflitti (fermata obbligatoria: rapporto a Enzo).
- [ ] **F2 — Sentinelle e cancelli** — S-1..S-5; **fatto =** cinque evidenze rosse e cinque verdi. Fermata obbligatoria dopo F2 (Enzo legge le indagini prima che F4 cambi permessi a persone vive).
- [ ] **F3 — I due ADR** — X-0, K1-ADR con confutazione W3; **fatto =** ratificati da Enzo in `esiti/RISPOSTE_ENZO.md`.
- [ ] **F4 — I ruoli, uno per migrazione** — R-1, R-0, R-9, R-2, R-3, R-7, R-10, R-4, R-5, R-8, R-6, R-11; **fatto =** cancello per ruolo (migrazione, persona di collaudo, deriva verde, prove negative, W4, G-D2 vuota).
- [ ] **F5 — Direzione del dato** — X-1..X-6; **fatto =** tre sentinelle nuove vigilate da `db_health.py`.
- [ ] **F6 — Il gesto** — G-1; **fatto =** spostamento di persona via proposta approvata, storia conservata.

## Cronaca

- 2026-09-14 S1102 — F0 a 6/7: stato e strumenti, q.py con controprova rossa, come si applica una migrazione, sei script dei workflow, censimento C1 via W0 (12 agenti, 6/6 spie), baseline misurato, 000415 applicata e riconosciuta; F0.4 lasciata SOSPESA apposta. Rapporto: `.programmi/K-ruoli-direzione/esiti/RAPPORTO_2026-09-14.md`.
