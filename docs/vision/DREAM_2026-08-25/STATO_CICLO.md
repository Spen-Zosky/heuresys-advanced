# Ciclo DREAM 2026-08-25 — stato alla chiusura S1081-dream (interruzione da guardiano)

**Chiusura corrente**: 2026-08-25 ~19:45, per soglia finestra 5h = 99,0% ≥ 80% (verdetto guardiano incollato nel report; contesto 30,5% misurato, 305k/1M — non è lui la causa). *Chiusura precedente*: S1080, ~17:50, stessa soglia (80,0%).

## Contratto del ciclo (immutato, non ri-derivare)

- **Riferimenti di linea (aggiunti da Enzo a ciclo in corso, ~20:00)**: `docs/vision/riferimenti/{posizionamento-centrale,modello-linkedin-vs-heuresys}.md` (+ README). Vincolano V11: le classi definitive devono rispettare i confini del posizionamento (payroll/T&A/benefit esclusi; recruiting non-ATS ⇒ conferma P-26; «digital twin» da non dichiarare ⇒ conferma lo scarto; «AI-assisted decisions, human-governed outcomes» ⇒ conferma P-19; fondazione EU/IT ⇒ rafforza P-16 CCNL). Le sei esperienze LinkedIn-derivate sono vivaio per i prossimi cicli.

- **Traguardi (Enzo)**: T1 = entro 6 mesi prodotto vendibile a PMI italiane strutturate come complemento talent al gestionale HR esistente · T2 = piattaforma dimostrabile dal vivo a prospect/investitori entro pochi mesi. Doppia classificazione MoSCoW indipendente + confronto; due pesi per riga di matrice; argine MUST ≤ 1/5 per ciascun traguardo.
- **Competitor e ruoli**: Personio (concorrente diretto), Eightfold AI (metro di riferimento — mai MUST), Zucchetti (piattaforma coesistente — superfici di integrazione, non lacune).
- **Perimetro di scrittura**: SOLO `docs/vision/**`. Mai `docs/kb/`. Read-only su codice.
- **Fermate obbligatorie**: F1 piano (fatta) · F2 esclusioni censimento (presentata, **in attesa del via di Enzo**) · F3 tabella MoSCoW ×2 (non raggiunta).

## Tabella del piano — stato letto da qui alla ripresa

| id | cosa | stato |
|---|---|---|
| V0 | Contratto Fase 0 | FATTO |
| F1 | Fermata 1 — piano approvato | FATTO (2026-08-25) |
| V1 | `_raccolta/inventario_raw.md` (268 voci, 604 route, 102 pagine) | FATTO |
| V2 | `_raccolta/latenti_raw.md` (19 voci, 6 categorie) | FATTO |
| V3 | `_raccolta/architettura_raw.md` (49 voci + 5 lacune) | FATTO |
| V4 | `_raccolta/competitor_personio.md` (95 voci; vendor dietro anti-bot: contenuto via snippet indicizzati, flag dichiarato) | FATTO |
| V5 | `_raccolta/competitor_eightfold.md` (52 voci; class action su provenienza dataset segnalata) | FATTO |
| V6 | `_raccolta/competitor_zucchetti.md` (24 voci; apiportal.zucchetti.it NON risolve, portale reale dietro SSO) | FATTO |
| V7 | `_raccolta/docs_censimento.md` (1237 file, 17 esclusioni, 11 dir non lette) | FATTO |
| F2 | Fermata 2 — esclusioni mostrate integrali a Enzo | FATTO (2026-08-25, S1081 — Enzo ha delegato il via al vaglio orchestratore nel messaggio di ripresa; vaglio rifatto sulle 17 esclusioni: tutte meccaniche, nessuna da recuperare) |
| V7b | Pass 2 censimento su 11 dir (856 file) | FATTO (S1081 — A 260/260 · B 272/272 · C 324/324, tutti 0 esclusioni e delta 0; C con campione strutturato dichiarato su 4 gruppi ripetitivi; integrazione compilata in `04_MATRICE.md` §Integrazione pass-2) |
| V8 | Matrice di copertura (bozza `04_MATRICE.md`, due pesi per riga) | BOZZA SCRITTA (S1081 — 19 aree, ~110 righe, due pesi T1/T2, ruoli-colonna applicati; §Integrazione pass-2 da compilare al rientro dei lotti) |
| V9 | Proposte + evidenze (bozze `05`, `06`) | FATTO (S1081-dream, ripresa serale — 29 schede su 3 lenti + 3 eretiche + 9 scartate con ragione; classi doppie PROVVISORIE, argine MUST ok: T1=3, T2=2; evidenze F1-F34 + S1-S15) |
| V10 | dream-verifier (opus) | IN CORSO (lanciato ~20:05, output atteso `_raccolta/verifier_verdetti.md`) |
| V11 | Doppia classificazione + confronto | non iniziata |
| F3 | Fermata 3 — tabella MoSCoW ×2 | non raggiunta |
| V12 | File finali `00`–`07` + `manifest.json` + `INDEX.md` | non iniziata |
| V13 | Commit finale | non iniziata (i commit di progresso esistono) |

## Ripresa — primi tre passi (aggiornati alla chiusura S1081-dream)

1. Rileggere questo file; la base è pronta: `04_MATRICE.md` completa di §Integrazione pass-2, i 3 file `docs_censimento_pass2_{a,b,c}.md` completi (856/856, 0 esclusioni). NON rifare nulla di V0–V8.
2. **Onda 3** (orchestratore, non delegabile): generare le proposte con le tre lenti (colmare/superare/sbloccare) → `05_PROPOSTE.md` + `06_EVIDENZE.md` (consolidare fatti F/S dai raccolti). Partire dagli ancoraggi in `04_MATRICE.md` §Integrazione pass-2 e §Lettura d'insieme. Poi V10 (dream-verifier, opus) → V11 (doppia MoSCoW T1/T2 + argine 1/5) → F3 (fermata Enzo) → V12 (file finali 00–07 + manifest + INDEX) → V13.
3. Nel registro «fuori ciclo» (sotto) ci sono voci nuove da presentare UNA volta a fine ciclo.

## Reperti da non perdere (registro «fuori ciclo», si presenta una volta sola)

- Tre contraddizioni doc↔doc già individuate (dettaglio in `_raccolta/docs_censimento.md` §Contraddizioni): AGENTS.md con I12 pre-ribaltone; AGENTS.md cita `admin@heuresys.com` rimosso (mig. 000295); ADR-0026 usa la locuzione ritirata dalla OUTPUT RULE S1011.
- Tre difetti del guardiano trovati e corretti in giornata dalla sessione canonical su segnalazione di questa (231 titolo-fasi; denominatore da tabella non cieco; context-window.json sovrascritto da qualunque sessione). Residuo cosmetico: la sezione contesto stampa ancora una percentuale >100 col giudizio per-ramo «CHIUDI» invece di dichiararsi cieca — segnalato.

*Aggiunte S1081-dream (dal pass-2; presentare UNA volta a fine ciclo):*
- **Skill Codex `multi-tenant-validator` raccomanda RLS** («3. Enable RLS: Consider PostgreSQL Row Level Security», SKILL.md:338) in contraddizione frontale con l'invariante **I5** («NEVER RLS»). Il file non nomina mai Heuresys e usa esempi Prisma: sembra un template generico mai adattato. È superficie di Codex, non mia — da segnalare a lui.
- **Copia Codex di `zero-pending-loop` in drift**: 6 file su 12 divergono dalla copia vigente in `.claude/skills/`, ferma al 26-27 luglio contro il 4-10 agosto della vigente (manca fra l'altro il supporto multi-worker `--cluster Z-nnn` di #173).
- **Due skill Codex descrivono un ambiente inesistente**: `dashboards-jobs` e `consolida-pagina` referenziano Docker a 4 container, tabelle `rbp_*`, `heuresys_evo_platform_db` e due documenti `docs/DASHBOARDS_*` che non esistono nel repo (verificato `test -f` → NOT FOUND).
- **`TODO_100X.md` non riconciliato**: elenca QW-D1/QW-D2 come TODO mentre `DOSSIERS/D-04.md` li dichiara DONE con verifica live sul codice — il dossier stesso segnala il drift e lo rimanda a «un fix doc separato» mai fatto.
- **Cinque wargame di prodotto** (#26/#27/#28/#34/#24) restano scritti come lavoro da fare mentre il backlog li segna DONE: chi li apre oggi crede che quelle funzionalità manchino.
- **Il guardiano non deposita la finestra di questa sessione**: `context-window.json` porta il valore di un'altra sessione, e il ramo contesto si è dichiarato NON MISURABILE a metà sessione (poi tornato misurabile). Comportamento corretto dopo la correzione di ieri, ma la sessione dream non scrive il proprio denominatore.
- **Il cancello locale gira suite non pertinenti al mandato dream**: `verify_gate` ha instradato typecheck/test-api/db-health per commit della canonical, con corse >10 min dentro una sessione che tocca solo `docs/vision/**`. Da valutare un instradamento per-mandato (fuori ciclo, non urgente).
