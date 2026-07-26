# Z-262 — Accesso per tutti gli utenti tramite credenziali derivate

**Data**: 2026-07-26 (S1032) · **Stato**: PIANO — il provisioning **non è stato eseguito**
**Già fatto**: la chiave madre esiste (`.secrets/dev-access-master.key`, 48 byte) e lo strumento
di consultazione funziona (`pnpm dev:whoami`, provato su utenti veri).
**Richiede**: autorizzazione esplicita per il passo 3, che scrive su produzione.

> Nessun segreto compare in questo documento. Le password non si annotano da nessuna parte:
> si ricalcolano.

## 1. Perché

Oggi **13 utenti su 162 hanno un accesso**; gli altri 149 non hanno né identità né credenziali.
Questo impedisce due cose che Enzo ha chiesto: provare le interfacce impersonando chiunque, e
far girare i test sull'intera popolazione invece che su 7 personas fisse.

Che le personas fisse nascondano difetti non è teoria: nella stessa sessione il test di `Z-259` è
risultato verde solo perché girava su `tommaso.fiore`, che per combinazione aveva 0 righe del tipo
che perdeva; la fuga esisteva su `luca.conti`, 305 righe su 305.

**Decisioni già prese da Enzo** (S1032): i quattro indirizzi `@heuresys.com` restano **fuori** dallo
schema, con password scelte da lui; la chiave madre vive in `.secrets/`.

## 2. Stato accertato

| Fatto | Verifica |
|---|---|
| 162 utenti `ACTIVE`, di cui **13** con identità e credenziale | `count(DISTINCT auth_identity_user_id)` = 13 |
| Le password sono impronte `ARGON2ID` — **non sono leggibili né recuperabili** | `sys_auth_credentials.auth_credential_hash`, 97 caratteri |
| `sys_users` non ha **nessuna** colonna password | `information_schema.columns` → 0 |
| **MFA obbligatoria attiva su entrambi i tenant** | `sys_auth_mfa_policies` → RTL_BANK `t`, HEURESYS `t` |
| Fattori TOTP esistenti: 19 (7 fixture + 12 orfani non verificati) | `GROUP BY label` |
| **`rtl-bank.org` non esiste** (dominio non registrato) | `nslookup` → *Non-existent domain* |
| `heuresys.com` riceve posta | MX → `fwd1.porkbun.com` |

La riga sul dominio è il motivo per cui l'invito via email **non è una strada**: 158 indirizzi su
162 non sono recapitabili. Non è un difetto da riparare, è la natura del tenant di esempio.

## 3. Lo schema di derivazione

Da un unico segreto (`.secrets/dev-access-master.key`, 48 byte casuali) si ricavano, per ogni
utente e in modo deterministico:

```
password    = base32( HMAC-SHA256(master, "pwd:v1:"  + email_minuscolo) )[0..20]  a gruppi di 4
segreto TOTP = base32( HMAC-SHA256(master, "totp:v1:" + email_minuscolo) )[0..20 byte]  = 160 bit
```

Proprietà che contano:

- **Niente viene mai salvato.** Le password si ricalcolano; nel database restano solo le impronte.
- **Chi non ha la chiave non ottiene nulla**, né leggendo il database né leggendo il repository.
- Il prefisso `v1` permette di ruotare tutto in futuro **senza** cambiare la chiave.
- L'implementazione è **una sola** (`apps/api/scripts/dev-whoami.mjs`), riusata dal provisioning:
  tre copie della stessa crittografia divergono, e quando divergono producono password che il
  server rifiuta senza spiegare perché.

## 4. Passi

### Passo 1 — Chiave madre ✅ FATTO

Creata: `.secrets/dev-access-master.key`, 48 byte, verificata fuori da git
(`git check-ignore` → `.gitignore:49`).

### Passo 2 — Strumento di consultazione ✅ FATTO

`pnpm dev:whoami <email> [--watch]`, più i due wrapper `scripts/dev-whoami.{ps1,sh}`.
Provato su utenti reali: mostra tenant, ruoli, posizione, password derivata e codice a sei cifre
con i secondi residui. `--watch` ristampa il codice quando cambia, così resta valido sotto gli
occhi mentre si lavora nel browser.

I quattro `@heuresys.com` sono riconosciuti e **non** derivati: lo strumento dice esplicitamente
che quella password è scelta dalla persona.

### Passo 3 — Provisioning ⚠️ SCRIVE SU PRODUZIONE — richiede autorizzazione

Uno script idempotente (`db/scripts/provision-derived-access.ts`) che, per ogni utente `ACTIVE`
non escluso:

1. crea l'identità di accesso se manca (`sys_auth_identities`, tipo LOCAL);
2. crea o aggiorna la credenziale con l'impronta Argon2id della password derivata, usando lo
   **stesso** helper del server, non una reimplementazione;
3. crea o aggiorna il fattore TOTP con il segreto derivato, **cifrato** con `MFA_ENCRYPTION_KEY`
   (la cifratura è attiva in produzione: i fattori del 22/07 sono `enc:v1…`; i 7 fixture sono in
   chiaro solo perché il vecchio seminatore non cifrava);
4. **salta** i domini in `REAL_PERSON_DOMAINS`.

Numeri attesi: **149** identità, **149** credenziali, **155** fattori TOTP creati o riscritti.

### Passo 4 — Verifica, con prove che possono fallire

```bash
# (a) copertura: nessun utente ACTIVE non escluso resta senza accesso
psql … -c "SELECT count(*) FROM sys.sys_users u
            WHERE u.user_status='ACTIVE' AND u.user_email NOT LIKE '%@heuresys.com'
              AND NOT EXISTS (SELECT 1 FROM sys.sys_auth_identities i
                               WHERE i.auth_identity_user_id=u.user_id)"   -- atteso: 0

# (b) login VERO end-to-end di una persona qualsiasi, non di una persona scelta
pnpm dev:whoami luca.conti@rtl-bank.org        # password + codice
# → login dal browser su www.heuresys.com e su http://<ip-lan>:3013

# (c) il caso negativo, senza il quale non si sta verificando niente:
#     una password SBAGLIATA per lo stesso utente deve essere RIFIUTATA (401)
```

Il punto (c) è quello che distingue "ho provato che funziona" da "ho provato che il controllo
esiste". Va eseguito, non dedotto.

### Passo 5 — Ritirare le personas dai test (per ondate)

Le costanti `MANAGER = "paolo.caputo@…"` diventano interrogazioni: *un* utente con ruolo `MANAGER`
che ha almeno un riporto diretto, scelto in modo deterministico e ordinato. 172 file, quindi
**a ondate**, partendo dai test di visibilità e scope — quelli dove una persona fissa nasconde di
più, come si è visto oggi.

## 5. Rapporto con Z-261 (segreti TOTP pubblicati)

**Questo piano assorbe la rotazione.** I 7 segreti pubblicati su GitHub diventano irrilevanti nel
momento in cui il passo 3 riscrive i fattori con segreti derivati dalla chiave madre: non serve una
rotazione separata. Resta da fare, nello stesso commit, la parte di igiene: togliere i valori dai
due file del repository e far leggere ai test la fonte derivata, con il controllo di parità che
**fallisce se qualcuno reintroduce un segreto letterale**.

I vecchi segreti restano nella cronologia git e vanno considerati bruciati per sempre — ma dopo il
passo 3 non aprono più nulla, quindi non serve riscrivere la storia.

## 6. Rollback

Il provisioning aggiunge righe; non ne cancella. Per tornare indietro si eliminano le identità,
credenziali e fattori creati dallo script (riconoscibili per `created_at` e per l'assenza fra i 13
preesistenti), previo backup su file gitignored come per la rotazione. L'accesso diretto al
database resta disponibile via tunnel, quindi non esiste il caso "chiusi fuori".

## 7. Rischi, dichiarati

- **La chiave madre apre 158 account.** Se trapela, sono tutti accessibili. È comunque un netto
  miglioramento rispetto a oggi, dove 7 account — fra cui `PLATFORM_ADMIN` e il custode
  whistleblowing — sono aperti a chiunque legga GitHub. Ma il rischio viene **concentrato**, non
  eliminato: va custodita come le chiavi JWT, che stanno già lì.
- **Il sistema è raggiungibile pubblicamente** (`www.heuresys.com`). Le password derivate hanno
  circa 100 bit di entropia e l'MFA resta attiva, quindi non sono indovinabili — ma 158 account
  attivi in più sono 158 superfici di accesso in più.
- **Enzo ha stabilito** (S1032) che i dati di RTL Bank non corrispondono a persone reali e che il
  rischio su di essi è teorico. Questo piano lo recepisce; i quattro indirizzi che invece
  corrispondono a persone vere restano fuori dallo schema proprio per questo.
