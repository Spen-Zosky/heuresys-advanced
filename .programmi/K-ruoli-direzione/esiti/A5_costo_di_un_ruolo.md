# A5 — Quanto costa davvero una voce di ruolo (prima misura, S1105)

Misura sulla prima voce di ruolo della Parte B: R-9 (PLATFORM_OPERATOR e SALES).

## Il numero

Guardiano misurato subito prima di aprire R-9: **502.218 token (50,2%)**.
Guardiano misurato alla chiusura di R-9 (dopo la prova generale finale VERDE): **599.676 token (60,0%)**.

**Costo netto: ~97.500 token, pari a ~9,8 punti percentuali della finestra da 1.000.000.**

## Che cosa include questo costo

R-9 non è stata una voce lineare: oltre alla migrazione, il codice e i test previsti dalla
ricetta, ha richiesto un pezzo di indagine non preventivato dal mandato — scoprire che
`GET /v1/notifications/broadcasts` condivideva il permesso col `POST` di invio, e che il
filtro di R-0 andava esteso al modulo `notifications` (letto `service.ts`/`repository.ts`,
riscritto per usare `perimetroClienti`) — più **tre correzioni trovate dalla prova generale
stessa**: la baseline del cricchetto S-5, l'headline di `SOT_STATE.md`, e due invarianti RBAC
storiche (`rbac-tenant-admin-allowlist`, `rbac-delete-permissions`) che il mio grant nuovo
aveva violato senza che il mandato lo prevedesse. Ogni correzione ha richiesto un giro
completo di prova generale (fino a ~1.480 secondi l'ultima).

## Dichiarazione, come chiede il mandato

**Questa è UNA misura su UNA voce, non una legge.** R-9 ha toccato un modulo esistente
(`notifications`) in un modo che il mandato non aveva anticipato, e ha incontrato due
regressioni RBAC storiche che un altro ruolo potrebbe non incontrare affatto — o potrebbe
incontrarne di diverse. Un ruolo che tocca un'area più delicata (es. `R-2` DPO, che ritira
un permesso a una persona viva) o più isolata (es. `R-7` SECURITY_ADMIN, ruolo di cliente,
niente asse di piattaforma) costerà diversamente.

## Che cosa dice sulla riga 17 del mandato K

La riga 17 del mandato K dichiarava «una sessione utile vale circa 150k token»: falso di un
fattore cinque secondo A0.bis (finestra reale 1.000.000, soglia 750.000). Questa misura
conferma indirettamente che il vecchio numero era troppo piccolo anche per una singola voce:
una voce di ruolo può costare ~100k token da sola, e la sessione ne ha margine per molte.
Corretta nella voce A5.3 (v. commit).
