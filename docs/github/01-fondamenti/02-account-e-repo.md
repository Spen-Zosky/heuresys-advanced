# 02 · Account e Repository

> L'account GitHub è la tua identità developer pubblica. Ogni repository ha decine di settings — la maggior parte default sani, alcuni decisivi. Questo capitolo elenca tutto ciò che è bene conoscere per non scoprire le opzioni "per caso".

---

## 1. Concetto

Un **account** GitHub è un'entità identificata da uno `username` univoco (es. `Spen-Zosky`). Esistono due tipi:

| Tipo | Quando si usa | Owner di | Pricing default |
|---|---|---|---|
| **Personal** | Il tuo profilo individuale | Solo te | Free |
| **Organization** | Contenitore per team / azienda / progetto open source | Membri multipli con ruoli | Free / Team / Enterprise |

Il **profilo personal** è una pagina pubblica con:
- Foto, bio, location, link sito
- Activity graph (i quadratini verdi dei commit)
- Repo pinned (max 6)
- README profilo (se esiste un repo con lo stesso nome dello username)
- Sponsor button (se opt-in)
- Stelle date / repo seguiti (visibili a chiunque)

Un **repository** è il contenitore di un progetto. Ha:
- **Visibility**: `public` (chiunque legge, solo collaborator scrivono) · `private` (solo collaborator) · `internal` (org-only, tier Enterprise)
- **Default branch**: il branch mostrato come HEAD (di norma `main`)
- **Settings tab** con decine di opzioni (vedi sotto)
- **Permessi**: per personal repo, solo l'owner e gli "outside collaborator" invitati
- **Topics**: tag liberi (max 20) per la discoverability — es. `nextjs`, `fastify`, `hrms`
- **Social preview**: immagine 1280×640 mostrata quando il link viene condiviso

---

## 2. Modello mentale

```
                  ┌──────────────────────────────────┐
                  │       ACCOUNT  Spen-Zosky        │
                  │  (personal · public profile)     │
                  └────────────┬─────────────────────┘
                               │ owns
            ┌──────────────────┼────────────────────┐
            ▼                  ▼                    ▼
       ┌──────────┐      ┌──────────┐         ┌──────────┐
       │  repo 1  │      │  repo 2  │  ...    │  repo N  │
       │ public   │      │ public   │         │ private  │
       └──────────┘      └──────────┘         └──────────┘
            │
            ▼ contiene
       ┌─────────────────────────────────────┐
       │  Code · Issues · PR · Actions · ... │
       │  Settings (visibility, branches,    │
       │   collaborators, secrets, ...)      │
       └─────────────────────────────────────┘
```

L'account è l'**owner namespace**: l'URL del repo è sempre `github.com/<owner>/<repo>`. Quindi cambiare username cambia tutti gli URL (GitHub crea redirect, ma ad alto rischio se molte cose li referenziano).

---

## 3. Applicato ai nostri repo

| Repo | Visibility | Description | Topics | License | Pages | Issues | Discussions | Wiki |
|---|---|---|---|---|---|---|---|---|
| `Spen-Zosky/heuresys-advanced` | public | ✅ (set) | ❌ vuoto | ❌ assente | ❌ | ✅ on (0 open) | ❌ off | ✅ on (vuota) |
| `Spen-Zosky/ux-design-shared` | public | ✅ (set) | ❌ vuoto | ❌ assente | ✅ workflow | ✅ on (0 open) | ❌ off | ✅ on (vuota) |

Cose da considerare (ordine di priorità, non urgente):

1. **Topics** — vuoti su entrambi. Suggerimento:
   - `heuresys-advanced`: `hrms`, `bpm`, `fastify`, `nextjs`, `postgresql`, `multitenant`, `typescript`
   - `ux-design-shared`: `react`, `design-system`, `tailwindcss`, `radix-ui`, `storybook`, `typescript`
   I topics aiutano la discoverability sul motore di ricerca di GitHub e nelle classificazioni `Explore`.

2. **License** — entrambi non hanno un file `LICENSE`. Conseguenza: di default sono "all rights reserved" (nessun permesso di riuso). Se vuoi mantenerli closed source nonostante siano `public`, ok lasciali così — la `visibility=public` ti dà solo "leggibile da chiunque", non "usabile da chiunque". Se invece in futuro vorrai abilitare contributor esterni o reuse, scegli una licenza (MIT/Apache 2.0/AGPL/proprietary). La doc ufficiale dice esplicitamente: "Without a license, the default copyright laws apply, meaning that you retain all rights to your source code and no one may reproduce, distribute, or create derivative works from your work".

3. **Description + Homepage URL**:
   - `heuresys-advanced`: description già impostata, homepage URL vuoto → potresti puntarlo all'eventuale Storybook quando linkato dal README.
   - `ux-design-shared`: stessa cosa, homepage URL vuoto → impostalo a `https://spen-zosky.github.io/ux-design-shared/` per visibilità immediata del Storybook nella card del repo.

4. **Wiki** — abilitata su entrambi ma vuota. Per i nostri repo non ha senso usarla: la doc vive in `docs/**/*.md` e su Pages (più ricco di Wiki). Si può **disabilitare** dalle settings per non confondere chi naviga.

5. **Profile README** — non esiste `Spen-Zosky/Spen-Zosky`. Se vuoi una bio pubblica con highlight dei progetti, creare un repo con quel nome (stesso del username) e mettere lì un `README.md` che apparirà sulla tua pagina `github.com/Spen-Zosky`. Non urgente, ma è uno dei modi più efficaci per "presentare" i progetti.

---

## 4. Comandi / checklist

```bash
# Vedi tutti i settings rilevanti di un repo
gh api repos/Spen-Zosky/heuresys-advanced \
  --jq '{
    name, description, homepage,
    visibility, default_branch, archived,
    has_issues, has_projects, has_wiki, has_discussions, has_pages,
    allow_forking, allow_squash_merge, allow_merge_commit, allow_rebase_merge,
    delete_branch_on_merge, web_commit_signoff_required,
    license: .license.spdx_id, topics: .topics
  }'

# Imposta topics
gh repo edit Spen-Zosky/heuresys-advanced \
  --add-topic hrms --add-topic bpm --add-topic fastify \
  --add-topic nextjs --add-topic postgresql --add-topic typescript

# Imposta homepage URL
gh repo edit Spen-Zosky/ux-design-shared \
  --homepage https://spen-zosky.github.io/ux-design-shared/

# Disabilita Wiki (se non la usi)
gh repo edit Spen-Zosky/heuresys-advanced --enable-wiki=false

# Aggiungi una licenza (esempio: MIT) → richiede commit
# Crea un file LICENSE in locale, commit, push.
# Oppure usa la web UI: Settings → General → License → "Add a license"
```

```powershell
# Su Windows con PowerShell la sintassi gh è identica
gh repo edit Spen-Zosky/ux-design-shared --add-topic react --add-topic design-system
```

Checklist account (da fare una volta per macchina nuova):

- [ ] `git config --global user.name "Enzo Spenuso"`
- [ ] `git config --global user.email "<email-pubblica-o-no-reply>"`
- [ ] `gh auth login` — autentica gh CLI (scopri quale scope serve)
- [ ] Decidere se `git config --global init.defaultBranch main` (di default è `master` su molte installazioni)
- [ ] Verifica SSH key o HTTPS con PAT — `gh auth status`

Per l'email c'è un compromesso privacy/usability:
- **Email pubblica reale** (`enzo.spenuso@outlook.com`): appare nei commit, chiunque la vede sul tuo profilo se non disabiliti.
- **No-reply GitHub email** (`<numero>+<username>@users.noreply.github.com`): protegge la privacy, ma alcuni servizi (Gravatar, ecc.) non la riconoscono. Si abilita da `Settings → Emails → "Keep my email addresses private"`.

---

## 5. Trappole comuni

- **Cambiare username**: GitHub crea redirect HTTP per le URL del profilo e dei repo, ma **i link ai commit hash specifici non sono redirected** se altri repo li referenziano in modo hardcoded. Pianifica con cura.
- **Trasferire un repo a un'org**: l'operazione mantiene issue, PR, label, ma **gli URL del Pages cambiano** (e i webhooks tornano "Inactive" finché non li riattivi). Pianifica.
- **Username/email del commit ≠ owner del repo**: git è "decentralizzato" sull'identità autore. Se hai committato con `Mario Rossi <mario@example.com>` per errore, il commit appare per sempre con quell'autore anche se è dentro un repo `Spen-Zosky/*`. Fix tipico: `git rebase -i` + amend, ma riscrive la storia (mai su commit pushati condivisi).
- **Repo public con secret committati** anche solo per 5 minuti: GitHub li rileva (secret scanning) e ti avvisa, **ma il secret è già archiviato nei mirror della GitHub Cache + replicato in tutti i fork che potrebbero essere stati creati nel frattempo**. La regola è: **rotare il secret immediatamente**, non basta fare `git rm + force push`.
- **`allow_forking=true`** è il default per i public. Se non vuoi che esistano fork (es. perché contieni asset proprietari sensibili), va disabilitato esplicitamente.

---

## 6. Per approfondire

- **Personal account settings**: <https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github>
- **Repository settings**: <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features>
- **Choose a license**: <https://choosealicense.com/>
- **Profile README**: <https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme>
- Files del curriculum collegati: [glossario](../00-glossario.md) · [03-git-flow.md](03-git-flow.md) · [04-readme-e-markdown.md](04-readme-e-markdown.md)
