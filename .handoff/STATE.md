# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-03 (S1041 — batch P2+P3 eseguito: dieci voci chiuse, spinto in produzione).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1041)

**Enzo ha delegato «i batch P2 e P3» e ha chiesto di non interrompersi fra una voce e l'altra.**
Il piano-file `docs/superpowers/specs/2026-08-02-p2-batch-execution-plan.md` resta l'autorità e
lo stato si legge per riga da lì: di P2 resta **solo il recruiting**, di P3 **solo il knowledge
graph**.

**Il filo conduttore**: metà dei difetti non stava nel codice nuovo ma in **dichiarazioni che il
sistema non sosteneva**. L'informativa pubblica prometteva 24 mesi di conservazione e nessun
meccanismo li applicava. Il «peso economico» delle posizioni era letto da un motore ed era vuoto
su tutte e 181. Una regola dell'advisor collegava competenze e famiglie di competenze *per nome*
e non poteva scattare mai. Le fasce retributive avevano il codice tecnico al posto del nome su 43
righe. Un rilievo d'audit chiedeva di potare 88 export su una premessa che, misurata, era falsa.
Nessuno era visibile da un test verde: sono emersi confrontando ciò che il sistema **afferma** con
ciò che **fa** — un controllo che non esiste in forma automatica.

**Le guardie del progetto hanno funzionato**: l'org-gate ha fatto *rifiutare l'avvio* all'API per
una dichiarazione mancante; il lint ha colto una scrittura su ref durante il render; il gate i18n
ha intercettato l'ultima lacuna inglese. Hanno dato fastidio nel momento giusto.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial; le decisioni tecniche sono di Claude.

## Stato dei piani

- **Batch P2+P3 (mandato S1040-S1041)**: quasi chiuso. Lo stato per riga sta nel piano-file.
  Restano **#54 recruiting** e **#50 knowledge graph**.
- Zero-pendenze (#76): `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` (`zp_state.py piano`).
- Storia RTL (#77): chiusa, presidio settimanale su VM e linux-pc.

## ⚠ Top priorities (next session)

1. **#54 recruiting/ATS** — la voce più grossa rimasta, dominio nuovo completo
   (requisition → posting → candidato → colloquio → offerta). ~5-7 sessioni, a fasi con commit
   atomici · `docs/product/DEVELOPMENT_LINES_E_EVO_VERTICALS.md` §E5.
2. **#50 knowledge graph legacy** — 139k nodi/archi; **richiede il disegno della destinazione
   prima dell'import**, non è un travaso. ~2-3 sessioni · `DEVELOPMENT_LINES_D_WAVE2_LEGACY_DATA.md` §D4.
3. **Fuori batch, se lo vuoi**: bonifica dei tenant legacy mai migrati (~5.900 righe SmartFood/
   EcoNova) — **operazione distruttiva, serve il tuo via libera**; e le **75 fasce retributive
   orfane** (nessun tenant, nessun importo), stessa natura.

## Open questions (autorità *cosa* = Enzo)

- **Wizard di materializzazione da archetipo**: C3 lo nominava, non è stato costruito — è una
  procedura guidata a più passi, non un pannello. Merita una voce propria: la apriamo?
- **Badge pieni del design system**: le varianti `success`/`destructive` di `@heuresys/ui` non
  reggono il contrasto AA a 12px. La correzione vera sta in `ux-design-shared`.
- **`admin@heuresys.com`**: le sue funzioni dovevano passare a `enzo.spenuso@heuresys.com`, che
  però **non ha alcun accesso**.
- WAIT-INPUT: **#8** app-password Outlook · **#16** SuccessFactors · **#52** SSO IdP · **#85**
  rigenerare `AGENTS.md` · **#86** `claude login` su VM e linux-pc.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
python docs/kb/tools/session_start.py             # menu + salute in un round
cd apps/api && pnpm exec vitest run test/advisor-suggestions.integration.test.ts   # 12 verdi
cd apps/api && pnpm exec vitest run test/inbox-stream.integration.test.ts          # 5 verdi
cd apps/api && pnpm test:unit                                                      # 67 verdi
```
