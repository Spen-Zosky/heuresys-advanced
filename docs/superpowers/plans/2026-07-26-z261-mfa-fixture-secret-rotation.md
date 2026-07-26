# Z-261 — Piano di rotazione dei segreti TOTP delle personas

**Data**: 2026-07-26 (S1032) · **Stato**: PIANO — **nulla è stato eseguito** · **Richiede**: autorizzazione esplicita di Enzo, passo per passo

> Questo documento non contiene segreti, né vecchi né nuovi. I valori non vanno
> incollati qui, né in un commit, né in un messaggio.

## 1. Che cosa è stato accertato (non dedotto)

| Fatto | Come è stato verificato |
|---|---|
| Il repo `Spen-Zosky/heuresys-advanced` è **pubblico** | `gh repo view --json visibility` → `PUBLIC` |
| `apps/api/test/helpers/mfa-fixture-secrets.ts` contiene **7 segreti TOTP in chiaro** (base32, 160 bit) | lettura del file; la struttura è `Record<email, secret>` |
| Il file è **scaricabile senza autenticazione** | `curl raw.githubusercontent.com/.../mfa-fixture-secrets.ts` → **200** |
| Esistono **7 fattori TOTP attivi in produzione** con quegli stessi segreti | `SELECT count(*) FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_metadata->>'label'='e2e-fixture'` → **7** |
| I segreti nel DB sono **in chiaro**, non cifrati | `SELECT CASE WHEN auth_mfa_factor_secret LIKE 'enc:v%' …` → 7 `IN-CHIARO-base32` |
| Gli account sono tutti `ACTIVE` e includono ruoli critici | `PLATFORM_ADMIN` · `TENANT_ADMIN`+`CEO` · `WHISTLEBLOWING_CUSTODIAN` · `MANAGER` |
| **Le password non sono esposte** | nessun valore letterale committato; `.env` è in `.gitignore` (verificato con `git check-ignore`) |
| Esiste una **seconda copia** dei segreti | `apps/web/tests/e2e/mfa-fixture-secrets.ts`, tenuta allineata da `apps/api/test/mfa-fixture-parity.test.ts` |
| I segreti sono usati da **172 file di test** | `grep -rl` sulle 7 email in `apps/api/test` + `apps/web/tests` |
| Il seminatore è `db/scripts/seed-test-admin.ts` | `INSERT … WHERE NOT EXISTS` su label `e2e-fixture`, idempotente, **inserisce in chiaro** |

**Conseguenza**: per quei 7 account il secondo fattore non protegge nulla. La password
regge, quindi non è compromissione completa — ma l'MFA esiste esattamente per il caso in cui
la password ceda, e per tre di quegli account protegge il controllo della piattaforma,
l'amministrazione del tenant e il canale whistleblowing.

## 2. Il vincolo che decide la sequenza

I test **devono continuare a funzionare**: 172 file dipendono da quei segreti, e la CI gira sul
runner self-hosted `linux-pc`. Se i segreti escono dal repo senza che la nuova fonte sia già
raggiungibile da tutte le macchine che eseguono i test, la CI si spegne.

Quindi l'ordine è: **prima la nuova fonte ovunque, poi la rotazione, poi la rimozione dal repo.**
Mai il contrario.

## 3. Sequenza proposta

### Passo 1 — Generare 7 segreti nuovi (locale, mai committati)

```bash
# 7 segreti base32 da 32 caratteri (160 bit), scritti SOLO in un file gitignored
node -e '
const c=require("crypto"), A="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const emails=["admin@heuresys.com","federica.marchetti@rtl-bank.org","paolo.caputo@rtl-bank.org",
 "tommaso.fiore@rtl-bank.org","antonio.parisi@rtl-bank.org","marco.rinaldi@rtl-bank.org",
 "andrea.martino@rtl-bank.org"];
const gen=()=>Array.from(c.randomBytes(32)).map(b=>A[b%32]).join("");
const out={}; for(const e of emails) out[e]=gen();
require("fs").writeFileSync(".secrets/mfa-fixtures.json", JSON.stringify(out,null,2));
console.log("scritti", Object.keys(out).length, "segreti in .secrets/mfa-fixtures.json");
'
grep -q "^\.secrets/" .gitignore && echo "OK: .secrets/ è ignorato" || echo "FERMARSI: .secrets/ NON è ignorato"
```

**Verifica di passo**: `git status --short` non deve mostrare `.secrets/mfa-fixtures.json`.

### Passo 2 — Far leggere ai due file la nuova fonte, con fallimento rumoroso

`apps/api/test/helpers/mfa-fixture-secrets.ts` e `apps/web/tests/e2e/mfa-fixture-secrets.ts`
smettono di contenere valori e leggono `.secrets/mfa-fixtures.json` (percorso risolto dalla radice
del repo). Se il file manca → **errore esplicito** con il rimedio nel messaggio, mai un valore di
ripiego: un default silenzioso qui rifarebbe il problema.

Il controllo di parità (`mfa-fixture-parity.test.ts`) va aggiornato di conseguenza: le due copie
ora derivano dalla stessa fonte, quindi il test verifica che entrambe la leggano e che nessuna
delle due contenga valori letterali — un test che **fallisce se qualcuno reintroduce un segreto
nel repo**. Questo è il pezzo che impedisce la ricaduta.

### Passo 3 — Propagare la fonte alle macchine che eseguono i test

```bash
bash scripts/sync-gitignored-to-vm.sh              # VM OCI
bash scripts/align-clones.sh linuxpc               # runner CI + gemello prod
```

**Verifica di passo** (su ciascun host):

```bash
MSYS_NO_PATHCONV=1 ssh linux-pc 'test -f ~/heuresys-advanced/.secrets/mfa-fixtures.json && echo PRESENTE || echo ASSENTE'
MSYS_NO_PATHCONV=1 ssh oracle-vm-default 'test -f /home/ubuntu/heuresys-advanced/.secrets/mfa-fixtures.json && echo PRESENTE || echo ASSENTE'
```

Entrambi devono dire `PRESENTE` **prima** del passo 4.

### Passo 4 — Ruotare i 7 fattori in produzione

⚠️ **Scrittura su produzione. Da qui in poi serve la tua autorizzazione puntuale.**

Prima il salvagente (i vecchi valori, fuori dal repo, per il rollback):

```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -t -A -F'|' -c "
SELECT auth_mfa_factor_id, auth_mfa_factor_user_id, auth_mfa_factor_secret
  FROM sys.sys_auth_mfa_factors
 WHERE auth_mfa_factor_metadata->>'label'='e2e-fixture'" > .secrets/mfa-fixtures-BACKUP-20260726.txt
```

Poi la rotazione, un `UPDATE` per email, con i valori presi dal file gitignored (mai inline sulla
riga di comando: finirebbero nella cronologia della shell). Lo strumento naturale è un piccolo
script `db/scripts/rotate-fixture-totp.ts` che legge `.secrets/mfa-fixtures.json` e aggiorna per
email, con `WHERE … label='e2e-fixture'` — stesso predicato del seminatore, così tocca **solo** i
fattori fixture e nessun fattore di un utente vero.

### Passo 5 — Verificare che la rotazione sia REALE

La prova che conta è quella che può fallire: **il vecchio segreto deve smettere di funzionare.**

```bash
# (a) un codice derivato dal VECCHIO segreto (dal backup) deve essere RIFIUTATO
# (b) un codice derivato dal NUOVO segreto deve essere ACCETTATO
cd apps/api && pnpm exec vitest run test/auth-mfa.integration.test.ts
```

Il punto (a) va eseguito esplicitamente: se non lo si prova, non si sta verificando la rotazione —
si sta verificando che i test passano, che è un'altra affermazione. Se il vecchio codice funziona
ancora, la rotazione non ha avuto effetto e **non si prosegue**.

### Passo 6 — Solo ora, togliere i valori dal repo

```bash
git add apps/api/test/helpers/mfa-fixture-secrets.ts apps/web/tests/e2e/mfa-fixture-secrets.ts \
        apps/api/test/mfa-fixture-parity.test.ts db/scripts/rotate-fixture-totp.ts
git commit -m "fix(security): i segreti TOTP delle personas escono dal repo"
```

**Sulla cronologia git**: i vecchi segreti restano nei commit passati e **non c'è modo di
richiamarli indietro** — sono stati pubblici, vanno considerati bruciati per sempre. Ma dopo il
passo 4 non aprono più nulla, quindi **non serve riscrivere la storia** (operazione costosa e
rischiosa su un repo pubblico con fork possibili). La rimozione dei valori dal presente + la
rotazione bastano. Questo va scritto nel commit, non lasciato implicito.

## 4. Rollback

Rischio principale: sbagliare la rotazione e lasciare 7 account senza secondo fattore
funzionante — uno dei quali è `PLATFORM_ADMIN`.

La via di ritorno è semplice e certa: abbiamo **accesso diretto al database** via tunnel, quindi si
rimettono i valori dal backup del passo 4 con un `UPDATE` per `auth_mfa_factor_id`. Nessun accesso
applicativo è necessario per riparare, quindi non esiste il caso "chiuso fuori".

## 5. Cosa resta fuori da questo piano (deliberatamente)

- **La cifratura dei segreti nel DB.** Correzione a una lettura affrettata: la cifratura **è
  attiva** in produzione — i 12 fattori TOTP creati il 2026-07-22 sono tutti `enc:v…`. I 7 fixture
  sono in chiaro per un motivo diverso e più semplice: **il seminatore non cifra**
  (`db/scripts/seed-test-admin.ts` fa `INSERT` del valore così com'è). Quindi il rimedio non è
  eseguire `encrypt-totp-secrets.ts` su tutto, ma far cifrare al seminatore ciò che scrive —
  naturale da fare **dentro il passo 4**, visto che lo script di rotazione riscrive comunque quelle
  7 righe. Da confermare con una prova: dopo la rotazione i 7 devono risultare `enc:v…` e il login
  deve continuare a funzionare.
- **12 fattori TOTP orfani in produzione.** Tutti di `tommaso.fiore@rtl-bank.org`, tutti creati il
  2026-07-22, tutti **non verificati** (`auth_mfa_factor_verified = false`) e cifrati: sono residui
  di prove di arruolamento MFA rimaste sul database di produzione. Non sono utilizzabili per
  autenticarsi (non verificati) e **non vanno toccati da questa rotazione**, ma sono sporcizia che
  andrebbe rimossa. **Cluster separato**, severità bassa.
- **Il ridisegno delle personas** (identità dedicate alle verifiche automatiche invece di persone
  reali del tenant di produzione) è la causa a monte, ed è una decisione di Enzo sul modello
  dell'ambiente. Questo piano tampona; non risolve la ragione per cui il problema è nato.

## 6. Cosa serve da te

1. Via libera ai passi 1-3 (nessuna scrittura su produzione, tutto reversibile).
2. Autorizzazione **separata** al passo 4, che scrive sui fattori MFA di produzione.
3. Nessuna decisione sul perimetro: è stato misurato. In produzione i fattori TOTP sono **19** —
   i **7** con etichetta `e2e-fixture` (quelli da ruotare) e **12** senza etichetta, tutti di
   `tommaso.fiore@rtl-bank.org`, non verificati, che questa rotazione **non tocca**. Il conteggio
   va comunque rifatto al momento dell'esecuzione invece che dato per buono da oggi:
   `SELECT coalesce(auth_mfa_factor_metadata->>'label','(nessuna)'), count(*) FROM
   sys.sys_auth_mfa_factors WHERE auth_mfa_factor_kind='TOTP' GROUP BY 1;`
