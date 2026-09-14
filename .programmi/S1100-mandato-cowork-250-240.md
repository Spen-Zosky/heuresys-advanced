# S1100 — mandato «recepire il lavoro Cowork del 2026-09-14» (#250, #240, mig 000414)

*Mandato scritto da Cowork in `C:\Users\enzospenuso\Claude Desktop\heuresys-advanced\sessioni\session_2026-09-14_decisioni-250-240\MANDATO_per_la_CLI.md`; contesto nelle quattro voci datate 2026-09-14 di `docs/kb/COWORK_INBOX.md`.*

> **stato**: CHIUSO
> **chiuso**: 2026-09-14 — 6 voci fatte su 6, non resta niente
> **registro di sessione** — cronaca di ciò che si fa, non il programma di una voce: non
> dichiara `item` di proposito (D-92).

**Misura all'apertura** (`guardiano.py`): contesto **11.1%** · finestra 5h **27.0%** ·
verdetto testuale: `✓ si continua — contesto: mancano 639,122 token · 5h: mancano 53.0 punti`.

**Confine di sessione dichiarato (R24 §4).** Sei voci, tutte piccole (stima totale ~60k token):
ci stanno tutte. Nessuna richiede Enzo, salvo il push (autorizzazione session-scoped: chiedo).

**Fuori dal mandato per natura** (R24 §5, una volta sola): `derivati: 2/3 superati` →
`build_derivati.py` (segnalato da Cowork, non nel mandato — lo eseguo solo se la chiusura lo
pretende) · il file untracked `.programmi/_zp_verify_tmp/` (non mio, non lo tocco) · i file di
Codex (`.codex/`, `.codex-review/`, `.agents/`, `AGENTS.md`, `apps/web/AGENTS.md`,
`apps/web/CLAUDE.md`: attesi per contratto, non si portano).

---

## Le voci

| id | cosa | chi | fatto quando | stato |
|---|---|---|---|---|
| V1 | prova generale `ci-rehearsal.sh` sul gemello con la 000414 (scp del solo .sql) | io | esce 0, due passate, sentinelle verdi | [x] |
| V2 | applicare la 000414 alla produzione (`pnpm db:migrate:vm`) | io | `applied` include 000414; `db_health` 50/50 a zero; `BRANCH_MANAGER` = `hierarchical_operational`; vista esiste | [x] |
| V3 | commit con i percorsi sul commit (000414 + COWORK_INBOX) | io | `git log -1 --stat` mostra i soli due file | [x] |
| V4 | chiudere `#250` e `#240` nel register (DONE + archivio via `compatta_register.py`) | io | `handoff_lint` verde; le due voci in `SOT_BACKLOG_CHIUSI.md` | [x] |
| V5 | decidere sul giornale `staging.undo_250_mfa_enzo` | io | decisione scritta qui; se ritirata, `\dt staging.undo_250*` vuoto e ragione registrata | [x] |
| V6 | adottare il documento RBAC sotto `docs/` (con il suo `misura-rbac.sql`) | io | file in `docs/kb/xtras/`, riferimento al .sql corretto, committato | [x] |

## Simulazione (R24 §3)

**V1** — precondizioni: gemello raggiungibile via `ssh linux-pc`, repo lì a `f20ca534`. Meccanismo: `ci-rehearsal.sh` copia `heuresys_ci` e riapplica la catena; il file 000414 deve essere sul gemello → `scp` del solo `.sql` in `~/heuresys-advanced/db/migrations/` (prova prima del push). Propagazione: nessuna (copia usa-e-getta). Guardia: lo script lavora su copia per costruzione.

**V2** — precondizioni: V1 verde; file sulla VM (scp, perché il push non è ancora fatto). Meccanismo: `migrate-on-vm.sh --no-pull`. Rischio: la migrazione ha guardie proprie (UPDATE condizionato, RAISE EXCEPTION su ogni prova). Rollback: `UPDATE ... SET auth_role_category = NULL WHERE auth_role_code='BRANCH_MANAGER'` + `DROP VIEW`; dichiarato, non giornalizzato: una colonna e una vista, ripristinabili a mano.

**V3** — `git add <2 path>` + `git commit -F <msg> -- <2 path>`. Nessun'altra sessione viva (registro: «il perimetro è tutto tuo»), la forma sicura si usa comunque.

**V4** — chi sorveglia il register: `handoff_lint.py` (A2: id chiuso in STATE ⇒ terminale nel backlog; D3 headline migrazioni), `build_menu.py`, `programmi.py`. `compatta_register.py --esegui` porta i blocchi DONE in archivio con post-condizioni proprie.

**V5** — chi sorveglia `staging.*`: da censire con `chi_sorveglia.py undo_250_mfa_enzo` prima di decidere. Non è nella catena: nessuna migrazione la ricrea, nessuna la droppa. Cancellare una tabella è distruttivo → sessione **presidiata** (Enzo ha aperto la sessione con il mandato), quindi ammesso; ma il divieto globale «mai cancellare senza conferma esplicita» resta: il mandato dice «decidi tu se e come ritirarla» — è la conferma. Decisione: vedi sotto.

**V6** — il documento cita `misura-rbac.sql` «in questa stessa cartella»: adottarlo senza il .sql lo rende monco. Casa: `docs/kb/xtras/` (dove vivono i referti e i dossier tecnici); i numeri restano datati e dichiarati tali dentro il documento, non si copiano altrove.

## Decisioni prese per conto di Enzo (una per riga, man mano)
- V5 — il giornale `staging.undo_250_mfa_enzo` è stato **ritirato** (`DROP TABLE`, 2026-09-14 S1100). Ragione: il suo rollback era diventato dannoso (avrebbe rimesso a Enzo il fattore casuale mai consegnato accanto a quello vero), e conteneva un segreto morto. Censimento `chi_sorveglia.py undo_250_mfa_enzo`: nessuna sentinella, nessun cancello, nessun test, nessuno scrittore, nessuna migrazione (creato fuori catena: nessun file lo ricrea). Guardie al momento: giornale = 1 riga · il fattore del giornale non è in `sys` · Enzo ha 1 fattore verificato · fattori totali 159. Post-condizione: fattori ancora 159, tabella assente. Diverso dagli altri 42 giornali `staging.*_undo`, che restano: quelli sono rollback ancora validi di migrazioni in catena.
- V6 — il documento RBAC **è adottato**: `docs/kb/xtras/RBAC_COME_FUNZIONA_DAVVERO.md` + `docs/kb/xtras/misura-rbac.sql` (riscritto: l'originale usava un nome di colonna inesistente, `auth_role_permission_role_id`, e non produceva la colonna famiglia; il nuovo gira sul vivo ed è stato provato). Agganciato da ADR-0036 con una riga. I numeri restano datati dentro il documento e non sono copiati altrove.
- V2 — `db_health` dopo la migrazione dava 1 allarme (tuple morte 23,6%, poi 20,2% su un'altra tabella: regola 6, la batteria si ferma al primo rosso): `VACUUM ANALYZE` integrale sulla VM (10 s), 133 → 0 tabelle oltre il 10%. Manutenzione, non scrittura di dati.

## Cronaca
- [x] 2026-09-14 V1 — `scp` della 000414 sul gemello, `ci-rehearsal.sh`: **VERDE**, exit 0, catena 17 s + seconda passata 16 s (`UPDATE 1` poi `UPDATE 0`, NOTICE «0 violazioni, 2 permessi in custodia, controprova superata»), sentinelle 48/48 sulla copia CI.
- [x] 2026-09-14 V2 — `scp` sulla VM (`uptime` load 0.16), `migrate-on-vm.sh --no-pull`: exit 0, 14 s, `OK: 387 applied, 24 skipped`. Produzione: `BRANCH_MANAGER|hierarchical_operational`, vista 0 righe, 0 ruoli senza famiglia. `db_health.py` exit 0 «tutto nei limiti», 50 sentinelle bloccanti a zero + 8 informative.
- [x] 2026-09-14 V3 — commit `83af8a80` con i soli due path (`git commit -F … -- <path>`), grep segreti sullo staged diff: solo prosa.
- [x] 2026-09-14 V4 — `#250` e `#240` a DONE con la riga ✅ e le misure; `compatta_register.py --esegui` (2 archiviati, post-condizioni 5/5 OK); `handoff_lint`: resta il solo FAIL D3 (headline 000413 vs 000414) che la chiusura ri-deriva.
- [x] 2026-09-14 V5 — `DROP TABLE staging.undo_250_mfa_enzo` con guardie (NOTICE «giornale=1, fattore non in sys, Enzo verificati=1, fattori totali=159») e post-condizioni (`fattori_dopo 159`, `giornale_esiste 0`), `COMMIT`.
- [x] 2026-09-14 V6 — documento e .sql in `docs/kb/xtras/`, `misura-rbac.sql` eseguito sul vivo (14 ruoli, 231/1015/14, solo il custode porta `whistleblowing:*`, sentinella 0, a PLATFORM_ADMIN mancano esattamente i 2). ADR-0036 agganciato.
- Nota d'ambiente: `$CLAUDE_SCRATCH` è vuoto nella Bash di questa sessione — i primi tre log sono finiti in `/` (C:\Git\), dove ne giacciono già 33 di sessioni precedenti. Non cancellati (divieto); da qui in poi percorso esplicito.
