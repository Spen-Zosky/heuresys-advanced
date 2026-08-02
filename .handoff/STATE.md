# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-02 (S1040 — batch P2 avviato: quattro voci chiuse su undici, ognuna con la sua prova live).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1040)

**Enzo ha delegato l'intero P2** («procedi con tutti i punti di P2»). Il batch vale ~15-20 sessioni:
il piano-file `docs/superpowers/specs/2026-08-02-p2-batch-execution-plan.md` tiene lo stato riga per
riga ed è l'autorità da cui riprendere. **Le prime voci sono chiuse, nessuna lasciata a metà.**

**L'organigramma non può più chiudersi ad anello** (#83): la difesa viveva solo nell'interfaccia,
ora è nel motore. **Le visualizzazioni si versionano e si esportano davvero** (#36): prima il numero
di versione non saliva mai e gli "export" rimandavano a un archivio inesistente. **Il premio
variabile ha il suo motore** (#37): curve e cancelli, con la spiegazione in chiaro accanto
all'importo. **La storia delle persone è entrata in casa** (#49): 2.683 fatti su 161 persone, dal
2005 a oggi, visibili nel profilo e nella propria area.

**Due dossier di linea si sono rivelati stale** e lo erano in modo che contava: B2 dava a zero
tabelle che ne contengono 3.283, B5 dava a zero layout ed export che esistevano. Misurare prima di
progettare ha cambiato il lavoro, non solo la stima.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial; le decisioni tecniche sono di Claude.

## Stato dei piani

- **Batch P2 (mandato S1040)**: in corso. Lo stato per riga sta nel piano-file; si riprende dalla prima voce non chiusa, **P2-05**.
- **Serie C (editing amministrativo)**: resta **#45** (tenant & piattaforma) per completare la linea.
- Zero-pendenze (#76): `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` (`zp_state.py piano`).
- Storia RTL (#77): chiusa, presidio settimanale su VM e linux-pc.

## ⚠ Top priorities (next session)

1. **P2-05 → #56 F2 VRIO scorecard** — prima voce non iniziata del batch P2. Vincolo dichiarato nel
   piano: scorecard **calcolata su dati reali**, non un'euristica inventata. ~2-2,5 sessioni.
2. **#57 OHI org-health, poi #58 AI Advisor** — in quest'ordine, perché l'Advisor cita le due scorecard.
3. **P2-08 → #54 recruiting/ATS** — la voce più grossa del batch (~5-7 sessioni, a fasi con commit
   atomici).
4. **#45 C/C3 — editing tenant & piattaforma** — fuori dal batch P2, chiude la serie C. ~1,5 sessioni.

## Open questions (autorità *cosa* = Enzo)

- **Badge pieni del design system**: le varianti `success`/`destructive` di `@heuresys/ui` non
  reggono il contrasto AA a 12px. La correzione vera sta in `ux-design-shared`: da decidere se
  aprirla lì.
- **`admin@heuresys.com`**: le sue funzioni dovevano passare a `enzo.spenuso@heuresys.com`, che
  però **non ha alcun accesso** — da decidere se e quando (tocca login e permessi).
- **Genitore di un'unità fra tenant diversi** (emersa lavorando su #83): la FK sul genitore non
  impone lo stesso tenant, e `create` non valida affatto il `parentId`. È un buco di isolamento
  diverso dal ciclo, fuori dallo scope di #83 → registrato come voce di backlog, non come pendenza.
- WAIT-INPUT: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors · **#52** SSO
  IdP · **#85** rigenerare `AGENTS.md`, ora divergente · **#86** `claude login` su VM e linux-pc.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
python docs/kb/tools/verify_gate.py check         # "VERDE" atteso su tree pulito
python docs/kb/tools/session_start.py             # menu + salute in un round
bash db/scripts/import-d5-timeline.sh --dry-run   # 4641 righe attese dalla sorgente legacy
pnpm db:validate                                  # "twice-run idempotency proven" atteso
```
