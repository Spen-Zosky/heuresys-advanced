# Esiti delle correzioni del controllo forense (15 novembre 2026)

Tutte le ondate sono riunite nel ramo `claude/project-thread-elue8v` (PR #262). Le PR #263 (portale), #264 (amministrazione) e #265 (cruscotti) sono le stesse modifiche, riunite per avere una sola corsa della CI.

## Ondata 1 (Claude, PR #262)

| rilievo | esito |
|---|---|
| S-01 | CORRETTO: `/v1/auth/me` restituisce nome e cognome; intestazione «Cognome, Nome»; test di integrazione confronta col database |
| S-02 | CORRETTO: `SectionTabs` filtra le schede con il registro `/v1/me/interfaces` |
| S-03, S-04 | CORRETTO: comandi offerti solo con `skill_alias:manage` e `approval:decide` |
| S-05 | CORRETTO |
| S-08 | CORRETTO: wrapper dei grafici, tabella equivalente, schede, quadro, cruscotti di famiglia, retribuzioni, pannello agente, voto complessivo |
| D3-04..D3-08, D3-06b | CORRETTO |
| adattatore qa-web | CORRETTO: una sessione per persona, attesa su 429 |

## Ondata 2: portale personale (ramo `claude/forense-portale`)

CORRETTI: D2-01, 02, 03, 04, 05, 07, 11, 12, 13, 14 (seed e migrazione 000492 con giornale `staging.approvazioni_italiano_undo`), 15, 23, 24, 26. CORRETTI IN PARTE: D2-06 (ruolo di capo squadra; squadre disallineate = dato), D2-08 (pagina; dato no), D2-10 (vocabolari mancanti per fascia paga e area), D2-16, D2-17, D2-18, D2-21. NON CORRETTI: D2-09, D2-19, D2-20 (pagina nuova), D2-22, D2-25 (dato). Test nuovo `me-forense-portale.integration.test.ts`, 7/7.

## Ondata 3: amministrazione e sorgente (ramo `claude/forense-amministrazione`)

CORRETTI: D3-02, 09, 12, 13 (filtro; i residui restano nel dato), 14, 16, 20, 21, 23; S-06, S-07, S-09, S-11. IN PARTE: S-10 (nome dell'asse dei valori derivato dalla serie; unità non dichiarate pagina per pagina). NON CORRETTI: D3-15, D3-17 (dato o decisione di prodotto). S-12, S-13, S-14 non toccati (architettura).

## Ondata 4: cruscotti e analisi (ramo `claude/forense-cruscotti`)

CORRETTI: D1, D2, D3 (con perimetro, mascheramento e soglia di anonimato per orizzonte dopo la revisione di sicurezza), D4, D5, D6, D7, D8 (migrazione 000493: il CEO legge cruscotti, analisi, talenti, obiettivi, OKR, valutazioni), D9, D10, D11, D14, D16. IN PARTE: D12 (dato alla fonte), D13, D15 (dato), D17. NON CORRETTI: D18, D19, D20 (dato o scelta di progetto), D21 (organigrammi, altro thread).

## Dati da decidere con Enzo (nessuna scrittura fatta)

| rilievo | che cosa | misura (sola lettura) |
|---|---|---|
| D3-13 | 142 documenti su 152 sono residui di prova («[me-media-it] ESS media doc», «[media-it] media host») | `select count(*) from sys.sys_documents where document_title like '[me-media-it]%' or document_title like '[media-it]%'` (nome colonna da verificare) |
| D2 / D3 | 27 approvazioni PENDING «Fascicolo E2E-FASCICOLO-…» intestate a Enzo Spenuso | `select count(*) from sys.sys_approval_requests where approval_request_title like 'Fascicolo E2E-FASCICOLO-%' and approval_request_status='PENDING'` |
| D3-03 | 10 richieste di assenza «In attesa» ferme dal 2025-2026 senza approvazione | `select count(*) from sys.sys_time_off_requests r left join sys.sys_approval_requests a on a.approval_request_resource_id=r.request_id where r.request_status='PENDING' and a.approval_request_id is null` |
| D3-12 | 9 utenze di servizio «Collaudo …» nel tenant RTL Bank | `select count(*) from sys.sys_users where user_type='SERVICE'` |
| D2-06 | squadre non riallineate alla riorganizzazione del 04/08/2026 | `dati-2.md` D2-06 |
| D2-08, D2-09, D2-22 | fine contratto non azzerata, cedolino contro RAL, anagrafica | `dati-2.md` |
| D3-10, D3-11, D3-17, D1-D12 | cataloghi doppi, nomi e descrizioni con codici di corsa o in inglese | `dati-1.md`, `dati-3.md` |
