# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-30 (S1036 — l'audit di merito su tutte le tabelle, e le date che tornano a raccontare la verità).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1036)

Chiuso il **C12 quasi per intero** (#80). Il filo: **una data di registrazione uguale per tutti è la
firma del dato caricato in blocco** — otto tabelle registravano fatti di anni diversi col giorno del
popolamento. Riparato, con due controlli permanenti che lo impediscono. Le riparazioni hanno aperto
due catene di coerenza (lauree → esperienze antecedenti; lacune invecchiate → azioni mai prese in
carico), chiuse **portando a coerenza il fatto, mai allargando il controllo**. Un mio difetto di
misura l'ha smascherato il mio stesso selftest.

La **dimostrazione dal vivo** ha trovato ciò che 1.771 prove non vedevano: l'intestazione presentava
un'amministratrice come «Dipendente». Due **falsi indizi** evitati guardando gli artefatti invece
del verde (animazione dei contatori, schermata in caricamento).

Produzione aggiornata; **presidio settimanale provato nei due versi** (verde, e fatto fallire di
proposito l'allarme è comparso nel registro che prima era vuoto). Avvisi di sicurezza aperti: **0**
(caso brace-expansion in **D-77**, con la misura del perché non sia chiudibile per versione).
**Nuova regola di Enzo**: nel deploy la VM va per prima e fino in fondo, poi il linux-pc.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial; le decisioni tecniche sono di Claude.

## Stato dei piani

- **Storia RTL** (#77): `docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md` — stato vivo in
  `.storia36/PROGRESS.md`. **C0→C11 chiusi**; del **C12** restano solo 12.6 e 12.7.
- Zero-pendenze (#76): `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` (`zp_state.py piano`).

## ⚠ Top priorities (next session)

1. **#81 la scheda di una persona non racconta la persona** — `/users/[id]` mostra solo anagrafica
   tecnica (identificativi grezzi, fuso, data in formato macchina) e nulla dei 36 mesi. I dati ci
   sono tutti, è la pagina che non li compone: è quella che si apre davanti a un cliente. Prova
   visiva in `qa_artifacts/storia36/demo/04-scheda-persona.png`. Effort: ~1-1,5 sessioni.
2. **#80 chiudere il C12** — resta **12.6** (skill `storia36-custodia`, **gated**: per decisione di
   Enzo la skill codifica il procedimento *esercitato*, e l'avanzamento mensile non è ancora
   implementato in `storia36.sh`) + **12.7** (chiusura, `#77` → DONE). Effort: ~0,5-1 sessione più
   il lavoro dell'avanzamento.
3. **#79 cancello di esposizione** — continuo, a ogni lavoro che popola tabelle.
4. **`Z-259` da riprendere** con i rilievi in `.zp/prove/Z-259-verdetti-adversarial.json`.

## Open questions (autorità *cosa* = Enzo)

- **`admin@heuresys.com`**: account di servizio, derivato, senza posizione. Le sue funzioni dovevano
  passare a `enzo.spenuso@heuresys.com`, che però **non ha alcun accesso**: da decidere se e quando.
  *(Nota da S1036: l'audit ha rilevato che il suo `user_type` è `STANDARD` come tutti, mentre il
  vocabolario prevede `SERVICE` — correggerlo tocca login e permessi, va deciso a parte.)*
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors ·
  **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
python db/scripts/audit-storia36-semantic.py      # ri-esegue l'audit; 0 tabelle vuote non dichiarate
bash db/scripts/storia36.sh custodia              # "custodia VERDE" atteso
pnpm db:validate                                  # "twice-run idempotency proven" atteso
cat .storia36/PROGRESS.md                         # C12 = unico cluster non spuntato (12.6/12.7)
```
