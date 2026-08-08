# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-08 (S1050 — le tre domande aperte hanno una risposta, e due erano la domanda sbagliata).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1050)

**Misurare ha smentito il piano sei volte.** Delle tre domande lasciate aperte da S1049, due
cambiavano forma appena si guardava il database invece del registro. La batteria di custodia non
«si fermava al primo rosso»: raccoglieva già, e il punto cieco stava **dentro** i controlli — 39
funzioni su 65 contenevano più verifiche in fila, e **99 sotto-verifiche** non venivano nemmeno
eseguite. E lo scarto fra stipendio contrattuale e buste paga non era un disaccordo: era il
confronto fra dodici mesi di storia e lo stipendio di oggi.

**Il guasto vero era altrove, e riguardava dieci persone.** Una promozione decisa il 4 agosto
aveva alzato il contratto senza propagare nulla alla scheda che quelle persone vedono nel
**proprio** portale. Riparato alla fonte; provato dal vivo su produzione con il loro accesso.
Le buste **non** sono state toccate, ed è una scelta misurata: l'aumento decorre da agosto e la
busta di agosto non esiste ancora.

**La prova generale ha fermato nove difetti prima del push** — nove CI rosse evitate. Fra questi
un mio selftest che *non poteva accendersi* perché combatteva contro un trigger, e una rete di
sicurezza che ne salvava un terzo avendo l'aspetto di una completa.

**Chiuso `#164` F4**: lo schema `brownfield` non esiste più; la sincronizzazione ISTAT/ATECO/ESCO
ha casa propria in `reference_sync`, con tutte le 1.194 corse e la provenienza intatta.

**`#131` Tenant Builder a 4 task su 8**, tutti in produzione. Fermato prima del Task 5 di
proposito: è un modulo API e la regola di progetto vieta di spezzarlo su più commit.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, errori aperti. Doppia verifica e
review adversarial; le decisioni tecniche sono di Claude.

## Regola su ogni lavoro che tocca il database (S1049, confermata da S1050)

**Prima di applicare**: `ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'`.
In S1050 ha intercettato **nove** difetti. **Lanciala dopo OGNI migrazione, non a fine lavoro**:
quasi tutti i difetti nascevano alla *seconda* passata, cioè al deploy successivo.
**Per ritirare qualcosa**: si emenda il file che lo crea (ADR-0035), mai una `DELETE` a valle.

## Top priorities (prossima sessione)

1. **`#131` Task 5 — il modulo `tenant-blueprints`** (INTERRUPTED, ~1 sessione). T1-T4 sono in
   produzione. Il piano ha il codice: `<lab>/2026-08-05--piano-implementazione-p1-fascicolo.md`
   riga 886. **Un solo commit**, poi T6 frontend, T7 il fascicolo vero di RTL, T8 scostamento.
2. **`#168` cancellare una persona cancella la storia delle sue approvazioni** (~2-3h). Le tre
   righe perse sono state ri-derivate, **la causa no**: serve il censimento dei vincoli `CASCADE`
   verso `sys_users` e una decisione per famiglia.
3. **`#170` gli script dell'ingestione ritirata nominano uno schema che non esiste** (~1-2h) —
   fallirebbero se qualcuno li lanciasse. Ritirarli o ripuntarli: serve la tua parola sul ritiro.

## Open questions

- **`#169`**: password e secondo fattore nascono dalla stessa chiave madre, quindi per chi ha
  quella chiave l'MFA non è un secondo fattore. Non urgente finché la chiave sta solo qui;
  lo diventa quando arriverà su VM e linux-pc (`#147`).
- **`#170`**: gli attrezzi dell'ETL legacy si ritirano o si conservano ripuntati? Cancellare file
  richiede la tua conferma.

## Verification

```bash
python docs/kb/tools/session_start.py                                   # menu + salute, un giro
ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh' # prova generale, ~13s
bash db/scripts/storia36.sh custodia                                    # custodia RTL (verde, 256 selftest)
```
