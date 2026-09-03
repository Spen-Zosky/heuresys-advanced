# 243 — I due rossi di igiene, e le sette PR Dependabot rimaste

> **item**: #243 · **priorità**: P2 · **stima**: ~1 sessione
> **stato**: IN CORSO (S1086)
> **nasce-da**: mandato di Enzo (2026-09-03) — *«i due rossi di igiene del cruscotto, e le sei PR
> Dependabot rimaste oltre alle tre di cui abbiamo parlato, inclusa qs 6.16.0: aprili e risolvili
> tutti»*.

## Le voci

| id | cosa | cosa significa fatto | stato |
|---|---|---|---|
| **I1** | Derivati superati (2/3) | `session_start.py` non segnala più il rosso dei derivati | ⬜ |
| **I2** | Peso dello stato: cronaca chiusa al 38% del register | il rosso sparisce, `handoff_lint` resta 0 FAIL, i 27 item vivi ci sono tutti | ⬜ |
| **D1** | Le PR senza difetti propri, assorbite in un batch | i bump nel repo, CI verde, PR chiuse come assorbite | ⬜ |
| **D2** | `fastify-type-provider-zod` 6.1.0 → **7.0.0** (major) | preso, oppure respinto con la ragione misurata | ⬜ |
| **D3** | `typescript` 6.0.3 → **7.0.2** (major) | preso, oppure respinto con la ragione misurata | ⬜ |
| **D4** | `#74` — gruppo `minor-and-patch`, **32 aggiornamenti**, quattro check rossi | preso, spacchettato, oppure respinto con la ragione | ⬜ |

## La misura di partenza (2026-09-03)

### I due rossi

`build_derivati.py` **non ha un `--help`**: invocato con quel flag ha eseguito e basta. Ha
rigenerato `docs/kb/atlas/derivati.json` (`da c6a39068`) — una riga cambiata. Voce I1 di fatto già
eseguita, resta da committare.

`compatta_register.py` senza argomenti è invece **solo un rapporto**, e dice cosa farebbe:

```
file      351,857 byte (~87,964 token) · register 213,296 byte in 228 item
TERMINALI: 81,177 byte = 38% del register (~20,294 token di cronaca gia' chiusa)
compattando: 201 item archiviati · 27 tenuti vivi
register: 351,857 -> 308,281 byte (13% in meno)
archivio: docs/archive/SOT_BACKLOG_CHIUSI.md
```

### Le sette PR, classificate per **causa del rosso**, non per anzianità

| PR | bump | check | causa vera |
|---|---|---|---|
| **#77** | `qs` 6.15.3→6.16.0 (transitiva, solo lockfile) | solo `playwright-smoke` rossa | **la porta 3001**, già liberata |
| **#68** | `pnpm/action-setup` (SHA dentro v6) | solo `playwright-smoke` rossa | **la porta 3001** |
| **#60** | `@eslint/js` 9.39.4→9.39.5 | **tutti verdi** | nessuna |
| **#58** | `github/codeql-action` v3→**v4** | verdi | nessuna (major di una action) |
| **#62** | `fastify-type-provider-zod` 6.1.0→**7.0.0** | **tutti verdi**, `test-integration` compreso | nessuna — ma è un **major**, e il verde non basta a dire che non cambi comportamento |
| **#61** | `typescript` 6.0.3→**7.0.2** | `build-web`, `lint`, `smoke` rosse · `typecheck` **verde** | major vero; la combinazione «typecheck verde ma build rossa» è essa stessa un reperto |
| **#74** | gruppo `minor-and-patch`, **32 aggiornamenti** | `typecheck`, `lint`, `test-integration`, `smoke` rosse | da spacchettare: 32 bump insieme non si diagnosticano |

⚠ **Gli esiti dei check sono vecchi** per le PR più anziane (#58, #60, #61, #62): quei rami sono
indietro rispetto a `main`, e un verde di settimane fa **non è un verde di oggi**. Vanno rimisurati
sul codice attuale prima di crederci — vale sia per i verdi sia per i rossi.

## Il metodo: assorbire, non mergiare sette volte

Precedente del progetto: `01405306` — *«le 8 PR Dependabot assorbite in un batch, tranne quella che
non va presa»*. Si applica qui per tre ragioni misurabili: i rami sono indietro e andrebbero
comunque riallineati; sette merge sono **sette giri di CI** su un runner che ne fa uno per volta; e
i lockfile si contendono fra loro, quindi ogni merge invaliderebbe i cinque successivi.

Quindi: i bump si applicano **qui**, si verificano in un giro solo, e le PR si chiudono come
assorbite (o respinte, con la ragione scritta nel commento).

## Simulazione — I2, la compattazione del register

- **Precondizioni** — `handoff_lint` verde adesso (0 FAIL / 2 WARN pre-esistenti). Verificato.
- **Meccanismo** — `python docs/kb/tools/compatta_register.py --esegui`: sposta i 201 item
  terminali in `docs/archive/SOT_BACKLOG_CHIUSI.md`, che **non è SoT** per contratto.
- **Propagazione** — commit; nessun artefatto fuori dal repo.
- **Chi** — io.
- **Guardia** — il rapporto letto sopra **è** il dry-run: 201 archiviati, 27 tenuti vivi. Se dopo
  l'esecuzione gli item vivi non sono 27 (13 ACTIVE + 9 HOLD + 2 GATED + 3 senza stato), è un
  errore, non una compattazione.
- **Post-condizione che protegge ciò che NON doveva cambiare** — `handoff_lint` resta **0 FAIL**, e
  `build_menu.py` continua a produrre lo stesso menu: la compattazione tocca la **cronaca chiusa**,
  e il menu si costruisce dai vivi. Se il menu cambia, qualcosa di vivo è stato archiviato.
- **Rollback dichiarato** — il file è versionato e il commit è atomico: `git revert` lo rimette.
  Non serve un giornale.

## Simulazione — D1/D2/D3/D4, i bump

- **Precondizioni** — albero pulito e CI verde sulla base di partenza (`c6a39068`, misurato:
  `DEPLOYATO`, 4 corse su 4 verdi).
- **Meccanismo** — un ramo di lavoro, i bump applicati per gruppi, `pnpm install`, poi
  `pnpm typecheck` + `pnpm lint` + i test API. **Il verde locale non chiude nulla**: la parola
  finale è la CI, perché è lei che ha il database di CI e il runner vero.
- **Propagazione** — un commit per gruppo omogeneo, non uno solo da 32 bump: se qualcosa si rompe
  dopo, si deve poter dire *quale*.
- **Chi** — io.
- **Guardia** — un major non entra perché «i check erano verdi»: entra se **si legge cosa è
  cambiato** e nulla di ciò che usiamo è toccato. Il verde di un test dice che i test passano, non
  che il comportamento è lo stesso — ed è esattamente l'errore che fastify 5.12.1 avrebbe fatto
  commettere se mi fossi fermato al typecheck (`#242`).
- **Rollback dichiarato** — commit atomici e separati; `git revert` del singolo gruppo.

## Fuori da questo ciclo (registro separato)

- La domanda ancora aperta di `#242`: se il rewrite di Next propaghi l'`X-Forwarded-For` fino
  all'API.
