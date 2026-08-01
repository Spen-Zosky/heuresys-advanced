# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-01 (S1038 — l'applicazione ha smesso di essere solo consultabile: ora si governa dall'interfaccia).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1038)

**#44 e #43 chiusi**: la piattaforma mostrava l'organizzazione ma non permetteva di cambiarla.
Ora persone (anagrafica + ruoli), posizioni, organigramma, e tutti i cataloghi — mansioni,
tassonomia competenze, competenze con sinonimi e legami, KPI, formazione con percorsi — si
governano dal browser. Due pagine sono NUOVE (`/job-catalog`, `/skill-taxonomy`): erano gli ultimi
moduli con API complete e nessuna interfaccia. Ogni pagina nuova porta la sua migrazione, perché
il menù vive nel database: una rotta senza la sua riga esiste e non la raggiunge nessuno.

**Il filo della sessione: lo stesso difetto scoperto quattro volte, sempre da un collaudo rosso.**
Elenchi troncati su cataloghi grandi: l'elemento appena creato finiva oltre la prima pagina della
tabella e non si riusciva più a correggerlo. Ogni volta l'ha trovato una prova che falliva, mai una
supposizione. Ora ogni catalogo filtra lato server.

**#82 non era instabilità, era un difetto vero.** La prova a11y falliva solo quando l'elemento
compariva — il contatore delle notifiche non lette esiste solo se ce ne sono. Contrasto misurato
2,2-3,5 contro il 4,5 richiesto, su varianti PIENE del badge che vengono dal design system a monte
e cambiano colore fra tema chiaro e scuro: nessun riempimento era sicuro in entrambi. Sette badge
convertiti a contorno. **Nota di sistema**: la suite principale DIPENDE dai progetti a11y, quindi
quel rosso bloccava l'esecuzione di tutto il resto.

**Tre debiti chiusi misurando, non ereditando la narrativa scritta** (D-76, D-75, D-69: dettaglio
in `SOT_STATE` Delta S1038). Il registro debiti passa da quattro aperti a uno.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial; le decisioni tecniche sono di Claude.

## Stato dei piani

- **Serie C (editing amministrativo)**: **#44 e #43 CHIUSI**. Resta **#45** (tenant & piattaforma)
  per completare la linea — stessi schemi già collaudati qui.
- Zero-pendenze (#76): `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` (`zp_state.py piano`).
- Storia RTL (#77): chiusa, presidio settimanale su VM e linux-pc.

## ⚠ Top priorities (next session)

1. **#45 C/C3 — editing tenant & piattaforma** — chiude la serie C aperta in questa sessione; il
   metodo è già collaudato (pannello + ricerca lato server + prova live dall'interfaccia). ~1,5 sessioni.
2. **#76 zero-pendenze, prossima ondata** — conta le pendenze con
   `python docs/kb/tools/zp_state.py piano`, non citando un totale vecchio.
3. **#83 l'API non impedisce i cicli nell'organigramma** — la difesa oggi vive solo
   nell'interfaccia; un chiamante diretto può ancora spezzare l'albero. ~1h.
4. **#9/#10/#11 audit forense 100X** — ~1-2 sessioni (WS-L + triage + gate).

## Open questions (autorità *cosa* = Enzo)

- **Badge pieni del design system**: le varianti `success`/`destructive` di `@heuresys/ui` non
  reggono il contrasto AA a 12px. Qui sono state aggirate (contorno invece di riempimento), ma la
  correzione vera sta in `ux-design-shared`: da decidere se aprirla lì.
- **`admin@heuresys.com`**: le sue funzioni dovevano passare a `enzo.spenuso@heuresys.com`, che
  però **non ha alcun accesso** — da decidere se e quando (tocca login e permessi).
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors ·
  **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
python docs/kb/tools/session_start.py             # menu + salute in un round
cd apps/web && node scripts/e2e-node22.mjs test --config=playwright.prod.config.ts   # 274 passati / 0 falliti attesi
pnpm db:validate                                  # "twice-run idempotency proven" atteso
```
