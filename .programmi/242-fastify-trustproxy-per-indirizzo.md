# 242 — fastify ≥ 5.12 ha tolto il `trustProxy` a conteggio di salti

> **item**: #242 · **priorità**: P2 · **stima**: ~1 sessione
> **stato**: CHIUSO
> **chiusa**: F1..F4 fatte il 2026-09-05 (S1087) — `status: DONE` nel register.
> ⚠ La riga di stato diceva `✅ **CHIUSA** — F1..F4 fatte il 2026-09-05 (S1087)`: leggibilissima
> per un umano e **muta per il parser**, che accetta `^> **stato**: [A-Z ]+$` e su tutto il resto
> cade su `?`. Un piano dichiarato chiuso in prosa risultava aperto e compariva a ogni avvio fra
> i programmi orfani
> **nasce-da**: le due PR Dependabot su fastify 5.12.1 (`#76`, `#75`), che Enzo ha chiesto di
> risolvere il 2026-09-03 (S1086). Chiuse entrambe con la ragione scritta.

## Il fatto, misurato il 2026-09-03

La firma di `trustProxy` è cambiata:

```ts
trustProxy?: boolean | string | string[] | number | TrustProxyFunction   // 5.10.0
trustProxy?: boolean | string | string[] | TrustProxyFunction            // 5.12.1  ← niente `number`
```

**Il tipo segue il comportamento**, e il comportamento è stato tolto apposta. In
`node_modules/fastify/lib/request.js` della 5.12.1:

```js
if (typeof tp === 'number') {
  // Hop-count-only trust cannot validate the immediate peer. Fail closed so
  // direct clients cannot spoof X-Forwarded-* values by supplying enough hops.
  return function () { return false }
}
```

La forma numerica non è deprecata: **non si fida più di nulla**.

Il typecheck rosso in CI (5 errori in `apps/api/src/app.ts`: 206, 218, 267, 336, 513) è **un
errore solo che si propaga**. `parseTrustProxy` restituisce `boolean | number | string`; quel
`number` non risolve più l'overload di `Fastify()`, TypeScript ripiega sull'ultimo overload —
quello HTTP/2 sicuro — e da lì ogni uso dell'istanza diventa incompatibile. **Riprodotto in
locale** prima di scrivere qualunque cosa: 5 errori, identici a quelli della CI.

## Perché non si è zittito il typecheck

La produzione dichiara `TRUST_PROXY=1` (D-28, dietro il proxy TLS nginx). Con la 5.12.1 quel
valore significa «non fidarti di niente», quindi `req.ip` diventerebbe l'indirizzo del proxy
invece di quello reale del client. Conseguenza: il **rate limiting per IP finirebbe in un secchio
solo per tutte le richieste** — nessun errore, nessun log, nessun test rosso.

Un cast avrebbe reso il rosso verde **lasciando intatto il difetto**. È il caso da manuale in cui
la prova va creduta invece che aggirata.

## Il lavoro

| id | cosa | cosa significa fatto | stato |
|---|---|---|---|
| **F1** | Misurare quale indirizzo l'API vede come peer | il valore è **misurato** su una richiesta vera, non dedotto | ✅ **FATTO** 2026-09-03 — `req.ip` è l'IP reale, l'XFF forgiato è ignorato |
| **F2** | `TRUST_PROXY` in produzione da `1` a indirizzi/CIDR | il `.env` della VM porta la forma per indirizzo, e l'API riavviata la legge | ✅ **FATTO** 2026-09-05 — `127.0.0.1,::1`, sonda verde su entrambe le proprietà |
| **F3** | `parseTrustProxy` + test: la forma numerica si **respinge** | un `TRUST_PROXY=1` fa fallire l'avvio con un messaggio che dice cosa mettere | ✅ **FATTO** — throw con la forma da usare; 5/5 test verdi |
| **F4** | Il bump sui manifest | `Typecheck` verde | ✅ **FATTO** — a **5.12.3** (l'ultima, non la 5.12.1 del piano); un manifest solo; typecheck verde |

### F1 — la misura, ed è la voce che regge tutte le altre

La catena non è «un proxy davanti»: è **browser → nginx → rewrite di Next → API**.

- nginx (`/etc/nginx/sites-enabled/www.heuresys.com.conf`) ha **un solo** `proxy_pass`, verso
  `http://127.0.0.1:3013` — cioè il **web**, non l'API — e imposta
  `X-Forwarded-For $proxy_add_x_forwarded_for`;
- il web raggiunge l'API con un rewrite di Next: `{ source: "/api/:path*", destination:
  "${base}/:path*" }` (`apps/web/next.config`);
- l'API ascolta su `0.0.0.0:8013`.

Quindi il peer immediato dell'API è **il processo Next**, non nginx. Da qui due domande che
**vanno misurate e non dedotte**, e che sono la ragione per cui questa voce non è un tre-righe:

1. l'indirizzo con cui Next si presenta all'API (probabilmente `127.0.0.1`, ma va visto);
2. **se Next propaga l'`X-Forwarded-For`** che nginx ha scritto. Se non lo propaga, l'IP reale del
   client non arriva all'API **in nessuna configurazione di `trustProxy`**, e allora il difetto è
   più vecchio di questo aggiornamento e la voce cresce.

⚠ **Sospetto da verificare, non un fatto**: se la seconda risposta è «no», allora `TRUST_PROXY=1`
oggi non sta già dando l'IP reale, e il rate limiting per IP è già in un secchio solo. Non è
misurato: è la prima cosa che F1 deve stabilire.

---

## ✅ F1 — MISURATA (2026-09-03, S1086). Il sospetto era INFONDATO, e ora si sa perché

**L'assetto attuale funziona ed è sicuro.** Una sola richiesta lo dimostra, e dimostra
*entrambe* le proprietà che questa voce chiedeva di preservare:

```bash
curl -4 -X POST https://www.heuresys.com/api/v1/auth/login \
     -H 'X-Forwarded-For: 203.0.113.7' \
     -H 'Content-Type: application/json' \
     -d '{"email":"probe-242-f1@example.invalid","password":"…"}'      # -> 401
```

Poi, in `sys.sys_auth_login_events` (la rotta di login vi deposita `req.ip`):

```
       ip       |          created_at
----------------+------------------------------
 37.120.137.234 | 2026-09-03 21:54:24.945+00
```

- `req.ip` è **l'IP pubblico reale del client** — non `127.0.0.1`, quindi la catena
  browser → nginx → rewrite di Next → API **propaga l'`X-Forwarded-For`**;
- l'IP **forgiato a sinistra** (`203.0.113.7`, TEST-NET-3) **non** è diventato `req.ip`: il
  conteggio di salti ignora l'entrata falsificata e prende quella che nginx ha davvero
  appeso. È precisamente ciò che D-28 prescrive.

**Questa è la prova che deve poter fallire**, ed è già scritta: entrambe le condizioni in una
richiesta. Va rieseguita dopo la migrazione — se la prima cade, `req.ip` è il proxy; se cade la
seconda, chiunque può dichiararsi un altro IP.

### ⚠ Il trabocchetto in cui sono caduto, e che vale la pena lasciare scritto

Guardando lo storico avevo trovato **91.409 eventi su `127.0.0.1`**, e negli ultimi 30 giorni
**1.753 su 1.818 (96,4%)**. Ne avevo concluso che l'IP reale non arrivasse. **Era falso**: quel
traffico *nasce sulla macchina stessa* — la suite E2E che gira sul runner, i controlli di salute,
i dati della storia — e per esso `127.0.0.1` è l'indirizzo corretto. I login dal browser
registrano l'IP vero (`188.216.74.236`, `146.70.182.27`, e ora la sonda).

Una misura vera che suggerisce una conclusione falsa: il conteggio era esatto, la popolazione
no. La sonda ha risolto in una richiesta ciò che l'aggregato non poteva dire.

### Cosa cambia per questa voce

Il mandato si **rovescia di segno**: non c'è un difetto da riparare, c'è un comportamento
**verificato buono da preservare**. E questo *rafforza* la ragione per cui fastify ≥ 5.12 resta
fuori — con la forma numerica neutralizzata, `req.ip` diventerebbe il peer (`127.0.0.1`) per
**tutto** il traffico web, e si perderebbe esattamente ciò che la sonda ha appena mostrato
funzionante. F2/F3/F4 restano come sono; F1 è chiusa.

### La prova che deve poter fallire

Con il nuovo assetto, entrambe insieme — o si è solo spostato il difetto:

- `req.ip` è l'IP **reale** del client, non quello del proxy;
- una richiesta che forgia un `X-Forwarded-For` a sinistra **non** riesce a farsi passare per un
  altro IP.

## Note

- `5.12.1` è l'ultima pubblicata (misurato dal registry il 2026-09-03): nessun rilascio ha
  rimesso la forma numerica. Non è un'attesa che si risolve da sé.
- Le due PR erano **lo stesso bump spezzato in due manifest** (radice e `apps/api`), e nessuna
  delle due poteva diventare verde da sola.


---

## ✅ F2/F3/F4 — CHIUSE il 2026-09-05 (S1087)

### F2 — la produzione passa alla forma per indirizzo

`.env` della VM: `TRUST_PROXY=1` → **`TRUST_PROXY=127.0.0.1,::1`**, API riavviata.
La sonda di F1 rieseguita, e **entrambe** le proprietà reggono:

```
POST https://www.heuresys.com/api/v1/auth/login  -H 'X-Forwarded-For: 203.0.113.7'   -> 401
sys.sys_auth_login_events -> ip = 37.120.137.234   (l'IP pubblico reale del client)
```

- `req.ip` e' l'IP **reale**, non `127.0.0.1` del proxy;
- l'XFF forgiato a sinistra (`203.0.113.7`) **non** e' diventato `req.ip`.

Riferimento preso prima del cambio, con `TRUST_PROXY=1`: stesso IP. La forma per
indirizzo **preserva esattamente** il comportamento, che era il punto della voce.

### ⚠ Tre falsi rossi, e la ragione unica sotto tutti e tre

Durante F2 la produzione e' sembrata rotta **tre volte** (`500`, poi `readyz=500`,
poi `curl 000` con l'API «in ascolto»). Ogni volta la causa era la stessa: **l'API
impiega ~24 secondi** fra `systemctl restart` e la prima risposta utile, e ogni
misura era caduta dentro quella finestra. Una di quelle volte ho perfino ripristinato
la produzione «per prudenza» sulla base di una conclusione sbagliata.

La misura era vera ogni volta; la conclusione no. Il rimedio non e' guardare meglio:
e' **non misurare finche' non risponde**. Ogni prova su un servizio riavviato ora
passa da un'attesa attiva (polling su `/readyz` fino a 200), mai da uno `sleep`.

### F3 — la forma numerica si respinge, e il messaggio dice cosa mettere

`parseTrustProxy` **lancia** su `^\d+$`, con un messaggio che nomina il valore da
usare (`TRUST_PROXY=127.0.0.1,::1`) e l'alternativa (`false`). Il tipo di ritorno
scende a `boolean | string`, che e' esattamente cio' che la 5.12 accetta.

Non e' rigore per il rigore: la forma numerica **non e' deprecata, e' silenziosamente
inerte** — l'API sarebbe partita, avrebbe risposto, e avrebbe messo ogni richiesta
nello stesso secchio di rate limiting, senza un errore, un log o un test rosso. Un
valore diventato pericoloso deve fermare l'avvio, non degradare in un default sbagliato.

Allineati anche `.env.example` e il commento in `env.ts`, che prescrivevano `=1`.

### F4 — il bump

`apps/api/package.json`: `fastify` **5.11.3 → 5.12.3**. Il piano diceva 5.12.1: misurato
dal registry il 2026-09-05, l'ultima e' la **5.12.3**. Un manifest solo — la seconda PR
Dependabot riguardava la radice, che oggi non dichiara piu' `fastify`.

Verificato **sul codice installato**, non sul changelog: `lib/request.js:51` della 5.12.3
ha ancora il fail-closed sulla forma numerica, e `fastify.d.ts:152` non ammette piu' `number`.

Misure: `pnpm typecheck` **verde su tutti i workspace** (era il rosso che aveva aperto la
voce: 5 errori in `app.ts`) · `vitest run test/trust-proxy.test.ts` **5/5**.

### I `.env` di ogni ambiente, misurati dopo il cambio

| ambiente | valore |
|---|---|
| Windows | `false` |
| linux-pc | `false` |
| VM (produzione) | `127.0.0.1,::1` |
| CI | non lo imposta → default `false` |

Nessuno dichiara piu' la forma numerica: il throw di F3 non puo' rompere nessun avvio.
