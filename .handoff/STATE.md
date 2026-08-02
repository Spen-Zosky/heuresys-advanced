# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-02 (S1041 — mandato esteso a P2 **e** P3; tre voci chiuse, due modelli corretti dopo la prova live).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1041)

**Enzo ha esteso la delega da P2 a «i batch P2 e P3»**. Il piano-file
`docs/superpowers/specs/2026-08-02-p2-batch-execution-plan.md` governa ora entrambi, tabella per
tabella, ed è l'autorità da cui riprendere.

**Le regole del setup si caricano davvero quando servono** (#84): metà era già misurata, la metà
positiva ora anche, con controllo negativo. Nessuna azione, l'ipotesi di ripiego decade.
**Le capability sono classificate** (#56) e **le unità organizzative hanno un indice di salute**
(#57).

**La cosa che conta è che entrambe le scorecard erano sbagliate al primo colpo, con i test verdi.**
Il VRIO dichiarava dieci vantaggi sostenibili su diciannove perché tre assi su quattro dicevano
"sì" a tutti; e leggeva «nessuno la possiede» come «rarissima». La salute organizzativa diceva
"nessun problema da nessuna parte" perché l'indice viveva tutto fra 70 e 82. In entrambi i casi è
stato corretto il **modello**, non le soglie, e sono entrati test che contro la prima versione
sarebbero rossi. Il secondo difetto è stato intercettato prima, perché la guardia era scritta nel
piano *prima* di implementare — è il metodo che ha funzionato, non la fortuna.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial; le decisioni tecniche sono di Claude.

## Stato dei piani

- **Batch P2+P3 (mandato S1040, esteso S1041)**: in corso. Lo stato per riga sta nel piano-file.
  P2: 6 voci chiuse su 11 · P3: 1 su 5. Si riprende da **P2-07**.
- Zero-pendenze (#76): `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` (`zp_state.py piano`).
- Storia RTL (#77): chiusa, presidio settimanale su VM e linux-pc.

## ⚠ Top priorities (next session)

1. **P2-07 → #58 F4 AI Advisor** — **simulazione già compilata e committata**: la fase 1 è un
   motore a **regole**, non un LLM, perché il criterio è *«ogni consiglio cita una fonte
   verificabile»* e un modello può inventare la citazione. Le tre fonti che citerà (F1, F2, F3)
   esistono tutte. ~2-3 sessioni.
2. **P2-08 → #54 recruiting/ATS** — la voce più grossa del batch, a fasi con commit atomici. ~5-7 sessioni.
3. **P2-09 → #9/#10/#11 audit forense 100X** · poi **P2-10 → #4 GTM** (parte non-pricing).
4. **P3 residue**: #38 SSE · #53 payroll · #45 C3 · #50 knowledge graph — dopo il grosso di P2,
   perché recruiting e audit toccano le stesse superfici.

## Open questions (autorità *cosa* = Enzo)

- **Badge pieni del design system**: le varianti `success`/`destructive` di `@heuresys/ui` non
  reggono il contrasto AA a 12px. La correzione vera sta in `ux-design-shared`: da decidere se
  aprirla lì.
- **`admin@heuresys.com`**: le sue funzioni dovevano passare a `enzo.spenuso@heuresys.com`, che
  però **non ha alcun accesso** — da decidere se e quando (tocca login e permessi).
- WAIT-INPUT: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors · **#52** SSO
  IdP · **#85** rigenerare `AGENTS.md`, ora divergente · **#86** `claude login` su VM e linux-pc.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
python docs/kb/tools/session_start.py             # menu + salute in un round
cd apps/api && pnpm exec vitest run test/vrio-scorecard.integration.test.ts   # 11 verdi
cd apps/api && pnpm exec vitest run test/org-health.integration.test.ts       # 12 verdi
```
