# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-08 (S1049 — la chiusura non aspetta più la CI, e ritirare non è cancellare).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1049)

**La chiusura di sessione non aspetta più la CI.** Prima restava aperta 20-30 minuti a
guardare un controllo automatico; ora *arma* il deploy e una sentinella sulle due macchine
lo esegue da sola quando la CI diventa verde. Il cancello di sicurezza è lo stesso, spostato
fuori dalla sessione. **Provato dal vivo tre volte**: le macchine si sono aggiornate senza
che nessuno lanciasse un comando.

**Una prova generale che costa mezzo minuto invece di mezz'ora.** Copia il database vero
della CI e riapplica tutta la catena, **due volte**. Ha già intercettato difetti che
sarebbero stati CI rossa mezz'ora dopo — e uno che aveva già rotto la produzione.

**La lezione più importante ha un nome: ritirare non è cancellare** (ADR-0035). La catena si
ri-applica per intero a ogni deploy, quindi ciò che cancelli a valle torna al giro dopo.
Scoperto sbagliando tre volte nello stesso pomeriggio. Va emendato il file che crea
l'oggetto — e il costo di un ritiro si misura **in file da emendare**, non in righe.

**La custodia della storia RTL è verde per la prima volta.** Cinque controlli rossi, e
quattro avevano **una sola radice**: una promozione aveva cambiato il livello contrattuale
senza propagare nulla a paga, premio ed evidenza in busta.

**Il metodo è ora scritto, non solo praticato**: `CLAUDE.md` §*Metodo di bonifica* + ADR-0034
e ADR-0035. Sei regole, ognuna nata da un errore reale di questa sessione.

Referti: ADR-0034, ADR-0035, `db/scripts/README.md` §ci-rehearsal.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, errori aperti. Doppia verifica e
review adversarial; le decisioni tecniche sono di Claude.

## Regola su ogni lavoro che tocca il database (S1049 — nuova)

**Prima di applicare**: `ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'`.
**Per ritirare qualcosa**: si emenda il file che lo crea (ADR-0035), mai una `DELETE` a valle
da sola. **Ogni scrittura di massa** porta misura, guardia, post-condizione che protegge ciò
che NON doveva cambiare, e rollback dichiarato.

## Regola su ogni lavoro che nasce dal lab (`#149`, `#150`)

Prima di eseguire una voce con `lab-id`: **rileggere il file di consegna e verificarne le
affermazioni portanti**. In S1049 ha fermato **due** lavori che avrebbero fatto danno.

## Top priorities (prossima sessione)

1. **`#164` F4 — ritiro dello schema `brownfield`** (~1 sessione). La migrazione è **scritta e
   provata** ma parcheggiata fuori catena: `docs/superpowers/plans/2026-08-08-164-F4-migrazione-pronta-non-applicata.sql`.
   Dentro c'è la ricetta già misurata, inclusi i file da NON marcare perché portano guardie
   vive. **Non ri-misurare: leggere il file e partire.**
2. **`#124` mascheratura dei dati sensibili** (INTERRUPTED, ~1-2 sessioni) — resta lo strato 1:
   spaccare l'anagrafica in professionale e privata, che chiude 6 celle su 8.
3. **`#150` parte B applicata**: la serie organigramma (11 voci) merita un riesame, e la
   verifica non è rileggere — è **eseguire la batteria di custodia** e triagare ciò che accende.

## Open questions

- **`POS-e1000001 «Tenant Owner»`** resta inattiva e **senza titolari**: è lo stesso residuo
  dell'account rimosso, ma è un oggetto dell'organigramma. Si rimuove?
- **La batteria di custodia va fatta raccogliere invece di abortire?** Sei volte in due
  sessioni un rosso ne ha nascosto un altro. Parte dei check già raccoglie; `C4h`/`C6c` no.
- **RAL e buste non coincidono per 152 persone su 158** (scarto sistematico ~1,5%): è una
  differenza di derivazione, non un errore di pagamento — ma sono due verità sullo stesso fatto.

## Verification

```bash
python docs/kb/tools/session_start.py                                   # menu + salute, un giro
ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh' # prova generale, ~26s
bash db/scripts/storia36.sh custodia                                    # custodia RTL (verde da S1049)
```
