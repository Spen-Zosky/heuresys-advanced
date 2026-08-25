# 230 — Le quattro voci che aspettavano un input: verificate una per una, e tre non erano quello che dicevano

> **item**: #230 (istruttoria — nasce dal mandato di apertura S1080)
> **stato**: IN CORSO
> **punto**: le cinque misure sono chiuse; restano le due decisioni, D1 e D2
> **misurato**: 2026-08-25, S1080

## Perché questa verifica

Il registro portava quattro voci in corsia `WAIT-INPUT` senza alcuna data, e la dashboard lo
segnalava come domanda aperta: *«Quattro voci aspettano un tuo input e non portano alcuna data»*.
Una voce in quella corsia ha una sola ragione di esistere — c'è un input che **solo Enzo** può
dare. Se quell'input non serve più, non è più ottenibile, o la decisione è già stata presa
altrove, la voce non aspetta: **è ferma**, e nessuno se ne accorge.

Il precedente c'era già, due volte:
- `#196` (riga 247 del register): status `WAIT-INPUT` con il corpo che diceva «DECISO-da-Enzo».
- `#86` (S1079): il titolo diceva «VM e linux-pc» ed era **metà falso** — provata sul campo, la
  VM rispondeva già.

## Metodo

Per ognuna: leggere il blocco nel register, poi **misurare sul vivo** ciò che il blocco dà per
scontato. Mai dedurre dallo stato scritto.

## Fasi

Le cinque misure sono chiuse. Le due che restano **non sono lavoro tecnico**: sono le decisioni
che tornano a Enzo, e il dato che va scritto comunque.

- [x] **V1 #85 — misurare la premessa della voce** — FATTO 2026-08-25 · `wc -c`: `CLAUDE.md` 38.567 byte contro i 20.990 che la nota dà per scontati; `AGENTS.md` fermo a 36.602 e untracked (`git ls-files`: no match); 95 righe in comune su 218/235
- [x] **V2 #8 — l'input richiesto è ancora ottenibile?** — FATTO 2026-08-25 · no: Basic Auth SMTP ritirato da Microsoft per gli account personali (16 set 2024 → spegnimento 30 apr 2026). In produzione `grep -c "^SMTP_HOST=." .env` → **0**. `smtp-mailer.ts:125` ha solo `auth: {user, pass}`, nessun ramo OAuth2
- [x] **V3 #16 — cosa dipende davvero dal sandbox?** — FATTO 2026-08-25 · `grep -ril successfactors` su `apps/ packages/ db/` → **0 file**; `POST_V1_ROADMAP_DOSSIER.md:127` lo dichiara già **ESCLUSO**; §1.A dichiara **F1 eseguibile senza sandbox**
- [x] **V4 #52 — quanto è bloccato dall'input, e quanto no?** — FATTO 2026-08-25 · `sys.sys_auth_identities` prevede `SSO_OIDC`/`SSO_SAML` dalla mig 000005 (160 righe); implementazione: **zero** (`grep -ril "oidc|saml|sso"` su `apps/api/src` `apps/web/src` `packages/shared/src` → solo la vetrina statica)
- [x] **V5 — da quanto aspettano, misurato e non dedotto** — FATTO 2026-08-25 · `git log -S` su `SOT_BACKLOG.md`: #8 S998 · #16 S999 · #52 S1018 · #85 S1039 → 82/81/62/41 sessioni
- [ ] **D1 Le quattro decisioni tornano a Enzo** — presentate S1080 (A/B/C/D nel menu di apertura). Ognuna cambia lo `status` di una voce del register, e lo status di una voce `WAIT-INPUT` **non è mio da cambiare**: è la corsia che dice «aspetta lui». Chiuso quando le quattro voci hanno uno stato che riflette la verifica
- [ ] **D2 Le date entrano nel register, comunque vada D1** — ogni blocco `WAIT-INPUT` porta la data in cui l'attesa è cominciata. Indipendente dalle decisioni: senza data, `check_marciume` M5 resta cieco su quella corsia e lo dichiara — *«non si può sapere da quanto — cieco, non verde»*

---

## V1 · `#85` — AGENTS.md divergente dal CLAUDE.md rifattorizzato

**Cosa chiedeva**: «se e quando rigenerare `AGENTS.md` dal `CLAUDE.md` nuovo».

**Misura (2026-08-25)**:

```
CLAUDE.md   38.567 byte · 218 righe
AGENTS.md   36.602 byte · 235 righe · untracked (git ls-files: no match)
righe in comune: 95
```

**Esito — la premessa è scaduta.** La nota della voce dice: *«S1039 ha portato `CLAUDE.md` da
38.393 a 20.990 caratteri»*. Oggi `CLAUDE.md` è **38.567**: è ricresciuto **oltre** il valore
pre-refactor. Il «CLAUDE.md nuovo» da cui rigenerare non esiste più — non è più il file snello
del 2 agosto. `AGENTS.md` è invece **fermo esattamente a 36.602**, il valore che la nota
registrava: non è stato toccato, come previsto.

**Esito — la risposta è già scritta nel CLAUDE.md.** §*Codex read-only audit channel*: `AGENTS.md`
«legitimately appear as untracked. They are **not** stray files to clean up, they are **not**
Claude's to maintain, and `align-clones` / `close-propagate` do not carry them — the two channels
stay separate by design». La rigenerazione passa dal canale Codex, non da qui. Non c'è un input
mancante: c'è un invariante già dichiarato.

**Proposta**: `WON'T-DO` per invariante di progetto. Se un giorno Codex dovrà rigenerare il suo
file, sarà una voce **sua**, non una voce ferma in questo registro.

---

## V2 · `#8` — EMAIL dormiente (app-password Outlook)

**Cosa chiedeva**: «app-password Outlook (`enzo.spenuso@outlook.com`)» → «attiva EMAIL_OTP +
digest live in 1 mossa (transport già pronto)».

**Misura 1 — il transport è davvero pronto?** Sì, e usa **solo** Basic Auth:

```
apps/api/src/config/env.ts:177-185   SMTP_HOST / PORT / SECURE / USER / PASSWORD / MAIL_FROM
apps/api/src/modules/auth/smtp-mailer.ts:125
    ? { auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASSWORD ?? "" } }
```

Nessun ramo OAuth2 / XOAUTH2 in tutto il file.

**Misura 2 — è già configurato in produzione?** No:

```
ssh oracle-vm-default 'grep -c "^SMTP_HOST=." .env'  →  0
ssh oracle-vm-default 'grep -c "^MAIL_FROM=." .env'  →  0
```

**Misura 3 — l'input richiesto è ancora ottenibile?** **No.** Microsoft ha ritirato Basic Auth per
SMTP sugli account personali `outlook.com` (16 settembre 2024 per i client di terze parti;
spegnimento completo di SMTP AUTH Basic Auth il **30 aprile 2026** — quattro mesi fa). Le
app-password poggiavano su Basic Auth: **non esistono più** per un account personale Outlook.

**Esito — la voce chiede una cosa che non si può più dare.** Non è «Enzo non ha ancora risposto»:
è che la risposta non è più producibile. E anche se lo fosse, il nostro mailer non parla OAuth2,
quindi la mossa non sarebbe comunque «1 sola».

**Proposta**: riscrivere la voce. La domanda giusta non è più «l'app-password», è **quale via di
invio**. Due strade, e la scelta del *cosa* è di Enzo:
- **(a)** un servizio di posta transazionale con credenziali SMTP proprie (piano gratuito
  sufficiente per OTP + digest) → resta vero «transport già pronto, 1 mossa»;
- **(b)** OAuth2 sull'account Microsoft → richiede **prima** di insegnare OAuth2 al mailer
  (`smtp-mailer.ts`), quindi non è più un input soltanto.

---

## V3 · `#16` — SuccessFactors (sandbox esterno, a costo)

**Cosa chiedeva**: «un sandbox SuccessFactors (esterno, costo)».

**Misura 1 — cosa nel prodotto lo aspetta?** Nulla:

```
grep -ril successfactors  su apps/ packages/ db/   →  0 file
```

Zero codice, zero migrazioni. Solo documenti (scorecard competitiva, dossier di roadmap, register).

**Misura 2 — la decisione è già stata presa?** Sì, e in senso contrario.
`docs/kb/xtras/POST_V1_ROADMAP_DOSSIER.md:127` — *«SuccessFactors (1.A): → **ESCLUSO** dal
programma (#7 fuori scope per scelta Enzo)»*. Lo stesso dossier (§1.A) dichiara che il valore
dell'item è **«dimostrativo/architetturale (multi-source reale), non integrazione cliente»**.

**Misura 3 — è tutta bloccata sul sandbox?** No. Il dossier decompone in cinque fasi e dichiara
**F1 (~1-2 sessioni) «eseguibile SUBITO senza sandbox»** — chassis extractor fixture-driven +
righe watermark. Il sandbox (F0) blocca F2-F4, non F1.

**Esito**: la voce sta in `WAIT-INPUT` come se il sandbox fosse l'unico ostacolo, mentre l'ostacolo
vero è che **l'item è già escluso** — e per un motivo che non dipende dal sandbox (valore
dimostrativo, non di cliente).

**Proposta**: `WON'T-DO` con la ragione scritta (esclusione S987 + valore dimostrativo), oppure —
se Enzo vuole tenerla viva — spezzarla e portare **solo F1** in `ACTIVE`, lasciando il resto
gated sul sandbox. Ciò che non deve restare è la forma attuale: nessun input di Enzo la sblocca,
perché non è l'input a bloccarla.

---

## V4 · `#52` — SSO enterprise (Azure AD / Google OIDC)

**Cosa chiedeva**: «client ID + secret di un IdP reale».

**Misura 1 — il modello dati esiste già.** Sì, e prevede la federazione fin dalla fondazione:

```sql
-- sys.sys_auth_identities (mig 000005_auth_foundation)
CHECK (auth_identity_provider = ANY (ARRAY['LOCAL','SSO_OIDC','SSO_SAML']))
righe: 160   (tutte le identità odierne)
```

**Misura 2 — l'implementazione esiste?** No. `grep -ril "oidc|saml|sso"` su
`apps/api/src`, `apps/web/src`, `packages/shared/src` → **un solo file**, e non è codice di
prodotto: `apps/web/src/app/showcase/login-page/page.tsx` (la vetrina statica).

**Esito — la voce è mal tagliata.** Il modello c'è, l'implementazione no, e l'input di Enzo serve
**solo all'ultimo passo**: la dimostrazione LIVE che la Definition of Done pretende. Tutto il
lavoro a monte — rotte OIDC, scambio del codice, aggancio a `sys_auth_identities`, provisioning
just-in-time — non è bloccato da niente. Oggi la voce è ferma **al 100%** per un input che serve
al **10% finale**.

**Proposta**: spezzarla. La parte costruibile va in `ACTIVE`; resta `WAIT-INPUT` (o meglio
`GATED`, con `unblock-trigger` esplicito) la sola dimostrazione finale. Da valutare, quando si
arriverà lì, se l'IdP debba per forza essere una risorsa di Enzo: un client OAuth Google è
gratuito, e Azure AD ha un livello gratuito — ma la scelta del *cosa* resta sua.

---

## Da quanto aspettavano — il dato che mancava

Prima apparizione di ciascun blocco in `docs/kb/SOT_BACKLOG.md` (`git log -S`), contro la sessione
corrente **S1080 / 2026-08-25**:

| voce | nata | sessione | ferma da |
|---|---|---|---|
| `#8` EMAIL | 2026-06-19 | S998 | **67 giorni · ~82 sessioni** |
| `#16` SuccessFactors | 2026-06-20 | S999 | **66 giorni · ~81 sessioni** |
| `#52` SSO | 2026-07-16 | S1018 | **40 giorni · ~62 sessioni** |
| `#85` AGENTS.md | 2026-08-02 | S1039 | **23 giorni · ~41 sessioni** |

**Questo dato va nel register**, qualunque cosa Enzo decida sulle quattro voci: una corsia «aspetta
te» senza una data non permette di accorgersi che una voce è morta. È lo stesso difetto che
`check_marciume` è nato per cogliere sulle scadenze.

## Cosa ne esce, in una riga

**Su quattro voci, una sola aspettava davvero.** `#85` ha la risposta già scritta nel CLAUDE.md;
`#8` chiede una credenziale che il fornitore non emette più; `#16` era già stata esclusa, e per una
ragione che il sandbox non tocca; `#52` è bloccata tutta per un input che serve solo alla fine.
Nessuna delle quattro era falsa quando è stata scritta: sono invecchiate, e la corsia non aveva
modo di dirlo.
