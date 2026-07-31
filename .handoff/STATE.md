# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-31 (S1037 — il programma storia36 è chiuso, e la scheda di una persona ha smesso di essere un elenco di codici).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1037)

**Storia RTL chiusa, 13 cluster su 13** (#77 + #80). L'ultimo passo aveva una precondizione che
**non era vera**: il piano diceva di scrivere la procedura di manutenzione solo dopo averla
esercitata, ma il terzo modo — quello che porta la storia a ieri — non era mai stato costruito.
Prima il modo, poi la skill. Ed è servito subito: la storia era ferma al 24 luglio.

Il filo della sessione: **spostare la frontiera in avanti scopre ciò che il tempo rompe da solo**.
Appena la storia è avanzata, un'abilitazione obbligatoria è risultata scaduta e mai rinnovata —
nessuno aveva sbagliato, era passato il tempo. I check leggono la frontiera della storia, non
l'orologio.

**#81 chiuso lo stesso giorno in cui la sua nota è stata smentita dalla misura**: diceva «gli
endpoint esistono già», il sondaggio dal vivo ha mostrato che molti ignoravano il filtro per utente
e restituivano l'intera popolazione. Una nota non misurata vale quanto un'opinione.

**Due difetti trovati sbattendoci contro**, non cercati: un seeder rimasto indietro rispetto a
Z-262 che, se rieseguito, **rompeva il login di tutte le personas**; e l'orologio di questo PC
**indietro di oltre dieci ore**, che ha fatto fallire una manciata di prove con un sintomo
travestito (una scadenza «precedente» alla propria creazione). Il
secondo ha lasciato due presidi: un controllo dello scarto nel cruscotto d'avvio e un'attività
pianificata sul PC (il solo servizio Windows **non basta** — misurato).

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial; le decisioni tecniche sono di Claude.

## Stato dei piani

- **Storia RTL** (#77): **CHIUSA**. Il piano si archivia; ciò che resta è ricorrente e vive nella
  skill `storia36-custodia` + `.storia36/PROGRESS.md`. Presidio settimanale attivo su VM e linux-pc.
- Zero-pendenze (#76): `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` (`zp_state.py piano`).

## ⚠ Top priorities (next session)

1. **#76 zero-pendenze, prossima ondata** — è il piano che assorbe il resto; conta le pendenze con
   `python docs/kb/tools/zp_state.py piano`, non citando un totale vecchio.
2. **#9/#10/#11 audit forense 100X** — ~1-2 sessioni (WS-L + triage + gate).
3. **#82 la prova a11y su `/me/inbox` è instabile** — passata, fallita e poi flaky nella stessa
   mezz'ora a codice invariato. Una prova instabile insegna a ignorare il rosso: va sistemata.
   Effort ~1-2h.
4. **#79 cancello di esposizione** — continuo, a ogni lavoro che popola tabelle.

## Open questions (autorità *cosa* = Enzo)

- **`admin@heuresys.com`**: account di servizio, derivato, senza posizione. Le sue funzioni dovevano
  passare a `enzo.spenuso@heuresys.com`, che però **non ha alcun accesso**: da decidere se e quando.
  *(Il suo `user_type` è `STANDARD` come tutti, mentre il vocabolario prevede `SERVICE` —
  correggerlo tocca login e permessi, va deciso a parte.)*
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors ·
  **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
python docs/kb/tools/session_start.py             # incluso "orologio allineato col database"
bash db/scripts/storia36.sh custodia              # "custodia VERDE" atteso
bash db/scripts/storia36.sh avanzamento           # 0 righe se la storia è già a ieri
pnpm db:validate                                  # "twice-run idempotency proven" atteso
```
