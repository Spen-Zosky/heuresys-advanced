# Censimento della documentazione — indice e chiusura (2026-08-25/26)

**Principio applicato**: censimento totale, esclusione esplicita — nessun documento saltato senza nome e ragione nel report.

## I quattro file del censimento (fonti integrali)

| file | copertura | esclusioni |
|---|---|---|
| [`_raccolta/docs_censimento.md`](_raccolta/docs_censimento.md) | **prima passata**: universo di 1237 file, tutti inventariati (Fase A) e digeriti tranne 11 directory dichiarate «non lette per volume» | 17, tutte meccaniche (build/cache/dipendenze/dump/segreti mai letti), elencate una per una — vaglio orchestratore e via di Enzo in F2: nessuna da recuperare |
| [`_raccolta/docs_censimento_pass2_a.md`](_raccolta/docs_censimento_pass2_a.md) | **seconda passata, lotto A**: 260/260 (audit/pages, .superpowers, .agents) | zero |
| [`_raccolta/docs_censimento_pass2_b.md`](_raccolta/docs_censimento_pass2_b.md) | **lotto B**: 272/272 (i due archivi Cowork congelati) | zero |
| [`_raccolta/docs_censimento_pass2_c.md`](_raccolta/docs_censimento_pass2_c.md) | **lotto C**: 324/324 (spec fondative, improvement, wargames, corso github, .codex-review) | zero; lettura a campione strutturato DICHIARATA su 4 gruppi fortemente ripetitivi (aperture+sezioni auto-riassuntive), accettata dall'orchestratore come proporzionata |

Totale: **1237 inventariati + 856 digeriti in pass-2 = copertura completa**, delta di conteggio 0 su tutte le 11 directory fra le due passate.

## Sospetti superati — dove guardare

La prima passata ne registra 10 principali (censimento §Contraddizioni), i lotti ne aggiungono 20 circa. I più utili al ciclo: le spec fondative descrivono il perimetro («the platform is not payroll/T&A/benefits») che il prodotto ha poi rispettato; 9 mini-spec SDBI mai eseguite di cui 3 sorelle furono poi costruite (e oggi sono le latenti); i wargame chiusi che si presentano ancora come lavoro da fare; l'intero corpus brownfield che descrive un flusso oggi vietato da I12 (cronaca, non errore).

## Contraddizioni doc↔doc consegnate al ciclo di sviluppo (fuori ciclo, una volta sola)

1. `AGENTS.md` porta la I12 pre-ribaltone e cita `admin@heuresys.com` rimosso (già nel registro S1080).
2. ADR-0026 usa la locuzione ritirata dalla OUTPUT RULE S1011 (idem).
3. Skill Codex `multi-tenant-validator` raccomanda RLS contro I5 — pare un template Prisma mai adattato; superficie di Codex.
4. Copia Codex di `zero-pending-loop`: 6 file su 12 in drift di 2-3 settimane; due skill Codex descrivono un ambiente inesistente (Docker, `rbp_*`).
5. `TODO_100X.md` non riconciliato con `D-04` (QW-D1/D2 DONE) — il dossier stesso rimanda a un fix doc mai fatto.
6. ADR-0030 (99,4% copertura ontologica) vs `.handoff/STATE.md` (#227: 4.464 isolate, 31,8%) — nessun documento spiega il salto.
7. `SOT_STATE.md`: contraddizione interna fra narrativa viva e sezioni statiche ferme a S1007.

## Lacune dichiarate del censimento

Date filesystem per i file non tracciati (meno affidabili delle date commit); nessuna verifica live dello stato attuale per i piani Z-261/Z-262 e per `/pricing` (#4); il confronto mtime-vs-attività (Fase C) non rifatto in pass-2 — i sospetti sono da confronto testuale, non da timestamp.
