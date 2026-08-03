# Esecuzione della consegna dalla sessione lab — piano R24

**Aperto**: 2026-08-03 (S1042, sessione canonica) · **Fonte**: `<padre del repo>/heuresys-design-lab/CONSEGNA-ALLA-SESSIONE-CANONICA.md`
**Mandato di Enzo**: «leggi la consegna ed eseguila».

## Confine di sessione (dichiarato all'inizio, R24 §4)

Le voci **V0→V5** sono completabili in questa sessione. La voce **V6 (#92 ciclo di valutazione)** è
stimata dal lab in **~2-3 sessioni** e ha 7 passi con commit atomici separati: **non si chiude qui**.
Se il contesto regge dopo V5, si aprono i suoi primi passi (migrazione DDL + ingestione) e il resto
resta a register con `resume-from`.

## Tabella del piano

| id | cosa | chi | fatto = | stato |
|---|---|---|---|---|
| V0 | 5 blocchi #89-#93 nell'Action register | Claude | `handoff_lint.py` verde + i 5 item compaiono in `build_menu.py` | **FATTO** |
| V1 | #90 cruscotto: promuovere 3 script + cablare in `session_start.py` | Claude | `python docs/kb/tools/db_health.py` gira dal repo e l'esito compare al boot | **FATTO** |
| V2 | #93 rimozione validazione presenze | Claude | mig `000234` applicata, 5 file `db/` ripuliti, riesecuzione seed verde | **FATTO** |
| V3 | #89 bonifica contaminazione, 7 fasi | Claude | query di censimento a zero per classe + F7 verificato con login reale | **FATTO tranne la prova live di F7** (deploy da autorizzare) |
| V4 | #91 bonifica strutturale blocchi A, C, D | Claude | `db_health.py` non segnala più «vincoli FK non validati» né «tabelle mai analizzate» | **FATTO** |
| V5 | #91 blocco E (UNIQUE) — dopo V3 | Claude | i 3 `ALTER TABLE … UNIQUE` passano, duplicati a 0 nel cruscotto | **FATTO** |
| V6 | #92 ciclo di valutazione (7 passi) | Claude | dichiarata fuori sessione all'apertura (~2-3 sessioni) | **NON INIZIATA** — come dichiarato |

## Simulazione a 5 domande (R24 §3) — findings prima di eseguire

### V0 — blocchi nel register
- **Precondizioni**: `SOT_BACKLOG.md` ha l'Action register alla riga 6, il canonical item store alla 8;
  ultimo id usato = **#88** → #89-#93 sono liberi. ✔ verificato
- **Meccanismo**: `handoff_lint.py` (10 check bloccanti) valida il formato; `build_menu.py` genera il menu.
  Il formato richiesto è `- **#<id> <titolo>** · status: <…>` + campi indentati.
- **Propagazione**: file versionato, arriva ai cloni col normale `git pull`.
- **Chi**: Claude.
- **Guardia**: non distruttiva (append). Il lint è la guardia: se il formato è sbagliato, fallisce.

### V1 — cruscotto
- **Precondizioni**: `docs/kb/tools/` esiste, `session_start.py` importa i tool **in-process**
  (`import build_menu`) → il nome del file deve essere un **identificatore Python valido**.
  `db-health.py` con il trattino **non è importabile**. ✔ verificato leggendo `session_start.py:33-34`
- **Meccanismo**: rinomina in `db_health.py`, `exposure_columns.py`, `dead_columns.py`;
  chiamata a `db_health.main()` in modalità `--sentinelle` dopo `status_dashboard.main()`.
  Attenzione: `db_health.main()` ritorna 1 sugli allarmi, ma `session_start` è una **vista**, non un
  gate → l'esito si stampa, non fa uscire con errore.
- **Propagazione**: repo → cloni via `git pull`. Nessun artefatto fuori dal repo.
- **Chi**: Claude.
- **Guardia**: read-only puro (solo `SELECT` sul catalogo). Non serve guard.

### V2 — rimozione validazione presenze
- **Precondizioni**: le 3 colonne devono essere ancora vuote **adesso** (il lab ha misurato ieri);
  `000234` libero. → **da rimisurare prima del DROP**. ✔ rimisurato: 116.639 righe, 0 non-NULL su tutte e tre.
- **Meccanismo**: migrazione SQL + `db:migrate`. I 5 file `db/` che citano le colonne vanno corretti
  nello stesso commit, altrimenti il prossimo `db:reset` fallisce.
- **CORREZIONE IN CORSO D'OPERA**: avevo deciso di non toccare `000040` perché è storia già applicata.
  Sbagliato **in questo progetto**: `migrate.sh` riesegue l'**intero set** a ogni `db:migrate` (è così
  che si dimostra l'idempotenza dichiarata), quindi una migrazione a monte che ricrea un CHECK, una FK
  e un indice parziale su una colonna rimossa a valle **interrompe l'intera catena**. Misurato, non
  supposto: il primo `db:migrate` dopo la 000234 è fallito con
  `ERROR: column "attendance_is_validated" does not exist` su `000040:402`. `000040` è stata resa
  tollerante (i tre blocchi si applicano solo se la colonna esiste): su un database vergine si comporta
  esattamente come prima, su uno bonificato diventa un no-op. `migrate.sh` fa upsert sullo sha256, non
  c'è un controllo di drift che la modifica violi.
- **Propagazione**: la migrazione gira sui cloni al deploy; i seed corretti sono versionati.
- **Chi**: Claude.
- **Guardia**: `DROP COLUMN` è **distruttivo e irreversibile**. Guard = conteggio dei non-NULL prima
  del drop; se ≠ 0 si ferma. Un guard che passa su tabella vuota non è un guard: qui la tabella ha
  116.639 righe, quindi il conteggio è significativo.

### V3 — bonifica contaminazione
- **Precondizioni**: i conteggi del lab (2026-08-02) vanno **ri-misurati**: il DB è vivo.
  L'impatto FK misurato (0 riferimenti utente) è la ragione per cui il `DELETE` è sicuro → **da ri-verificare**.
- **Meccanismo**: uno script di audit idempotente (F1) che è **anche** la guardia anti-regressione,
  poi `DELETE` in transazione per classe, con conteggi before/after.
- **Propagazione**: sono dati, non codice: la modifica è sul DB di produzione (unico ambiente, ADR-0026).
  I cloni DB si riallineano col dump notturno.
- **Chi**: Claude.
- **Guardia**: ogni `DELETE` preceduto dal conteggio dei riferimenti in ingresso; se > 0, stop.
  Le classi F (ESCO/ATECO) sono falsi positivi: escluse per costruzione dalle query, non per promemoria.

### V4/V5 — bonifica strutturale
- **Precondizioni**: V5 richiede che V3 sia chiusa (i `UNIQUE` oggi fallirebbero su 1.373 duplicati).
- **SCOPERTA che cambia V5**: i 1.373 duplicati non erano tutti contaminazione. Scomposti per origine:
  1.284 chiavi-macchina `OLDDB::`, 30 percorsi `CRS-` di tenant inesistenti (entrambi rimossi dalla
  bonifica) e **59 copie esatte** — stesso codice, stesso tenant, stesso nome — che la bonifica non
  tocca. Il piano del lab le dava per copie inerti; **hanno invece 199 assegnazioni a persone reali**.
  Misurate le due copie separatamente: la più vecchia porta 63 step e tutte e 199 le assegnazioni, la
  più recente 61 step e **zero** assegnazioni. Quindi si rimuove la recente e non si ripunta nulla —
  se il rapporto fosse stato inverso avrebbe richiesto un re-pointing con gestione delle collisioni.
- **Il sigillo `UNIQUE` copre 2 tabelle su 3**: `sys_skills` conserva 2 codici duplicati su 14.041,
  referenziati da 12 FK in 11 tabelle. Il loro dedup è un work-item a sé; il vincolo non è stato
  applicato lì e la migrazione lo dichiara invece di ometterlo in silenzio.
- **Meccanismo**: `psql` senza `-1` per il blocco A (`CREATE INDEX CONCURRENTLY` non gira in transazione).
- **Propagazione**: gli indici vanno anche nelle migrazioni versionate, altrimenti un `db:reset` li perde.
  **Questo il doc del lab non lo dice**: lo aggiungo io come migrazione.
- **Chi**: Claude.
- **Guardia**: `CREATE INDEX` è additivo; `VALIDATE CONSTRAINT` fallisce da solo se ci sono orfani.

### V6 — ciclo di valutazione
- **Precondizioni**: le 35+20+40 righe di calibrazione legacy devono essere ancora leggibili sulla VM.
- **Meccanismo**: pattern in 7 passi del progetto, commit atomico per fase.
- **Propagazione**: migrazione + codice, entrambi versionati.
- **Chi**: Claude.
- **Guardia**: non distruttiva (tabelle nuove).

## Verifiche eseguite

| Verifica | Esito |
|---|---|
| `check_tenant_contamination.py` (11 classi) | **0 residuo** (era 6.746) |
| `db_health.py` (14 sentinelle + 14 sonde) | **tutto nei limiti** (erano 5 allarmi) |
| `pnpm db:migrate:sh` — set completo rieseguito | **237 file, 235→237 applicate, 0 errori** |
| `pnpm i18n:check` | **parità OK**, 2917 chiavi × 2 locali × 10 namespace |
| `pnpm typecheck` · `pnpm lint` | **verdi** |
| `handoff_lint.py` | **OK** (0 fail) |
| suite unit API | **10 file / 67 test verdi** |
| suite integration API | in corso a fine sessione — nessun fallimento fino all'interruzione del monitoraggio |
| prova live F7 con login reale | **non fatta** — richiede il deploy, da autorizzare |

## Registro delle scoperte fuori ciclo (R24 §5)

Le voci scoperte durante l'esecuzione vanno **qui**, non in «cosa resta».

- **`attendance_source_reference`** — sempre NULL, esclusa di proposito dalla decisione 2 (è tracciabilità
  di provenienza, non validazione). Decisione separata, non in questo ciclo.
- **121 colonne «lacuna di popolamento»** (`artefatti/colonne-morte.json`) — il codice le conosce, il DB no.
  Materiale per un ciclo futuro.
- **Matrice ESCO occupazione↔competenza** (126.051 righe, oggi solo un `count(*)`) — LINEA 3.2 del lab,
  non inclusa nella consegna: non è nei 5 blocchi.
- **`sys_operating_model_catalog`, voce MANUFACTURING** — borderline, il lab chiedeva una decisione.
  Trattata dentro V3-F5 col vaglio voce-per-voce.
- **Nomi propri di persone reali nei dati di calibrazione legacy** — l'ingestione V6-passo-2 li porta
  in advanced: è dato di produzione, trattato come tale (ADR-0026).
- **Corsi food/energy con codice di dominio** — i 59 percorsi duplicati sono `ALLERG-001` (allergeni),
  `BRC-001` / `FSSC22000-001` (sicurezza alimentare), `BLDG-EE-001` / `EE-AUDIT-001` / `ESG-ENERGY-001`
  (efficienza energetica): stesso dominio di SmartFood ed EcoNova, ma **senza slug di tenant nel
  codice**, quindi fuori dal criterio di taglio della bonifica. Qui è stata rimossa solo la
  **duplicazione** (che serviva al sigillo `UNIQUE`), non il materiale: 59 corsi restano, con 199
  assegnazioni a persone di RTL Bank. Se siano da rimuovere per provenienza è una domanda diversa —
  e va posta sapendo che oggi 199 assegnazioni reali ci puntano.
- **2 skill con codice duplicato** (`COMP::02c2f3c8…`, `COMP::7780f0ba…`) su 14.041 — 12 FK da 11
  tabelle. Blocca il terzo `UNIQUE` del sigillo.
