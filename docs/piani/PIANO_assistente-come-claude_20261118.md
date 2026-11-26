# Piano — l'assistente di pagina: permessi della persona e finestra come Claude (2026-11-18)

Richiesta di Enzo (thread «Heuresys PaaS/SaaS management», 2026-11-18 02:12 UTC): l'assistente non ha i permessi per rispondere; la finestra va rifatta come Claude Desktop (ampia, ridimensionabile, Nuova conversazione, risposta formattata, niente dati tecnici, contenuti ispezionabili in una finestra modale ridimensionabile); i dati che la persona non può vedere diventano {omissis}; una domanda tutta su dati vietati riceve «Non hai le autorizzazioni necessarie per la gestione di queste informazioni. Puoi inviare una richiesta all'Amministratore del Sistema».

## Diagnosi (misurata sul codice)

- `apps/api/src/modules/agent-tokens/routes.ts` (`ruoliPerAgente`) toglie al gettone d'agente ogni ruolo di `MANDATE_ROLES` (ADR-0050 D6). Una persona con mandato (HRMS_MANAGER, TENANT_ADMIN, PEOPLE_MANAGER…) nell'assistente perde il perimetro del tenant: è la causa di «non ha i permessi».
- La copertura delle letture non è la causa: `docs/kb/tools/build_agent_operations.py` apre già in sola lettura ogni modulo con una GET (#254), salvo `FUORI_DALLE_LETTURE`. Misura: `python3 -c "import json;d=json.load(open('docs/kb/atlas/agent-operations.json'));print(len(d['concepts']))"`.
- Il gateway non dà al modello nessuna istruzione di sistema (`apps/agent-gateway/src/sdk-agent.ts`): niente lingua, formato, regola sui dati mascherati.
- La finestra (`apps/web/src/components/pannello-agente.tsx`) mostra i nomi degli strumenti e la colonna «Letture»; le risposte sono testo semplice.

## Scelta proposta a Enzo (cmsg_01FMWxNibmDwSNyptL3ETuJq9Sre444ZwHDk4P3p15EqiH)

In lettura il gettone porta il perimetro pieno della persona (mandato compreso); in scrittura resta senza mandato e con il ponte di approvazione. Ciò che la persona non vede non arriva al modello: i campi mascherati dall'API diventano {omissis}; le letture negate (403) diventano un esito NON_AUTORIZZATO, e se in un giro tutte le letture sono negate la risposta è il messaggio fisso, deciso dal gateway. Scartato «il modello legge tutto e poi filtra»: un filtro sul testo libero non regge una parafrasi.

## Voci

| id | cosa | file e comandi | chi | fatta quando | stato |
|---|---|---|---|---|---|
| V1 | gettone d'agente: ruoli pieni per GET/HEAD, ruoli senza mandato per le scritture | `apps/api/src/modules/agent-tokens/routes.ts`, `apps/api/src/middleware/auth.ts`, test `apps/api/test/*agent-token*` | Claude | test rosso prima e verde dopo | da fare · nel codice: `ruoliDiLetturaPerAgente` in `apps/api/src/modules/agent-tokens/routes.ts` (riesame Z4 del 2026-11-26, `docs/piani/ai-driven_20261126/RIESAME_programmi.md`); la dimostrazione dal vivo non è stata riletta |
| V2 | {omissis} e NON_AUTORIZZATO nel gateway; rifiuto deterministico | `apps/agent-gateway/src/heuresys-client.ts`, `omissis.ts`, `server.ts`; `pnpm --filter @heuresys/agent-gateway test` | Claude | test verdi | da fare · nel codice: `apps/agent-gateway/src/omissis.ts` (riesame Z4 del 2026-11-26, `docs/piani/ai-driven_20261126/RIESAME_programmi.md`); la dimostrazione dal vivo non è stata riletta |
| V3 | istruzioni di sistema dell'assistente (italiano, markdown, niente tecnicismi, {omissis}) | `apps/agent-gateway/src/istruzioni.ts`, `sdk-agent.ts` | Claude | test verdi | da fare · nel codice: `apps/agent-gateway/src/istruzioni.ts` (riesame Z4 del 2026-11-26, `docs/piani/ai-driven_20261126/RIESAME_programmi.md`); la dimostrazione dal vivo non è stata riletta |
| V4 | finestra nuova: ampia e ridimensionabile, massimizza, Nuova conversazione, storico, conversazione a bolle, risposta markdown, attesa animata senza nomi di strumenti, ispezione in modale ridimensionabile (tabelle con copia e CSV, codice) | `apps/web/src/components/assistente/*`, `pannello-agente.tsx`, `lib/use-agent-stream.ts`, locali it/en | Claude | typecheck, vitest, E2E `approvals-agent-detail.spec.ts` | da fare · assorbita in F6c del piano Heuresys AI-driven (riesame Z4 del 2026-11-26, `docs/piani/ai-driven_20261126/RIESAME_programmi.md`); questa riga resta la fonte del dettaglio |
| V5 | ADR-0050: emendamento di D6 sulle letture | `docs/architecture/adr/0050_*.md` | Claude dopo il sì di Enzo | testo nel repo | in attesa del sì |
| V6 | PR, CI verde, unione | GitHub | Claude | CI verde | da fare |
| V7 | rilascio e verifica | `bash scripts/rilascia.sh <sha>`, `scripts/verifica-deploy.sh` | Claude, turno dal coordinatore | DEPLOYATO | da fare · assorbita in F0a del piano Heuresys AI-driven (riesame Z4 del 2026-11-26, `docs/piani/ai-driven_20261126/RIESAME_programmi.md`); questa riga resta la fonte del dettaglio |
| V8 | prova dal vivo come Valentina Conti | browser | Enzo (secondo fattore suo) | domanda risposta con dati e {omissis} | fuori da questa sessione |

## Simulazione

- V1: precondizione `persona.roles` nel JWT; `req.user.roles` si sceglie per metodo nel middleware, così `requirePermission` e il resolver del perimetro leggono i ruoli giusti senza toccare ogni rotta. Guardia: un gettone senza il claim nuovo si comporta come oggi (fallisce chiuso sulle letture con mandato).
- V2: le risposte dell'API restano la sola fonte; il gateway aggiunge segnaposto, non dati.
- V7: rilascio con delega permanente, un rilascio armato alla volta (coordinatore).

## Fuori da questa sessione

- V8: la prova con l'utenza di Valentina Conti richiede il suo secondo fattore.
