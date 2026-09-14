# S1101 — mandato «riallineamento consolidato dopo il censimento del 2026-09-14»

*Mandato scritto da Cowork in `C:\Users\enzospenuso\Claude Desktop\heuresys-advanced\sessioni\session_2026-09-14_decisioni-250-240\MANDATO_S1101_riallineamento-consolidato.md`; contesto nei tre documenti accanto (`ANALISI_…`, `CENSIMENTO_R2_…`, `PIANO_riallineamento_…`) e nella voce «2026-09-14 (sera)» di `docs/kb/COWORK_INBOX.md`, non ancora committata all'apertura.*

> **stato**: CHIUSO
> **chiuso**: 2026-09-14 — 11 voci fatte su 11, non resta niente
> **registro di sessione** — cronaca di ciò che si fa, non il programma di una voce: non
> dichiara `item` di proposito (D-92).

**Misura all'apertura** (`guardiano.py`): contesto **11.6%** · finestra 5h **36.0%** ·
verdetto testuale: `✓ si continua — contesto: mancano 634,402 token · 5h: mancano 44.0 punti`.

**Confine di sessione dichiarato (R24 §4).** Undici voci. Le nove di scrittura (register, ADR,
CLAUDE.md, stato) sono leggere (~15k ciascuna); B2 è uno strumento con autoprova (~60k). Totale
stimato ~200k su 634k residui: **ci stanno tutte**. Nessuna richiede Enzo, salvo il push
(autorizzazione session-scoped: chiedo a fine ciclo).

**Ordine di priorità del mandato, che seguo**: A1 → B2 → B1 → A2 → A3 → A5 → C1.

**Fuori dal mandato per natura** (R24 §5, una volta sola): la skill di due diligence in
`~/.claude/skills/` (A6: **fuori perimetro, affidata a Cowork**) · le contraddizioni nelle
istruzioni globali (`~/.claude/CLAUDE.md`: R1 del piano, è di Enzo) · `cowork_code_exchange/`
e `cowork_reserved/` (archivio: non si toccano) · i file di Codex (attesi, non si portano) ·
`.programmi/_zp_verify_tmp/` (non mio).

---

## Le voci

| id | cosa | chi | fatto quando | stato |
|---|---|---|---|---|
| V1 | **A1.0** — fattibilità: (a) persone distinte ricavabili dalle risposte senza toccare l'API? (b) dove vive lo stato per conversazione? | io | esito scritto nell'ADR §«Fattibilità misurata» e nei piani di `#251`/`#253` | [x] |
| V2 | **A1.1** — ADR-0040 che recepisce la dottrina ratificata; rimando in ADR-0033 | io | file in `docs/architecture/adr/`, soglie come valori iniziali + criterio + comando; sentinella whistleblowing citata come cancello | [x] |
| V3 | **A1.2** — tre voci ACTIVE nel register: `#251` contatore · `#252` ponte sulle letture · `#253` diario interrogabile; un piano `.programmi/` per ciascuna | io | `handoff_lint` verde (T2: ogni ACTIVE ha il piano); M7 nominata dentro, non a parte (A4) | [x] |
| V4 | **A1.3** — `#254` apertura di tutti i perimetri, GATED su #251/#252/#253 | io | blocco con `blocker` + `unblock-trigger` | [x] |
| V5 | **A1.4** — `#214` in HOLD con `hold-reason`, `decided-by: Enzo`, `hold-since`, `reactivation-trigger` | io | H1 verde; il blocco dice che `agent-perimetri.json` non si butta | [x] |
| V6 | **B2** — `check_canale_cowork.py`: voci dell'INBOX senza `[RICONCILIATA …]` e giorni dalla più vecchia; `--selftest` a esiti opposti; riga nella dashboard di avvio | io | selftest verde; su canale allineato dice 0; `session_start.py` lo stampa | [x] |
| V7 | **B1** — il canale Cowork↔CLI dichiarato in un punto solo del CLAUDE.md | io | sezione nuova, `check_istruzioni` verde | [x] |
| V8 | **A2** — `#255` ACTIVE: rivalidare la scorecard su HEAD, aggiornare i tre documenti | io | blocco + piano; nomina i tre file e lo strumento; il 58/100 citato come precedente datato, non copiato nei file | [x] |
| V9 | **A3** — `#256` ACTIVE: il cancello meccanico sull'isolamento fra clienti | io | blocco + piano, **con lo scopo corretto dalla misura** (vedi Decisioni) | [x] |
| V10 | **A5** — `#257` WAIT-INPUT: il registro di chi ripara e chi popola | io | `input-richiesto` + `perche-solo-tuo` | [x] |
| V11 | **C1** — riconciliare le voci INBOX (marcatori), ri-derivare `.handoff/STATE.md` e `SOT_STATE.md`, commit con i percorsi | io | `handoff_lint` 0 FAIL; `session_start.py` mostra le voci nuove e la riga del canale a zero | [x] |

## Simulazione (R24 §3)

**V1** — precondizioni: gateway leggibile (sì). Meccanismo: lettura di `server.ts`/`sdk-agent.ts`/`mcp-tools.ts`/`audit-sink.ts` + conteggio dei nomi di campo `*UserId` in `packages/shared/src/schemas`. Esito: **misurato, sotto**.

**V2** — chi sorveglia `docs/architecture/adr/`: `check_istruzioni.py` (istruzioni), nessuna migrazione. Il numero: 0039 è l'ultimo → **0040**. ⚠ Il mandato dice «supersede ADR-0033 §5.2»: **misurato**, §5.2 è il gate HITL sulle scritture (resta intatto), la parte sui perimetri è **§6.1** (la coda per rischio crescente, `check_concetti_agente.py`). L'ADR nuovo lo dichiara.

**V3-V5, V8-V10** — chi sorveglia il register: `handoff_lint.py` (S2 vocabolario, S4 id unico, S5 riga lasca, H1 campi HOLD/WAIT, T1 titolo senza avanzamento, T2 piano per ogni ACTIVE, T3 priority pulita), `build_menu.py`, `programmi.py --verifica` (fase spuntata senza evidenza = rosso). Id liberi: **#251-#257** (grep su kb/archive/programmi: nessun riscontro). Guardia: `handoff_lint` prima del commit.

**V6** — chi sorveglia: `session_start.py` (lo importa), `check_istruzioni.py` (se cito il tool nelle istruzioni). Meccanismo: le voci dell'INBOX sono intestazioni `##`/`###` che aprono con una data (anche dopo `[COWORK → CLI] `); riconciliata = porta una riga `stato: [RICONCILIATA …]` (protocollo scritto in testa al file dal 2026-06). Prova del criterio sul file com'è oggi: le voci del 2026-08-08 (`gov`, plance) e le cinque del 2026-09-14 non hanno marcatore → la più vecchia è dell'8 agosto → **37 giorni**, il numero dell'analisi. Selftest: file finto allineato → 0; file finto con voce vecchia → N giorni; controprova che un marcatore fuori posto non conta.

**V7** — chi sorveglia `CLAUDE.md`: `check_istruzioni.py`, `handoff_lint` no. Il punto: subito dopo «Chi può scrivere la SoT di stato» in §Source of Truth.

**V11** — `git add <path>` + `git commit -F <msg> -- <path>` (nessun'altra sessione viva, forma sicura comunque). Grep segreti sullo staged diff. Push: chiedo.

## Decisioni prese per conto di Enzo (una per riga, man mano)

- **V1 (A1.0), esito misurato il 2026-09-14** — **(a) SÌ**, le persone distinte si ricavano dalle risposte senza toccare l'API: ogni lettura passa da `HeuresysClient.call` e la risposta è JSON conforme agli schemi condivisi, dove l'identificativo di persona compare sotto una **famiglia chiusa di nomi** che finiscono in `UserId` (26 nomi distinti in `packages/shared/src/schemas`, `userId` 68 volte, poi `subjectUserId` 22, `ownerUserId` 20, …). Un solo aggancio, in `call`, raccoglie gli UUID sotto quei nomi. ⚠ Con **un'esclusione da dichiarare**: gli attori di audit (`createdByUserId`, `reviewedByUserId`, `performedByUserId`, `cancelledByUserId`, `publishedByUserId`, `actorUserId`) non sono soggetti — è lo stesso criterio di S1078 («se contassero, ogni tabella sarebbe dati di persona»). **(b) Lo stato vive nella richiesta, e non serve infrastruttura**: una conversazione = una `POST /agent` = una `runHrAgent` = una `query()` dell'SDK **senza `resume`**; il client web manda solo `{prompt}`; `HeuresysClient`, il server MCP e `canUseTool` nascono per richiesta. Un contatore in chiusura dentro `runHrAgent` copre esattamente ciò che oggi esiste. Limite dichiarato: se un giorno il web riprende una conversazione (`resume`), il contatore deve seguire quell'id. **(c) Un terzo punto che il documento non chiedeva e che ALLUNGA il piano**: il passo 3 («vista SQL sul diario, raccolta da `db_health`») presuppone il diario nel database, e **non c'è**: `FileAuditSink` scrive un JSONL (`.data/agent-audit.jsonl`, sulla VM 242 righe, ultima 2026-09-13), senza tabella e **senza identificativo di conversazione** nella voce. Il seam esiste (`AuditSink`), quindi il costo è: un `runId` nella voce + un `DbAuditSink` + una migrazione con tabella e vista. È scritto nel piano di `#253`.
- **V2 — soglie**: 25/40 restano i **valori iniziali ratificati**. Misurato il 2026-09-14 con `docs/kb/xtras/soglie-agente-persone-distinte.sql` (RTL Bank): posizioni per unità max **38** (p90 12,4 — la misura della dottrina); **persone con incarico attivo** per unità max **9** (p90 8); persone per **catena** (sottoalbero) max **158**, p90 **21,4**, **4 catene** sopra 25 e le stesse 4 sopra 40. Il criterio «silenzioso copre l'unità più grande, conferma appena sopra» vale quindi su qualunque unità; sulle catene scatta ai quattro vertici. Non decido io quale delle tre misure debba generare i valori: l'ADR le scrive tutte e tre, datate, col comando accanto.
- **V9 (A3) — la premessa del censimento è smentita dalla misura**: M5 **è già fatta** — B23 del bundle del 2026-09-09, commit `6522c132` (2026-09-10, S1095): `tenantGate` in `apps/api/src/lib/scope/gate.ts` impedisce l'avvio a una rotta sensibile senza dichiarazione (`TENANT_GATE_MISSING`), e B1 (sentinella sui 352 punti, mig `000386`) è fatta con lei. Il censimento cercava nel register e nei debiti, dove non c'è — ma il codice sì. Quindi `#256` **non apre la costruzione di M5**: apre il **confine dichiarato** da B23 (copre le rotte già governate da `orgGate`, non tutta la superficie), come indagine P3. La lista si accorcia.
- **V6 — definizione della misura**: «riconciliata» = porta il marcatore `stato: [RICONCILIATA …]` che il protocollo in testa all'INBOX prescrive dal 2026-06. Non «committata»: S1100 ha riconciliato le voci del 2026-09-14 (V1-V6 del suo piano) e le ha committate, ma senza marcatore — il commit non dice se la voce è stata letta. Soglia: nessuna (mandato). Il numero si stampa.

## Cronaca
- [x] 2026-09-14 V1 — fattibilità misurata (ADR-0040 §4): (a) sì, 26 nomi `*UserId`; (b) stato nella richiesta, `query()` senza `resume`; (c) diario su file JSONL (VM: 242 righe) senza id di conversazione — allunga `#253`.
- [x] 2026-09-14 V2 — `docs/architecture/adr/0040_l_agente_legge_cio_che_legge_la_persona.md`; rimando in ADR-0033 dopo §6.1; misure delle soglie in `docs/kb/xtras/soglie-agente-persone-distinte.sql` (eseguito sul vivo: 38 · 9 · 158).
- [x] 2026-09-14 V3-V5, V8-V10 — blocchi `#251`-`#257` e `#214` HOLD; `handoff_lint` **0 FAIL** (T2 rosso finché mancavano i cinque piani, poi verde); `programmi --verifica` nessun difetto; `build_menu` mostra le sette voci.
- [x] 2026-09-14 V6 — `check_canale_cowork.py`: `--selftest` 7/7 verde; sul file vero **7 voci, 107 giorni** (la più vecchia: 2026-05-30, la cui (b) era decisa da S999); dopo i marcatori **0**; riga in `session_start.py` (provata con `--no-db`); instradato in `verify_gate.py` (router selftest 10 casi verde).
- [x] 2026-09-14 V7 — sezione «Il canale Cowork ↔ CLI» nel CLAUDE.md §Source of Truth; `check_istruzioni` nessun rilievo.
- [x] 2026-09-14 V11 — marcatori sulle 7 voci INBOX; Delta S1101 in `SOT_STATE.md`; `.handoff/STATE.md` riscritto; `verify_gate.py run` **GREEN** (handoff-lint, programmi, canale-cowork-selftest, router-selftest; typecheck e lint riusati verdi).
- Nota: entrambe le skill `cowork-cli-protocol` e `cowork-cli-orchestrator` esistono in `~/.claude/skills/` — la «seconda contraddizione» dell'analisi era in parte sbagliata; la prima (regola globale) resta ed è di Enzo.
