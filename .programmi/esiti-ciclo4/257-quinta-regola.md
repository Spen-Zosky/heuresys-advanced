# Esito #257 (seguito) — la quinta famiglia, USO-PRODOTTO

**Stato: FATTO.** Register: `docs/kb/SOT_BACKLOG.md` #257 (voce già DONE, ampliata).

## La decisione di Enzo

Dentro la quota DECISIONE (187 voci) c'erano 44 tabelle mai popolate che sembravano riempirsi
usando il prodotto (es. `sys_okrs`, `sys_surveys`), mescolate con 143 colonne facoltative morte.
Enzo ha chiesto una quinta regola meccanica per separarle.

## La regola

`_tabelle_uso_prodotto()` in `chi_ripara.py`: per ogni modulo API, se il suo `routes.ts` registra
almeno una rotta `app.post`/`app.put` E il suo `repository.ts` ha un `INSERT INTO sys.sys_x`
reale, la tabella `x` entra nella famiglia ⑤ USO-PRODOTTO quando è vuota per un tenant
(`fonte == completezza_tenant`). Le due condizioni insieme, non una sola: un `INSERT` nel codice
senza una rotta che lo raggiunga non è usabile dal prodotto — la stessa lezione di `#262`
(leggere il codice non basta, serve la porta).

Piazzata nell'ordine delle regole PRIMA di `tabella-di-persona-vuota`: una tabella come `sys_okrs`
ha un soggetto persona (`owner_user_id`) ma non è bloccata da M6 — si crea da sé, in
autoservizio, quindi vince USO-PRODOTTO su CLIENTE quando entrambe si applicherebbero.

## Misura dal vivo

Prima: DERIVABILE 139 · RICERCA 1 · CLIENTE 63 · DECISIONE 187 (totale 390).
Dopo: DERIVABILE 139 · RICERCA 1 · CLIENTE 40 · **USO-PRODOTTO 49** · DECISIONE 161 (totale 390).

49 tabelle spostate: 23 da CLIENTE, 26 da DECISIONE. `--verifica-fonti`: le tre fonti
ri-misurate indipendentemente tornano ancora a 390 — la nuova regola non ha toccato la misura,
solo la classificazione.

## Rosso poi verde

`--selftest`: aggiunto un 5° caso reale, `sys_okrs` (verificato: `okrs/routes.ts` ha
`app.post("/", ...)`, `okrs/repository.ts` ha `INSERT INTO sys.sys_okrs`). Atteso e ottenuto:
USO-PRODOTTO/`uso-prodotto`. Sabotaggio manuale (regola tolta dalla lista): `sys_okrs` ricade in
DECISIONE/`nessuna-regola` — la prova che la regola, non un fallback, è responsabile dell'esito.

## Verifica finale

`session_start.py` (con e senza `--no-db`): riga aggiornata, nessun crash. `check_marciume.py`:
«niente e' marcito».
