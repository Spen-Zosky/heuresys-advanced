# 224 — Il check che cambia verdetto a seconda di dove lo lanci

> **item**: #224 · **priorità**: P2 · **stima**: ~40-60k token
> **stato**: DIAGNOSI FATTA (S1077), riparazione non avviata
> **skill**: `storia36-custodia` — il triage a tre esiti vale anche qui

## Come è venuto fuori

Il timer settimanale `heuresys-advanced-storia36-custodia` era rosso su **entrambe** le
macchine, e sembrava un guasto solo. Erano due:

- **VM** — 8 tabelle `sys.*` mai classificate in una famiglia del dossier. **Chiuso** in S1077
  (commit `788f19ae`): la custodia sulla VM è VERDE, exit 0 letto sul processo.
- **linux-pc** — `C2g: eventi del ciclo performance in giorni non lavorativi: f360=7`.
  **E in produzione lo stesso identico dato dà 0.**

## Il difetto, misurato

`sys_feedback_360_responses.response_completed_at` è `timestamp with time zone`, e il check fa
`response_completed_at::date`. Quel cast **usa il fuso della sessione**:

| | fuso della sessione | esito di C2g |
|---|---|---|
| produzione (VM) | `Etc/UTC` | **0** — verde |
| gemello (linux-pc) | `Europe/Rome` | **7** — rosso |

Non è una differenza di dati, ed è stato verificato invece che supposto:

- risposte f360: **776 = 776** su entrambe
- calendario `staging.storia36_calendar`: **1110 giorni, 345 non lavorativi**, dal 2023-08-01 al
  2026-08-14 — **identico** su entrambe
- frontiera delle presenze: **2026-08-14** su entrambe (quindi non è la trappola dell'orologio)

I sette eventi sono tutti **venerdì fra le 22:30 e le 23:44 UTC**, cioè **sabato fra le 00:30 e
le 01:44 a Roma**. Non è una coincidenza: è il generatore che li ha piazzati a «fine giornata»
ragionando in UTC.

## Che cosa va fatto, e in che ordine

1. **Il fuso va fissato dentro il confronto**, così l'esito non dipende dalla macchina. Il fuso
   giusto è **`Europe/Rome`**, e non è una preferenza: `staging.storia36_calendar` è un
   calendario **italiano** — misurato, Liberazione (25/04, venerdì), Festa della Repubblica
   (02/06), Ferragosto (15/08, venerdì) e Santo Stefano (26/12, venerdì) sono tutti non
   lavorativi. Confrontare un calendario italiano con giorni UTC accosta due sistemi diversi.
2. **Fissato Roma, i sette diventano rossi anche in produzione — ed è corretto.** Una banca non
   raccoglie un feedback all'una di notte di sabato. Vanno riportati in orario lavorativo del
   venerdì, con le quattro cose del Metodo di bonifica (misura, guardia al momento,
   post-condizione su ciò che NON doveva cambiare, giornale di annullamento).
3. **ADR-0035: la correzione va nel generatore**, `db/seeds/storia36/02_performance.sql`, non
   solo nelle sette righe. Altrimenti la prossima corsa le rimette.

⚠ **L'ordine conta**: fissare il fuso *prima* di sanare i dati rende rossa anche la produzione.
Prima si sanano i sette e il generatore, poi si fissa il fuso, poi si rilancia ovunque.

## Quello che NON è stato misurato, e va misurato prima di stimare

**Quanti altri check hanno lo stesso difetto.** Ogni `timestamptz::date` dentro
`verify-storia36.sql` e `verify-storia36-dossier.sql` è un candidato, e `C2g` potrebbe essere
soltanto quello che si è visto per primo — si è visto perché *una* delle due macchine ha un fuso
diverso, non perché sia l'unico. Il conteggio va fatto prima di dare un numero all'effort.

## La prova che deve poter fallire

Non basta «adesso è verde». La prova è **lanciare la stessa custodia con due `TimeZone` diversi
nella stessa sessione e ottenere lo stesso esito**: è esattamente ciò che oggi non succede, ed è
l'unica cosa che dimostra che il difetto è chiuso. Un verde ottenuto su una sola macchina non
distingue un check riparato da un check ancora cieco.

## Chiuso quando

La custodia è verde su VM **e** linux-pc, e il suo verdetto non dipende dal fuso di chi la lancia.
