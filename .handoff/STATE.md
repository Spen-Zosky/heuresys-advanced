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
2. **Le 28 tabelle scoperte** che il cancello di #117 ha trovato: descrivono una persona,
   non sono raggiungibili dal suo portale, e nessuno aveva scritto perché. Alcune sono
   decisioni tue (vedi Open questions), altre lavoro mio. Finché non è chiusa, il cancello
   **non è agganciato** a `db_health.py`: un rosso a riposo insegna a non guardare i rossi.
3. **#123** organigramma-bis e **#159** assistente: entrambe ~1 sessione, entrambe da
   aprire intere. #159 ha il bersaglio cresciuto e va prima definito cosa rende idonea
   una scheda.

## Open questions

- **Le 28 tabelle scoperte**: due esempi che spettano a te — *i sondaggi di clima sono
  anonimi, quindi la persona non deve rivedere le proprie risposte?* e *il punteggio di
  aderenza alla posizione si mostra all'interessato o è materiale del responsabile?*
- **#182** — i due rami: risolta. Nessuno dei due andava portato dentro com'era; entrambi
  archiviati in un tag, il contributo buono recepito.
- **Il ruolo di database `gov_worker`**: si revoca o resta? (aperta dalla sessione scorsa)

## Verification

```bash
python docs/kb/tools/session_start.py                        # menu + salute, un giro
python docs/kb/tools/guardiano.py --sorveglia                # contesto + finestra 5h
python docs/kb/tools/check_pagine_orfane.py                  # nessuna pagina senza motivo
python docs/kb/tools/check_completezza_self.py               # completezza di `self` (C4/I17)
sh scripts/hooks/hook.sh selftest                            # guardia di sessione
ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'   # prova generale
```
