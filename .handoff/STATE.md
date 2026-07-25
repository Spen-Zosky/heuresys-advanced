# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-25 (S1030 — W1 avanzata, coda Dependabot azzerata, CI tutta verde).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1030)

Chiusa la corsia W1 di questo giro e l'intera coda Dependabot (nessuna PR resta aperta).
Poi tre revisori istruiti a demolire hanno smontato metà delle prove della sessione stessa,
e le correzioni che ne sono seguite valgono più dei cluster: lo script del clone usciva con
successo anche a database mezzo vuoto, il suo controllo di coerenza stampava «OK» proprio
quando fallivano entrambi i lati del confronto, e gli orari dei timer erano sfasati di due
ore perché la VM lavora in UTC e il PC Linux in ora locale — il pull dei backup partiva
prima che il dump esistesse.

Il caso che riassume la sessione: un fix di ieri, dato per chiuso, aveva **spento i colori
d'errore sul sito pubblico**. La premessa («quel token colore non esiste») era falsa, e lo
si poteva vedere solo guardando il CSS realmente emesso, non il sorgente. Da qui la regola:
**una prova vale solo se avrebbe potuto fallire** — e si misura l'artefatto prodotto, non
la dichiarazione.

In coda alla sessione è arrivata una consegna da una sessione Cowork: l'impianto che
esegue il piano in autonomia. Rivisto prima del commit da due revisori ostili — il lock
non era un lock (fermare il driver era proprio ciò che creava due driver), e la chiusura
di ogni ciclo deployava la produzione fuori da ogni filtro. Corretti quelli, ne restano
altri che chiedono un ridisegno: committato **con il freno inserito**, non parte.

## Obiettivo permanente (mandato Enzo, S1029 — vale per OGNI sessione futura)

**Portare heuresys-advanced a una fresh session senza pendenze**: zero debiti, zero task
incompleti, zero pending, zero errori aperti. Il censimento è fatto; ora è esecuzione.
Ogni sessione: avvio → identificazione azioni sul piano → esecuzione con **doppia verifica
e review adversarial per ogni task** → quando conviene ripartire puliti, chiusura completa
(SoT + commit + push + deploy + allineamento macchine e DB) e fresh session. Tutte le
decisioni tecniche sono di Claude; a Enzo vanno solo le voci che dipendono da un suo input.
**Il tracciamento del piano è responsabilità di Claude**, non di Enzo.

## Stato del piano

`docs/superpowers/specs/2026-07-25-zero-pending-plan.md` — **254 cluster, 42 chiusi**.
Le caselle spuntate portano la nota di chiusura con l'evidenza; il resto è aperto.

- **W0 sblocco — NON completa**: resta `Z-034` (segreti TOTP — fixture in chiaro nel repo,
  7 secret plaintext su 19 a DB, `MFA_ENCRYPTION_KEY` da garantire su VM e linux-pc).
  Tocca segreti in produzione: **serve la tua autorizzazione**, non parte da solo.
- **W1 igiene** — in corso, oltre un terzo chiuso.
- **W2-W5** non iniziate. **W6** dipende da input di Enzo.

## ⚠ Top priorities (next session)

1. **Proseguire W1**, la corsia col miglior rapporto chiusure/ora. Prossimi già istruiti:
   `Z-213`/`Z-214` (riconciliazione dei tracker 100X), `Z-219` (atlas stale), `Z-221`/
   `Z-223` (roadmap e wave ferme in DRAFT), `Z-230` (doc di triage Dependabot — ora
   scrivibile sul triage reale appena eseguito), `Z-239` (indice memorie), `Z-031`
   (monitor di non-regressione dell'ecosistema).
2. **`Z-250` — togliere il freno all'impianto zero-pendenze**, che ora è versionato ma
   **fermo per scelta**: due revisioni ostili hanno chiuso i difetti pericolosi, ma restano
   6 punti di ridisegno (classificazione che guarda la descrizione invece del criterio di
   chiusura, precondizioni di classe C che nessun codice legge, prove autodichiarate, gate
   che contraddice la Definition of Done, self-test cieco a 4 regressioni su 5). Elenco
   puntuale nel cluster e in `zp.config.yaml`.
3. **Gli altri 5 cluster nati oggi**: `Z-249` due rossi semantici che convivono · `Z-251`
   la suite che non regge la contesa sul DB · `Z-252` PaletteDropdown inerte · `Z-253`
   `heuresys_ci` mai rinfrescato (è il DB su cui girano davvero i gate CI) · `Z-254`
   disciplina di rilascio upstream.
4. **W2 debito/test**: il pezzo più utile resta il gate E2E in CI — oggi la copertura
   Playwright monitorata cross-sessione è una frazione minima delle spec esistenti.

## Open questions (autorità *cosa* = Enzo)

- **Contraddizione GDPR**: il design SuccessFactors afferma «nessuna governance PII/GDPR
  richiesta», la due diligence elenca RoPA/DPIA/DPA fra i requisiti mancanti. Posizione
  sul profilo legale, non scelta tecnica.
- **Autonomia non presidiata**: l'impianto ora esiste ed è pubblicato, ma il freno è
  inserito (`meta.autorizzato_non_presidiato: false`) e il design resta «BOZZA — in attesa
  di approvazione». Il freno non si toglie senza il tuo via, nemmeno a rilievi chiusi.
- **Wave-3 (#17)** — sblocca il Blocco E Fase 3 (#69). In HOLD.
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16**
  SuccessFactors · **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
python docs/kb/tools/check_module_test_coverage.py --self-test   # 8/8 passati
gh run list --branch main --limit 7               # 7/7 success sull'ultimo commit
gh pr list --state open                           # vuota
grep -c '^- \[x\]' docs/superpowers/specs/2026-07-25-zero-pending-plan.md   # 42
ssh linux-pc "systemctl list-timers heuresys-advanced-clonedb.timer"        # NEXT domenica
python docs/kb/tools/session_start.py             # menu + salute
```
