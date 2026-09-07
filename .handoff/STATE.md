# STATE — vista rapida

*Ultimo aggiornamento: chiusura S1091 (2026-09-07/08). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

⚠ **Chiusura ESSENZIALE, dichiarata**: la sessione ha raggiunto la soglia del guardiano
(contesto 74,5 %, mancavano 5.476 token al 75 %). La skill `handoff` non ci stava, quindi
STATE è riscritto a mano e `SOT_STATE.md` **non** è stato ri-derivato oltre la headline delle
migrazioni. Chi riprende lo consideri parziale.

## Last session brief

Sessione lunga su mandato «esegui tutte le voci P0-P3 in autonomia», poi tre «prosegui».
**21 commit**, tutti pubblicati. Backlog: ACTIVE 10 → 8 · WAIT-INPUT 2 → 0.
Chiuse: `#249` (presidio dei piani), `#231` (ciclo esaurito), `#50` (grafo, E2E verde in CI).

⭐ **Tre reperti che non erano nel piano:**
1. **Buco di sicurezza APERTO in produzione**: chi aveva la chiave madre entrava come
   `PLATFORM_ADMIN` esente da MFA. Le utenze di collaudo erano state «riparate» il 31 agosto
   con lo strumento della chiave madre, e `isRealPerson` — una lista di due email — non le
   proteggeva. Chiuso: guardia su `user_type='SERVICE'` + riallineamento con giornale.
2. **Una persona senza secondo fattore da dieci mesi** (`alberto.rossetti`), curata; e la
   sentinella che mancava (`v_persona_senza_secondo_fattore`, informativa, mig `000380`).
3. **`teams` seguiva l'asse SBAGLIATO**: classificato ACTIVITY, gattato con l'asse
   organizzativo. 6 persone su 10 con ruolo manageriale, senza guidare squadre, vedevano
   tutte e 25 le squadre di RTL. Corretto.

## Top priorities

1. ⚠ **Il verdetto salvato di `verify_gate` è ROSSO e non è stato ribaltato.** Dopo il commit
   il gate dice «nessuna modifica che richieda verifica»; forzarlo da Windows costa ~100 min.
   **La misura vera esiste ed è del gemello: 1 fallito su 1883, corretto, tre file 20/20.**
   Si rimette in pari con `verify_gate run --suite test-api`, meglio sul gemello.
2. **`#54` F3 — 5 fette su 7.** Restano `feedback` e `offers`. Il pattern è rodato.
3. **`#143` F3** — `isInFunctionalScope`/`isFunctionalLeader` restano senza consumatori:
   aspettano una superficie che gatti un singolo record contro una persona.
4. **`#159` F2** — la metà di questo repo è fatta (il canale); il componente è di
   `ux-design-shared`, altro repository, non aperto.

## Open questions

- ⭐ Le tabelle del recruiting sono **vuote** in produzione: il modello c'è, i dati no.
  Popolare il ciclo è materia di `#54` F4.
- **`#198`** è GATED su un fatto tecnico misurato: `sys_blueprint_content_*` tutte a 0.
- La ricerca semantica sul gemello è accesa e ogni corsa costa due chiamate a pagamento.
- ⚠ Una chiave API è transitata nell'output di un comando in S1088: da ruotare.

## Tre lezioni che valgono oltre le voci

1. **Un verde al primo colpo non è una prova.** Due volte un mio test è passato anche col
   codice sabotato — la prima versione confrontava con il totale di tutti i tenant invece che
   con quello della persona. Sondare ha salvato entrambe.
2. **Il cancello locale ha detto 18 falliti; sul gemello erano 1.** Diciassette erano contesa
   d'ambiente (processi appesi di un mio comando in timeout). Una misura di lentezza è un dato:
   102 minuti contro i ~37 attesi erano il sintomo.
3. **Il fuso rompe i test a mezzanotte.** `toISOString()` è UTC, `current_date` è il fuso del
   server: dopo mezzanotte dicono giorni diversi. Le date si prendono dal database.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/verify_gate.py run --suite test-api   # il verdetto salvato e' ROSSO
bash scripts/verifica-deploy.sh                            # atteso: deploy armato su c5a1d284
python docs/kb/tools/check_marciume.py
```
