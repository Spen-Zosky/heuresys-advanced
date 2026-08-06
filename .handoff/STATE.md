# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-06 (S1047 — verificare invece di credere: due voci di sicurezza cadono alla prova, un difetto di prodotto emerge da un residuo di test).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1047)

**Le consegne del lab chiedevano di essere verificate prima di essere eseguite, e la regola è stata
applicata a loro stesse**: undici affermazioni portanti su tredici hanno retto, due sono cadute.

**La voce di sicurezza in cima al menu era già risolta e nessuno l'aveva ri-misurata**: diceva che i
fattori di prova erano attivi perché un test restava rosso — quel test passa, e quei fattori non
esistevano da dieci giorni. Chiusa per misura, non per intervento: **riformattare una voce non è
ri-misurarla.**

**Il triage delle voci già eseguite non ha trovato stati sbagliati**, ma ha scoperto due difetti: una
sentinella che segnalava come errore ogni unità organizzativa chiusa, e quella che sembrava sporcizia
dei test ed era **un difetto di prodotto** — «annulla» non annullava niente, e chi ci ripensava si
ritrovava in elenco un fattore mai voluto. Quei residui **rompevano anche i test** senza che si
sapesse; rimossi col ripristino collaudato *prima* di cancellare.

Piano e prove: `docs/superpowers/specs/2026-08-06-ritrattazione-consegne-lab-e-mfa-produzione.md`.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, errori aperti. Doppia verifica e
review adversarial; le decisioni tecniche sono di Claude.

## Regola su ogni lavoro che nasce dal lab (`#149`, `#150`)

Prima di eseguire una voce con `lab-id`: **rileggere il file di consegna e verificarne le
affermazioni portanti** — il registro conserva il blocco, non il file, e i file sono cambiati.
Correzioni già nelle note di `#131`, `#132`, `#139` (l'ultima contiene una decisione di sicurezza
che spetta a Enzo).

## Stato dei piani

- **Consegne del lab**: ritrattate; triage chiuso, con quattro voci dichiarate **non misurate**
  invece che «a posto». · **Sicurezza MFA**: nessun fattore di prova in produzione, nessun residuo
  dopo una corsa completa della suite. · **Debiti**: resta `D-56` (decisione d'ambiente).

## ⚠ Top priorities (next session)

1. **`#125`** — pagine autenticate irraggiungibili dal menu ed etichette senza traduzione: è la
   superficie che un cliente vede per prima. ~2-3h · `<lab>/artefatti/pagine-orfane.txt`.
2. **`#131` Tenant Builder P1** — ~2 sessioni. **Vale la regola qui sopra**: tre correzioni
   sostanziali nella sua consegna.
3. **`#127` + `#123`** — stabilizzazione post-ricostruzione e `organigramma-bis.html`: insieme,
   perché la seconda assorbe la prima per dichiarazione propria. ~1 sessione.

## Open questions (autorità *cosa* = Enzo)

- **Dove vive il livello contrattuale delle posizioni?** Il triage non ha potuto verificare `#118` e
  `#120`: i codici che citano non stanno dove sembrava. **Non misurate**, non «a posto».
- **Quanti altri item sono invisibili al menu?** Il generatore legge un solo formato di blocco e
  nulla avvisa chi ne scrive un altro: serve un controllo bloccante.
- **`#142` cruscotti e `#143` squadra=progetto**: direzioni dichiarate, non pianificate — quando
  entrano, e in che ordine rispetto a `#99`?
- **Due responsabili di direzione senza posizione di comando** (`alice.costa`, `pietro.gallo`) ·
  **due cataloghi tacciono** (requisiti formativi e indicatori) · **quattro OKR nominano un reparto
  inesistente**, fra cui `Supply Chain` in una banca (tocca I21).
- **Allowlist di `TENANT_ADMIN` asimmetrica**: si può estendere, non revocare. Serve prima di `#131`.
- WAIT-INPUT: **#8** Outlook · **#16** SuccessFactors · **#52** SSO IdP · **#85** `AGENTS.md` · **#86** `claude login`.

## Verification (next session)

```bash
python docs/kb/tools/session_start.py   # menu + salute + sentinelle in un round
bash scripts/close-log.sh report        # cosa ha fatto/saltato l'ultima chiusura
bash scripts/test/run-shell-tests.sh    # atteso: 115 ok, 0 failed
git log --oneline origin/main..HEAD     # atteso: vuoto se il push di S1047 è avvenuto
```
**E2E in locale**: la config avvia solo il frontend — l'API dev va accesa a parte (`cd apps/api &&
pnpm dev`, porta **3001**) o tutti i login falliscono in blocco senza dire perché.
