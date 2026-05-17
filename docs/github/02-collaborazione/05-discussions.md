# 02.5 · Discussions

> GitHub Discussions è un **forum integrato** nel repo: Q&A, idee, annunci, "show and tell". Non è disabilitato per default — va attivato esplicitamente. Distingue conversazione (Discussions) da work item (Issues).

---

## 1. Concetto

Una **Discussion** è un thread strutturato in **categorie**, con:

- **Categoria** (definita dal repo owner): Announcements, Q&A, Ideas, General, Show and tell, Polls.
- **Format** per categoria: open-ended discussion / Q&A (con marked answer) / announcement (solo maintainer).
- **Body GFM**, comments threaded (a differenza di Issues che sono flat).
- **Reactions** + sub-thread di reply.
- **Marked as answer** (solo Q&A): un comment può essere segnato come la risposta definitiva.
- **Pin**: discussion in cima (max 4 per repo).
- **Convert from Issue**: trasforma una Issue in Discussion se è "discussione" e non "task".

### Discussions vs Issues — la differenza

| | Issues | Discussions |
|---|---|---|
| **Scopo** | Work item: bug, feature, task | Conversazione: domanda, idea, annuncio |
| **Stato** | open/closed (definito) | nessuno stato — "permane" |
| **Workflow** | Triage → assign → close | Risposta + reaction, eventuale answer marked |
| **Linkable a PR** | Sì (auto-close) | No (solo riferimento manuale) |
| **Notifiche** | Aggressive (subscribe automatico) | Opt-in (subscribe esplicito a una categoria) |
| **Default attivo** | Sì | No (`has_discussions: false`) |

Quando preferire Discussions:
- Domanda generica senza un'azione precisa ("Come configurate X?").
- Idea/proposta da discutere prima di formalizzarla in Issue.
- Annunci di release/breaking change.
- Mostrare uno use case interessante della tua libreria.

Quando preferire Issues:
- Bug riproducibile.
- Feature request con scope chiaro.
- Task tracciabile.

---

## 2. Modello mentale

```
       ┌────────────────────────────────────────────┐
       │             REPOSITORY                     │
       │                                            │
       │   Issues          Discussions              │
       │   ──────          ───────────              │
       │   #42 bug         #15 (Q&A)  ← marked      │
       │   #41 feat               answer            │
       │   #40 (closed)    #14 (Announcement) ← pin │
       │                   #13 (Ideas)              │
       │                   #12 (Show and tell)      │
       │                                            │
       │   PR #45 ─ closes #42                      │
       │                                            │
       │   Discussion #15 → riferimento manuale     │
       │     "see #15 for context"                  │
       └────────────────────────────────────────────┘
```

Issues e Discussions condividono il **namespace numerico**: `#15` può essere un'issue, un PR o una discussion. Ma sono visualizzate in tab separati.

### Categorie default (template GitHub)

| Categoria | Format | Esempio |
|---|---|---|
| **Announcements** | Solo maintainer pubblicano | "v2.0 released" |
| **Q&A** | Domanda + risposte, marked answer | "Come integrare X con Y?" |
| **Ideas** | Open-ended, voting via reactions | "Aggiungere supporto dark mode" |
| **General** | Open-ended | Conversazione varia |
| **Show and tell** | Show off di use cases | "Look at this dashboard I built" |
| **Polls** | Voting strutturato | "Preferisci PostgreSQL o MySQL?" |

Puoi creare categorie custom + cambiare ordine/visibilità.

---

## 3. Applicato ai nostri repo

### Stato attuale: **disabilitato su entrambi**

`has_discussions: false`. Per ora ha senso così:
- Sei sole-coder; nessuna conversazione da avere con esterni.
- Il knowledge base vive in `docs/**`, `HANDOFF.md`, `MEMORY.md`, `NEXT_SESSION_*.md`.

### Quando attivarle

1. **Pubblichi un'API/SDK riutilizzabile da terzi** (es. `@spen-zosky/ui` su npm). Le domande "come uso X?" arrivano. Q&A categorica le organizza.
2. **Vuoi aprire il progetto ai contributor**: Discussions è il primo touchpoint (Issues si attiverebbero solo dopo che sa cosa segnalare).
3. **Vuoi documentare decisioni "soft"**: invece di un ADR formale per ogni microdecisione, una Discussion in "Ideas" può servire come traccia.

### Setup minimo (se decidi di attivarle un giorno)

1. `Settings → General → Features → Discussions: enabled`.
2. La prima discussion aperta forza la scelta di una categoria di default; puoi customizzare dopo.
3. Aggiungi link al README: "Hai una domanda? Apri una [Discussion](https://github.com/Spen-Zosky/<repo>/discussions)".

Categorie suggerite custom per i nostri due repo (se attivassi):

`heuresys-advanced`:
- Architecture Q&A (Q&A format)
- MVP roadmap discussion (Ideas)
- Migration notes (Announcements)

`ux-design-shared`:
- Component requests (Ideas)
- Storybook usage (Q&A)
- Theming questions (Q&A)
- Release notes (Announcements)

### Decisione consigliata oggi: **non attivare**

Discussions ha senso quando esiste un audience. Per ora siamo a zero esterni. Riserva la decisione a quando arriva il primo PR esterno o la prima Issue da utente non-tuo.

---

## 4. Comandi / checklist

### Web UI

```
Repo → Settings → General → Features → ✓ Discussions
Repo → Discussions tab → New discussion → Choose category
Discussion → "⋮" menu → Convert to Issue (se diventa actionable)
Issue → "⋮" menu → Convert to Discussion (se è solo conversazione)
```

### CLI

```bash
# Lista
gh api repos/Spen-Zosky/heuresys-advanced/discussions \
  --jq '.[] | {number, title, category: .category.name, comments: .comments}'

# View
gh api repos/Spen-Zosky/heuresys-advanced/discussions/1

# Crea (richiede GraphQL — gh CLI non ha shortcut diretto)
gh api graphql -f query='
  mutation {
    createDiscussion(input: {
      repositoryId: "REPO_GLOBAL_ID",
      categoryId: "CATEGORY_GLOBAL_ID",
      title: "Domanda di prova",
      body: "Body markdown..."
    }) {
      discussion { number url }
    }
  }
'
```

> Il GraphQL ID del repo si ottiene con `gh api repos/Spen-Zosky/heuresys-advanced --jq .node_id`. Le categorie hanno ID propri ottenibili via GraphQL `discussionCategories`.

### Categorie via API

```bash
gh api graphql -f query='
  query {
    repository(owner: "Spen-Zosky", name: "heuresys-advanced") {
      discussionCategories(first: 10) {
        nodes { id name slug emoji }
      }
    }
  }
'
```

### Checklist primo setup

- [ ] Decidi se vale la pena attivarle ora (di solito no, per sole-coder)
- [ ] Se sì: 4-6 categorie max
- [ ] Pin 1 discussion "Welcome / How to ask" come introduzione
- [ ] Link nel README + CONTRIBUTING

---

## 5. Trappole comuni

- **Cannibalizzazione con Issues**: utenti aprono Discussions per cose actionable. Trasforma in Issue ("Convert to Issue") senza esitare.
- **Categoria sbagliata** → riduce findability. Cambiala via menu "⋮ → Move to category".
- **Q&A senza marked answer**: la categoria Q&A perde valore se nessun comment è marked come answer. Riserva quel tempo.
- **Polls limitate**: le Polls hanno max 8 opzioni, niente multi-choice avanzata. Per survey vere, usa Google Forms / Typeform.
- **Notifiche silenziose**: a differenza degli Issue, Discussions non ti aggiunge come "subscribed" di default — devi cliccare `Subscribe` esplicitamente per ricevere notifiche.
- **Discussion archive**: non esiste un vero stato "closed/archived" come per Issue. Puoi solo `Lock` per impedire nuovi comment. Visivamente resta "live".

---

## 6. Per approfondire

- **About Discussions**: <https://docs.github.com/en/discussions/collaborating-with-your-community-using-discussions/about-discussions>
- **Discussion vs Issues** (decision guide): <https://docs.github.com/en/discussions/collaborating-with-your-community-using-discussions/best-practices-for-community-conversations-on-github>
- **GraphQL Discussions API**: <https://docs.github.com/en/graphql/reference/objects#discussion>
- File curriculum: [01-issues.md](01-issues.md) · [03-pull-requests.md](03-pull-requests.md)
