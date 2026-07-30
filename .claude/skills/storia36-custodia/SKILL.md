---
name: storia36-custodia
description: Use when the RTL 36-month story on heuresys-advanced needs tending — "custodia storia36", "verifica la storia", "la storia regge ancora?", "avanza la storia", "la demo è rotta/vecchia", a red storia36 check at session start, the weekly storia36-custodia timer failing on VM or linux-pc, or a job that wrote rows and may have broken the dataset. NOT for building the story (one-off, closed) nor for generic DB debugging.
---

# Custodia della storia RTL 36 mesi

## Cos'è

Il database di RTL Bank contiene 36 mesi di vita aziendale continua (presenze,
retribuzioni, formazione, carriera, riorganizzazione, approvazioni, clima).
Non è un dump congelato: **è un dataset vivo che invecchia e si rompe**. La
custodia è il presidio che dice se regge ancora; l'avanzamento è ciò che lo
porta a ieri.

Un solo punto d'ingresso — `db/scripts/storia36.sh` — con tre modi. Le sue
opzioni sono nell'intestazione dello script: leggila, non indovinarla.

| Serve | Comando |
|---|---|
| «regge ancora?» | `bash db/scripts/storia36.sh custodia` |
| «la demo è vecchia» | `bash db/scripts/storia36.sh avanzamento` |
| «manca un pezzo di dato» | `bash db/scripts/storia36.sh custodia --repair-missing` |

La **costruzione** (modo `costruzione`) è una tantum ed è chiusa: non è
perimetro di questa skill. Vive nel piano archiviato.

Il report esce in `qa_artifacts/storia36/custodia-<data>.md`. Exit ≠ 0 = ci sono
rossi da triagare.

## Il triage: tre esiti, sempre dichiarati

**Ogni check rosso va classificato prima di toccare qualsiasi cosa.** Non
esiste un quarto esito.

**(a) Dato mancante** → il seed pertinente lo ricrea: `--repair-missing`. I seed
sono idempotenti, ricreano SOLO ciò che manca.

**(b) Il check è troppo rigido**, smentito da un'evoluzione legittima → si
corregge **il check**, e la nota va nel report. Caso tipico: un check che
fotografa un conteggio o una data fissa, mentre la storia è cresciuta per
costruzione.

**(c) Rottura vera** → item di riparazione nel register
(`docs/kb/SOT_BACKLOG.md`), con la misura del prima.

## Le quattro trappole (viste sul campo, non ipotetiche)

**1. Allargare il check invece di sistemare il fatto.** È la scorciatoia più
tentante e va nella direzione sbagliata: il check rosso di solito ha ragione.
Prima domanda sempre: *«il fatto è coerente?»*. Solo se il fatto è giusto e il
check è una fotografia si tocca il check. Esempi reali: ridatare le lauree in
sessione ha reso 71 esperienze antecedenti alla laurea (C5a) → si è scelta la
sessione compatibile con la biografia, non si è ammorbidito C5a.

**2. Riparare automaticamente righe modificate.** Vietato. `staging.storia36_runs`
e le chiavi `STORIA36::` dicono cosa era seminato e cosa è organico: una riga
che qualcuno ha toccato non si riscrive senza decisione esplicita.

**3. Scambiare l'orologio per una rottura.** Alcuni check si valutano alla
frontiera della storia (la punta delle presenze), non alla data di oggi.
Spostando la frontiera in avanti, un'abilitazione scaduta o una scadenza
superata diventano rosse **perché il tempo è passato**, non perché qualcuno ha
sbagliato: è esito (a), il fatto mancante va creato con la regola del cluster
che lo possiede.

**4. Una riparazione ne accende un'altra.** Normale e sano: si assorbe a
catena, mai spegnendo il check nuovo. Rieseguire la custodia fino al verde
è parte del lavoro, non un extra.

## Regole non negoziabili

- **Twice-run 0**: dopo qualunque riparazione, il seed va eseguito due volte e
  la seconda deve scrivere **0 righe**. Se non è 0, non è idempotente: si
  aggiusta il seed.
- **Niente futuro**: la storia si ferma a ieri. L'avanzamento rifiuta una
  finestra che arriva a oggi (una giornata in corso non ha ancora un'uscita).
- **Ogni check nuovo nasce con il suo selftest**: si inietta la violazione, il
  check DEVE scattare, si fa rollback. Un check che non si è mai visto
  fallire non è una prova.
- **Cancello di esposizione**: se la riparazione popola una tabella nuova,
  `python docs/kb/tools/check_exposure.py` deve restare verde — un dato che
  nessuna API espone non è nel prodotto.
- **Mai asserzioni-fotografia**: i check sono proprietà con la finestra a
  parametro, mai conteggi esatti attesi.

## Se sei arrivato qui dal timer settimanale

Unità `heuresys-advanced-storia36-custodia` (lunedì 04:30 su VM e linux-pc),
con `OnFailure` nel registro allarmi che il dashboard di sessione legge.
Un fallimento porta con sé il report: aprilo, triagalo, non rilanciare e basta.

## Dove guardare

| Cosa | Dove |
|---|---|
| Stato del programma, diario per cluster | `.storia36/PROGRESS.md` |
| Batterie e selftest | `db/scripts/verify-storia36.sql`, `...-dossier.sql` |
| Cosa deve avere ogni entità | `docs/kb/storia36/DOSSIER_REGISTRY.md` |
| Verbale dell'audit finale | `docs/kb/storia36/AUDIT_FINALE.md` |
| Regole di dominio (CCNL, premi, formazione) | `docs/kb/storia36/DOMINIO*.md` |

## Bandiere rosse — fermati

- «Ammorbidisco il check così passa»
- «Cancello le righe che danno fastidio»
- «Il selftest è di troppo, il check si vede che funziona»
- «Riparo a mano queste righe, tanto sono poche»
- «Il rosso c'era anche prima, lo lascio»

Tutte significano: torna al triage e dichiara l'esito.
