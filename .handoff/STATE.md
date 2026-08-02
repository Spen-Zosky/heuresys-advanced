# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-01 (S1039 — l'ecosistema Claude si adegua a Opus 5, e il progetto guadagna un cancello che impedisce di chiudere un turno senza prove).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1039)

**Sessione di ecosistema, non di prodotto**: nessun codice applicativo, nessuna migrazione, nessun
test toccato — i conteggi restano quelli di S1038, ri-derivati e identici.

**`CLAUDE.md` da 38.393 a 20.990 caratteri senza perdere nulla.** I 17 invarianti, la Definition of
Done e "What NOT to touch" restano verbatim; ciò che serve solo su un'area è finito in quattro
`.claude/rules/` che si caricano sul percorso e in una skill. Tagliato il derivabile: l'albero delle
directory e la sezione che ridescriveva quello che l'hook di avvio già esegue.

**Nasce il cancello di verifica** (`verify_gate.py` + hook `Stop`). Il verdetto è funzione dello
stato osservabile, non della conversazione: se il working tree cambia, scade da solo. **Da ora, se
modifichi codice e non lanci `verify_gate.py run`, a fine turno il cancello blocca una volta e dice
cosa manca.** Freno: `touch .zp/verify-off`.

**Scritta la regola di convivenza che mancava**: unico writer di `docs/kb/` è la CLI; Cowork e
Desktop sono read-only e propongono via `COWORK_INBOX.md`. Viveva solo nelle preferenze globali di
claude.ai, per un vincolo che riguarda questo progetto soltanto.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial; le decisioni tecniche sono di Claude.

## Stato dei piani

- **Serie C (editing amministrativo)**: #44 e #43 chiusi in S1038. Resta **#45** (tenant &
  piattaforma) per completare la linea — stessi schemi già collaudati.
- Zero-pendenze (#76): `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` (`zp_state.py piano`).
- Storia RTL (#77): chiusa, presidio settimanale su VM e linux-pc.

## ⚠ Top priorities (next session)

1. **#45 C/C3 — editing tenant & piattaforma** — chiude la serie C; il metodo è già collaudato
   (pannello + ricerca lato server + prova live dall'interfaccia). ~1,5 sessioni.
2. **#76 zero-pendenze, prossima ondata** — conta le pendenze con
   `python docs/kb/tools/zp_state.py piano`, non citando un totale vecchio.
3. **#83 l'API non impedisce i cicli nell'organigramma** — la difesa vive solo nell'interfaccia;
   un chiamante diretto può ancora spezzare l'albero. ~1h.
4. **#9/#10/#11 audit forense 100X** — ~1-2 sessioni (WS-L + triage + gate).

## Open questions (autorità *cosa* = Enzo)

- **Badge pieni del design system**: le varianti `success`/`destructive` di `@heuresys/ui` non
  reggono il contrasto AA a 12px. Qui aggirate con il contorno; la correzione vera sta in
  `ux-design-shared`: da decidere se aprirla lì.
- **`admin@heuresys.com`**: le sue funzioni dovevano passare a `enzo.spenuso@heuresys.com`, che
  però **non ha alcun accesso** — da decidere se e quando (tocca login e permessi).
- WAIT-INPUT: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors · **#52** SSO
  IdP · **#85** rigenerare `AGENTS.md`, ora divergente · **#86** `claude login` su VM e linux-pc.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
python docs/kb/tools/verify_gate.py check         # "VERDE" atteso su tree pulito
python docs/kb/tools/session_start.py             # menu + salute in un round
cd apps/web && node scripts/e2e-node22.mjs test --config=playwright.prod.config.ts   # 274 passati / 0 falliti attesi
pnpm db:validate                                  # "twice-run idempotency proven" atteso
```
