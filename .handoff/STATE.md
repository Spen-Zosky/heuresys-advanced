# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-06 (S1046 — la chiusura smette di agire nel dubbio e comincia a tenere un diario; due voci di sicurezza tornano visibili nel menu).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1046)

**Quando la chiusura non riusciva più a sapere cosa fosse cambiato, i due script della catena
rispondevano in modo opposto senza dirlo**: uno mandava in produzione anche senza una riga di codice
da mandare, l'altro saltava la copia del database dichiarando «nessun cambiamento in questa
sessione» — una frase che in quel ramo non poteva sapere se fosse vera. Ora vale una regola sola:
le cose che costano poco si rifanno, quelle care no e si scrive «non lo so». Provato mettendo a
confronto la versione di prima e quella di dopo sugli stessi identici dati.

**La chiusura tiene un diario**, scritto dagli script stessi: cosa ha fatto, cosa ha saltato e
perché. È rendiconto, non stato — nessuna decisione lo legge, e se sparisce la chiusura resta
corretta.

**Rinviata di proposito la riscrittura della chiusura in quattro verbi**: l'analisi che la
giustificava contava come «ripetizioni» sia i ritocchi a un minuto di distanza sia le sessioni
riprese il giorno dopo. Si decide sul rendiconto, non sul `git log` (`#148`).

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial; le decisioni tecniche sono di Claude.

## Stato dei piani

- **Chiusura di sessione**: guasti provati corretti e custoditi da test; ristrutturazione rinviata
  con criterio dichiarato. Piano e prove in
  `docs/superpowers/specs/2026-08-06-chiusura-dottrina-dubbio-e-diario.md`.
- **Debiti**: resta `D-56`, che aspetta solo una decisione d'ambiente.
- **Consegne del lab**: restano `#117` `#121` `#123` `#125` `#126` `#127` `#128`; `#124` a metà;
  `#144` aperta.

## ⚠ Top priorities (next session)

1. **#146 — i fattori MFA `e2e-fixture` sono ancora attivi in produzione** e il repo è pubblico.
   Era invisibile al menu da quando è stato scritto: il blocco usava un formato che il generatore
   non legge. Recuperato ora, va affrontato per primo. ~2h.
2. **#125 — pagine autenticate irraggiungibili dal menu ed etichette senza traduzione**.
   È la superficie che un cliente vede per prima. ~2-3h · elenchi in
   `<lab>/artefatti/pagine-orfane.txt`.
3. **#127 + #123** — stabilizzazione post-ricostruzione e lettura di `organigramma-bis.html`:
   vanno insieme perché la seconda assorbe la prima per dichiarazione propria. ~1 sessione.

## Open questions (autorità *cosa* = Enzo)

- **Quanti altri item del registro sono invisibili al menu?** Due sono emersi per caso durante
  questa chiusura. Il generatore legge un solo formato di blocco, e nulla avvisa chi ne scrive un
  altro: serve un controllo bloccante, come quello aggiunto in S1045 per la sezione sbagliata.
- **Le epiche `#142` cruscotti focalizzati e `#143` squadra=progetto** sono direzioni dichiarate,
  non pianificate: quando entrano, e in che ordine rispetto a `#99` (domini)?
- **Due responsabili di direzione senza posizione di comando** (`alice.costa`, `pietro.gallo`):
  reggono un'unità da una posizione tecnica — crearle è lavoro di struttura.
- **Due cataloghi tacciono** (requisiti formativi e indicatori): riempirli è contenuto di prodotto.
- **Quattro OKR nominano un reparto inesistente**, fra cui `Supply Chain` in una banca (tocca I21).
- **Lacuna di simmetria nell'allowlist di `TENANT_ADMIN`**: esiste un marcatore per *estendere*
  l'elenco, nessuno per *revocare*. Serve prima che `#131` tocchi i permessi.
- WAIT-INPUT: **#8** Outlook · **#16** SuccessFactors · **#52** SSO IdP · **#85** `AGENTS.md` · **#86** `claude login`.

## Verification (next session)

```bash
python docs/kb/tools/session_start.py              # menu + salute + sentinelle in un round
bash scripts/close-log.sh report                   # cosa ha fatto/saltato l'ultima chiusura
bash scripts/test/run-shell-tests.sh               # atteso: 115 ok, 0 failed
git log --oneline origin/main..HEAD                # atteso: vuoto (tutto pushato in S1046)
```
