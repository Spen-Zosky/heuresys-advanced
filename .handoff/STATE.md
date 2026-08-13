# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-13 (S1056).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1056)

Batch su mandato di Enzo — «i due rami, poi le voci P2, e fai il massimo» — chiuso a
**dieci voci**, con lo stesso filo di S1055 e più stretto: **quasi ogni voce descriveva
un difetto diverso da quello reale**, e tre volte su dieci il lavoro era già fatto e
mancava solo di dirlo.

Due voci si sono chiuse **senza scrivere codice di prodotto**: #124 era finita da un
giorno e teneva una voce P1 nel menu, #147 aveva due condizioni su tre già vere. Due
rami «recuperati» si sono rivelati uno **superato** — main aveva già lo stesso lavoro in
forma migliore — e l'altro **giusto nella diagnosi e sbagliato nel meccanismo**, con
dentro un difetto peggiore che taceva: su CI la pulizia dopo i test era un no-op.

**Il metodo che ha retto, e che è costato tre volte**: le prove viste fallire. Tre volte
una mia prova era **incapace di fallire** — provava una simulazione invece del codice,
o poggiava su una regola circolare, o leggeva i totali senza una linea di base. Ogni
volta l'ha detto un sabotaggio, non io.

**Nuovo, e vale oltre questo progetto**: il **guardiano** — contesto ≥75% *oppure*
finestra 5h ≥80% → si chiude. Regola e strumento sono installati a **livello utente**,
quindi valgono in ogni sessione e in ogni progetto.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **#126** — le predizioni algoritmiche all'interessato. **156 persone su 158 hanno oggi
   una predizione su di sé che non possono vedere.** È a piena pila (2 endpoint + schemi +
   test + superficie con login reale), ~3-4h, e il suo lavoro è **già schedato** dentro il
   cancello di #117 come «decisa, da costruire».
2. **Le tabelle scoperte del cancello di #117: da 28 a 22** (S1057, le due decisioni di
   Enzo registrate). Descrivono una persona, non sono raggiungibili dal suo portale, e
   nessuno ha scritto perché. Delle 22 che restano **non è ancora detto quante siano lavoro
   mio e quante decisioni tue**: alcune hanno già il loro precedente scritto — i punteggi di
   talento, prontezza e successione sono della stessa natura dell'aderenza appena decisa, e
   le segnalazioni whistleblowing sono già isolate da ADR-0036 §5 — ma la classificazione
   non è stata fatta, quindi dire che sono tutte mie sarebbe una supposizione. Finché non è
   chiusa, il cancello **non è agganciato** a `db_health.py`: un rosso a riposo insegna a
   non guardare i rossi.
3. **#123** organigramma-bis e **#159** assistente: entrambe ~1 sessione, entrambe da
   aprire intere. #159 ha il bersaglio cresciuto e va prima definito cosa rende idonea
   una scheda.

## Open questions

Nessuna domanda aperta. Le tre che c'erano sono decise (Enzo, 2026-08-13, S1057):

- **Sondaggi di clima** → **la persona può rivedere le proprie risposte**. Registrata in
  `check_completezza_self.py` come *decisa, da costruire*: `sys_engagement_survey_responses`
  (862 risposte, 158 persone), il suo padre `sys_engagement_surveys` che ne è il contesto, e
  per estensione derivata `sys_pulse_checks` (2.834 rilevazioni, 157 persone). **La premessa
  della domanda non reggeva sul dato**: dei 6 sondaggi nessuno ha `survey_is_anonymous` a
  vero. Escluse invece `sys_engagement_survey_templates` e `sys_engagement_feedback` — nella
  seconda l'unica colonna verso una persona è il revisore: 400 righe **senza mittente**,
  anonime per costruzione dello schema.
- **Punteggio di aderenza alla posizione** → **solo il responsabile**, non l'interessato.
  `sys_employee_position_fit_scores` (146 righe, 146 persone) è fra le esclusioni motivate,
  con la categoria nuova `[RESPONSABILE]`.
- **Il ruolo di database `gov_worker`** → **resta**. Misurato: login sì, superuser no,
  `default_transaction_read_only=on` pinnato sul ruolo, timeout 120s/5s/300s, e il solo
  privilegio è `SELECT` (sys 239 · staging 30 · audit 11 · reference_sync 3).
- **#182** — i due rami: risolta in S1056. Nessuno dei due andava portato dentro com'era;
  entrambi archiviati in un tag, il contributo buono recepito.

## Verification

```bash
python docs/kb/tools/session_start.py                        # menu + salute, un giro
python docs/kb/tools/guardiano.py --sorveglia                # contesto + finestra 5h
python docs/kb/tools/check_pagine_orfane.py                  # nessuna pagina senza motivo
python docs/kb/tools/check_completezza_self.py               # completezza di `self` (C4/I17)
sh scripts/hooks/hook.sh selftest                            # guardia di sessione
ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'   # prova generale
```
