# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-05 (S1045 — i perimetri tornano verdi, il cancello smette di rimandare all'inizio, il menu smette di offrire pagine negate).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1045)

**Lo stesso difetto di forma di S1044, in cinque posti nuovi: decidere da un'etichetta scritta a
mano invece che dalla proprietà che conta.** Il menu offriva il Cruscotto a chi non può aprirlo
(unica voce su 38 a non dichiarare il proprio permesso); un test pretendeva le righe di giugno
dopo la chiusura di due reparti; un altro trattava da «impiegato» chi dirige una filiale; una
guardia diceva «qui si sposta, non si crea» verificandolo contro un numero fisso.

**Il cancello teneva un'impronta sola per tutte le suite**: ogni correzione nata dal verdetto lo
invalidava, e il ciclo non convergeva. Ora la freschezza è per suite — l'ultima verifica è costata
2,4 minuti invece di 45, e `git commit` non scade più niente.

**Tre prove che potevano fallire**: chiudere due reparti poteva lasciare processi senza
responsabile (nessuno); il deploy ha **revocato permessi in produzione** e solo un test l'ha
rivelato (→ `#140`); una pulizia di 232 righe poteva mordere il vivo, e la guardia lo esclude.

**Due decisioni di Enzo applicate**: la voce Utenti resta a chi guida una squadra; il cruscotto va
ai capi filiale e **non** ai capi squadra — che ha richiesto un ruolo nuovo, perché i due gruppi
hanno gli stessi tre ruoli e solo il fatto li distingue.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial; le decisioni tecniche sono di Claude.

## Stato dei piani

- **#115 perimetri nei test**: **CHIUSO**. Piano riga-per-riga con i reperti fuori-inventario in
  `docs/superpowers/specs/2026-08-05-perimetri-test-esecuzione.md`.
- **13 consegne del lab**: chiuse `#116` `#118` `#119` `#120` `#122`; a metà `#124`; da fare
  `#117` `#121` `#123` `#125` `#126` `#127` `#128`.
- **11 consegne lab nuove** ingerite come `#129`→`#139`.
- **#92 ciclo di valutazione**: passi **2 su 7** chiusi.

## ⚠ Top priorities (next session)

1. **#140 — la catena di migrazioni disfa correzioni già chiuse**. Tre prove misurate, tutte dopo
   un deploy. È P1 perché il deploy è l'unica via verso la produzione e oggi si porta dietro
   effetti sul dato che nessuno ha chiesto. Indagare insieme a **#141**. ~1 sessione.
2. **#124 residuo** — lo strato 1 (separare identità professionale e privata) chiude 6 celle su 8
   senza meccanismi nuovi. Il punto (4), il frontend, è **parzialmente fatto**: la pagina
   retributiva ora rende «nascosto per il tuo profilo». ~1 sessione.
3. **#127 + #123** — stabilizzazione post-ricostruzione e lettura di `organigramma-bis.html`:
   vanno insieme perché la seconda assorbe la prima per dichiarazione propria. ~1 sessione.

## Open questions (autorità *cosa* = Enzo)

- **Le epiche `#142` cruscotti focalizzati e `#143` squadra=progetto** sono direzioni dichiarate,
  non pianificate: quando entrano, e in che ordine rispetto a `#99` (domini)?
- **Due responsabili di direzione senza posizione di comando** (`alice.costa`, `pietro.gallo`):
  reggono un'unità occupando una posizione tecnica. Creare le due posizioni è lavoro di struttura.
- **Due cataloghi tacciono**: 8 posizioni apicali senza requisiti formativi, 119 su 161 senza
  indicatori. Riempirli significa decidere contenuto di prodotto.
- **Quattro OKR nominano un reparto inesistente**, fra cui `Supply Chain` in una banca (tocca I21).
- **Dependabot rosso su 3 aggiornamenti di sicurezza** (4 vulnerabilità, 1 alta) — dentro `#66`.
- WAIT-INPUT: **#8** Outlook · **#16** SuccessFactors · **#52** SSO IdP · **#85** `AGENTS.md` ·
  **#86** `claude login` su VM e linux-pc.

## Verification (next session)

```bash
python docs/kb/tools/session_start.py              # menu + salute + sentinelle in un round
python docs/kb/tools/verify_gate.py check          # atteso: verde (freschezza PER SUITE da S1045)
python docs/kb/tools/db_health.py                  # atteso: "tutto nei limiti"
git log --oneline origin/main..HEAD                # atteso: vuoto (tutto pushato in S1045)
```
