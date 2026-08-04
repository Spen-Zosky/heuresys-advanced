# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-04 (S1042 — consegna dalla sessione lab eseguita, bonifica dati chiusa e in produzione).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1042)

**Enzo ha consegnato un ordine di lavoro preparato in sessione lab e ha detto «eseguila».** Sei voci,
cinque chiuse; la sesta (ciclo di valutazione, #92) era dichiarata fuori sessione fin dall'apertura.
Piano-file: `docs/superpowers/specs/2026-08-03-consegna-lab-esecuzione.md`, lo stato si legge per riga da lì.

**Il filo conduttore: i numeri di ieri non sono i numeri di oggi.** Quasi ogni voce ha cambiato forma
appena misurata sul campo — le chiavi esterne «da indicizzare» erano una frazione di quelle dichiarate
(molte su colonne vuote); i percorsi duplicati «inerti» avevano assegnazioni di persone reali; la
contaminazione era più ampia del censito e con una classe che il criterio non catturava. Su un dato
**avevo riportato male io**, sovrapponendo due misure che venivano da query diverse, e ha rischiato di
far decidere Enzo su un rischio inesistente.

**Le sentinelle hanno ripagato il giorno stesso in cui sono state accese**: viste scritte in sessioni
passate che nessuno interrogava. Una si è accesa subito dopo la bonifica e ha scoperto un danno che
avevo appena fatto (traduzioni orfane) — cosa che nessuna rilettura del codice avrebbe trovato.

**Enzo ha corretto un criterio, non solo un dato**: «globale» non basta a giustificare una riga. Le
tassonomie ufficiali (ESCO/ISCO/NACE/ATECO/CCNL) restano aperte a ogni industry perché senza di esse
non si creano nuovi blueprint; ma un KPI è **contenuto**, e un indicatore HACCP non serve né a una
banca né a una società di consulenza. Recepito come invariante **I21** nel CLAUDE.md.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial; le decisioni tecniche sono di Claude.

## Stato dei piani

- **Consegna lab (S1042)**: chiusa e verificata live in produzione tranne **#92** (ciclo di
  valutazione), dichiarato fuori sessione fin dall'apertura — decisione già presa da Enzo.
- **Batch P2+P3 (S1040-S1041)**: restano **#54 recruiting** e **#50 knowledge graph**.
- Zero-pendenze (#76): `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` (`zp_state.py piano`).

## ⚠ Top priorities (next session)

1. **#92 ciclo di valutazione completo** — decisione di Enzo già presa, specifica pronta in sette
   passi: tabelle nuove (alcune da ingerire dal legacy, dove le sessioni di calibrazione sono reali),
   permessi, macchina a stati, ESS + superficie manageriale · doc §V6 del piano di consegna.
2. **#54 recruiting/ATS** — la voce più grossa rimasta, dominio nuovo completo ·
   `docs/product/DEVELOPMENT_LINES_E_EVO_VERTICALS.md` §E5.
3. **#50 knowledge graph legacy** — richiede il disegno della destinazione prima dell'import,
   non è un travaso.

## Open questions (autorità *cosa* = Enzo)

- **Cinque percorsi di RTL Bank hanno per nome una chiave-macchina** invece di un titolo leggibile
  (`OLDDB::learning_paths::<uuid>`), e **199 assegnazioni di 124 persone** ci puntano. Non vanno
  cancellati: va dato loro un nome. Apriamo la voce?
- **Wizard di materializzazione da archetipo**: C3 lo nominava, non è stato costruito — procedura
  guidata a più passi, non un pannello. La apriamo?
- **Badge pieni del design system**: `success`/`destructive` di `@heuresys/ui` non reggono il
  contrasto AA; la correzione vera sta in `ux-design-shared`.
- **`admin@heuresys.com`**: le sue funzioni dovevano passare a `enzo.spenuso@heuresys.com`, che però **non ha alcun accesso**.
- WAIT-INPUT: **#8** Outlook · **#16** SuccessFactors · **#52** SSO IdP · **#85** `AGENTS.md` ·
  **#86** `claude login` su VM e linux-pc.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline                # 0 dopo il push handoff
python docs/kb/tools/session_start.py              # menu + salute + sentinelle in un round
python docs/kb/tools/db_health.py                  # atteso: "tutto nei limiti"
python docs/kb/tools/check_tenant_contamination.py # atteso: "nessuna contaminazione residua"
```
