# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-28 (S1034 — la storia RTL arriva alla carriera, e nasce il cancello di esposizione).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1034)

Ripreso il **C4 congelato al passo 4.3** e chiuso, poi eseguito il **C5**. Entrambi i cluster sono
passati sotto review adversarial a tre lenti e **entrambi sono stati bocciati**: il C4 con quattro
rilievi bloccanti (gli orari scritti in un fuso sbagliato facevano chiudere le lezioni dopo
l'uscita timbrata; l'obbligo di antiriciclaggio non era presidiato da nulla; la batteria sarebbe
diventata rossa da sola al cambio di mese), il C5 con otto (il criterio di «più in alto» era
degenerato in «scrivania vuota»: 150 obiettivi su 150 puntavano a una posizione senza titolari, e
il vertice aveva approvato di diventare cassiere). Entrambe le v2 sono state riseminate e sono
verdi. Chiusa anche la lacuna dichiarata sulla **sicurezza sul lavoro** (cinque figure, platee
derivate dall'organigramma).

Da una domanda di Enzo è nata una **regola nuova e retroattiva**: un dato che nessuna API espone
non è nel prodotto. Il cancello è automatico e ha trovato tre tabelle scoperte su trenta — fra cui
il curriculum di ogni persona, invisibile ovunque. Corretto infine un difetto **sistemico** delle
date senza orario, che l'API restituiva spostate di un giorno fuori da UTC.

Codex convive ora sul progetto in sola lettura: la sua identità nel database è stata verificata
(solo `SELECT`, transazioni read-only forzate) e documentata.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial per ogni task; le decisioni tecniche sono di Claude.

## ⚠ Regola nuova, vincolante e retroattiva (Enzo, S1034)

**CANCELLO DI ESPOSIZIONE** — nessun cluster (né alcun lavoro che popoli tabelle) si chiude finché
ciò che ha scritto non è raggiungibile: endpoint, schema condiviso, query, wiring, e la pagina dove
il dato ha un lettore umano. Il cancello è **automatico**: `python docs/kb/tools/check_exposure.py`
deriva dai seed le tabelle scritte, dal sorgente dell'API quelle lette, e fallisce se ne resta una
scoperta. Deroghe solo in `docs/kb/tools/exposure_waivers.txt` **e solo con motivo**.

## ✅ Chiusura S1034 completa — nessuna pendenza

CI **verde** su `85f06f4e`, **deploy in produzione eseguito e verificato**: servizi e timer attivi,
`/readyz` OK, `/login` 200 in 33 ms, `LAST_GOOD` = `85f06f4e`. linux-pc allineato (repo, dati,
ecosistema, clone del database).

**Lezione da portare avanti**: `heuresys_ci` è un clone di produzione **congelato al provisioning**
(D-08) e non viene mai rinfrescato — i due mondi divergono e devono **convivere**, non riallinearsi.
Ogni test che fotografa un conteggio è quindi destinato a rompersi appena il dato reale cresce. La
correzione giusta non è ritoccare il numero: è **definire la popolazione** in modo che valga in
entrambi gli stati (fatto sui 3 file in `85f06f4e`, con lo scenario CI eseguito e non ipotizzato).

**Deriva nota, non bloccante**: 5 marketplace di plugin con SHA divergente → aggiornamento manuale
di Enzo, per macchina. **Debito confermato**: D-55, 500 intermittente al passo TOTP — riproducibile
sotto la suite intera (5 file caduti in avvio), assente in lotti ridotti, verde in CI.

## Stato dei piani

- **Storia RTL 36 mesi** (#77): `docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md` — stato vivo
  in `.storia36/PROGRESS.md`. **C0→C5 chiusi**; prossimo **C6** (riorganizzazione 2025-03).
- Zero-pendenze (#76): `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` — si conta con `zp_state.py piano`.

## ⚠ Top priorities (next session)

1. **#77 storia36 — eseguire il C6** (riorganizzazione 2025-03: storia delle unità organizzative
   all'indietro, il presente resta INVARIATO). Il piano è autosufficiente e il diario
   `.storia36/PROGRESS.md` contiene il metodo dei cluster già chiusi. Effort: 1 sessione.
2. **Coda dei rilievi C5 non assorbiti** — registrati nel diario con numeri e query: selezione dei
   successori col criterio del riporto diretto · `sys_career_path_steps` ancora guscio vuoto ·
   nessuna mobilità interna in 36 mesi · `sys_critical_positions` non riconciliata con
   `position_criticality`. Effort: ~0,5 sessione.
3. **`Z-259` da riprendere** con i rilievi in `.zp/prove/Z-259-verdetti-adversarial.json`.

## Open questions (autorità *cosa* = Enzo)

- **`admin@heuresys.com`**: account di servizio, derivato, senza posizione. Le sue funzioni dovevano
  passare a `enzo.spenuso@heuresys.com`, che però **non ha alcun accesso**: da decidere se e quando.
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors ·
  **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
python docs/kb/tools/check_exposure.py            # 0 tabelle scoperte atteso
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -X -v selftest=1 \
  -f db/scripts/verify-storia36.sql | tail -1     # "batteria globale tutta VERDE"
cat .storia36/PROGRESS.md                         # C6 = primo cluster da eseguire
```
