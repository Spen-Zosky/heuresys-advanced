#!/usr/bin/env python3
"""costo_chiusura.py — #237 F1: DOVE va il costo di una chiusura di sessione.

LA DOMANDA, posta da Enzo il 2026-08-29: *«l'handoff e' un collo di bottiglia che non
abbiamo mai risolto adeguatamente. Una chiusura sessione non puo' e non deve consumare
il 25% di una finestra di contesto.»* — con un vincolo di metodo che viene prima di
ogni proposta: **non per tentativi**. Percio' questo strumento non cura niente. Misura.

COSA C'ERA PRIMA, e perche' non bastava. Il piano di `#237` riportava un solo numero:
«delta misurato dal guardiano fra l'invocazione della skill handoff e la fine di S1083:
192.430 token (19,2%)» — e accanto, onestamente, l'avvertenza che quel delta **include
lavoro vero** (`#236` F1, la correzione CI) fatto in mezzo alla chiusura. Cioe': il
costo della chiusura PURA non era misurato, ed era il primo buco da chiudere.

LA SCOPERTA CHE RENDE LA MISURA POSSIBILE. Non serve indovinare dove comincia una
chiusura leggendo i prompt: Claude Code **marca alla sorgente** ogni turno prodotto
sotto una skill, col campo `attributionSkill` sul record `assistant`. I turni della
chiusura sono quelli con `attributionSkill == "handoff"`, e sono esatti anche quando
la chiusura e' interrotta a meta' da altro lavoro — che e' precisamente il caso che
falsava il numero di S1083.

COME SI MISURA UN COSTO IN CONTESTO. Ogni record `assistant` porta `message.usage`
con le tre voci che il guardiano gia' somma:

    contesto(turno) = input_tokens + cache_creation_input_tokens + cache_read_input_tokens

E' il contesto OCCUPATO a quel punto della sessione, non il costo del turno. Il costo
di un turno e' quanto ha fatto **crescere** quell'occupazione:

    costo(turno i) = contesto(i+1) - contesto(i)

⚠ Si attribuisce al turno `i` perche' la crescita osservata a `i+1` e' causata da cio'
che il turno `i` ha immesso: il proprio output, e i risultati dei tool che ha chiamato.
Attribuirla a `i+1` sposterebbe ogni costo di un turno, e con esso la categoria.

TRE ONESTA', senza le quali il numero mente:

  1. **L'ultimo turno non e' misurabile.** La sua crescita si vedrebbe nel turno dopo,
     che non c'e'. Si dichiara, non si stima.
  2. **Le crescite negative non si sommano come zero in silenzio.** Un contesto che
     cala e' una compattazione (o un riavvio): si conta a parte e si dichiara. Sommarle
     come zero nasconderebbe proprio l'evento piu' interessante.
  3. **La quota NON ATTRIBUITA si stampa.** E' il controllo di falsificabilita' che il
     piano di `#237` pretende: *«un'analisi che torna per costruzione non dimostra
     niente»*. Se la categoria «altro» divora la tabella, la ripartizione e' sbagliata
     e va rifatta — non interpretata.

E UNA SECONDA MISURA, INDIPENDENTE. La ripartizione per token si confronta con quella
per **byte di contenuto** (il testo dell'assistente + i risultati dei tool che il turno
ha prodotto). Le due grandezze non hanno la stessa unita' e non devono coincidere: se
pero' dicono cose OPPOSTE su quale categoria pesa di piu', una delle due sbaglia, e lo
strumento lo dice invece di scegliere quella che piace.

Uso:
    python docs/kb/tools/costo_chiusura.py               # le ultime 5 chiusure + totale
    python docs/kb/tools/costo_chiusura.py -n 12         # quante sessioni guardare
    python docs/kb/tools/costo_chiusura.py --dettaglio   # anche il costo per turno
    python docs/kb/tools/costo_chiusura.py --csv         # per rimisurare dopo la cura
    python docs/kb/tools/costo_chiusura.py --selftest    # su transcript sintetici
"""
import io
import json
import os
import sys
from pathlib import Path

SKILL_CHIUSURA = "handoff"

# ---------------------------------------------------------------- le categorie
# NASCONO DAL PIANO di #237, che elencava: «scrittura di stato · rigenerazione derivati
# · lint · propagazione · commit/push · verifica». Ne ho aggiunte due che il piano non
# nominava e che i transcript mostrano subito: la LETTURA dello stato (i tre documenti
# grandi si rileggono per emendarli) e la DELIBERAZIONE (turni di solo testo, senza
# nessun tool — il mio ragionamento, che e' l'ipotesi 3 del piano: «il mio stile»).
#
# ⚠ L'ORDINE CONTA: la prima regola che combacia vince. «git commit» dentro un comando
# che tocca anche i derivati e' commit, non rigenerazione — e per questo commit sta
# prima. Cambiare l'ordine cambia i numeri: e' una decisione, non un dettaglio.
STATO = ("SOT_BACKLOG", "SOT_STATE", "DEBT_REGISTER", ".handoff/STATE.md",
         "handoff/STATE", "STATE.md")

REGOLE = [
    # (categoria, tipo-tool, aghi cercati nel comando / path)
    ("propagazione",   "bash", ("close-propagate", "align-clones", "align-claude",
                                "vm-deploy", "clone-vm-db", "verifica-deploy")),
    ("commit e push",  "bash", ("git commit", "git push", "git add", "git tag",
                                "close-log.sh")),
    ("derivati",       "bash", ("build_derivati", "build_atlas", "build_menu",
                                "build_concepts", "build_adr_index",
                                "build_agent_operations")),
    ("cancelli e lint", "bash", ("handoff_lint", "verifica_incrociata", "check_",
                                 "verify_gate", "db_health", "guardiano",
                                 "rendiconto_chiusure", "session_start",
                                 "status_dashboard")),
]


def _classifica(rec):
    """La categoria di UN turno, dai tool che ha davvero chiamato."""
    content = _blocchi(rec)
    usi = [c for c in content if isinstance(c, dict) and c.get("type") == "tool_use"]
    if not usi:
        return "deliberazione (solo testo)"

    testi = []
    for u in usi:
        nome = u.get("name") or ""
        inp = u.get("input") or {}
        blob = " ".join(str(inp.get(k, "")) for k in
                        ("command", "file_path", "path", "pattern", "notebook_path"))
        testi.append((nome, blob))

    for cat, tipo, aghi in REGOLE:
        for nome, blob in testi:
            if tipo == "bash" and nome not in ("Bash", "PowerShell"):
                continue
            b = blob.lower()
            if any(a.lower() in b for a in aghi):
                return cat

    # ------------------------------------------------------------------ lo stato
    # ⚠ SECONDO DIFETTO TROVATO DALLA MISURA (2026-08-29, S1084). La prima versione
    # decideva «stato» solo dal TOOL (Read/Edit/Write), e la categoria residua «altri
    # comandi» divorava il 43% del costo. Guardandoci dentro, era quasi tutta lettura
    # dello stato fatta **via shell**: `cat .handoff/STATE.md`, `head SOT_STATE.md`,
    # `sed -n '971,985p' SOT_BACKLOG.md`, `grep ... SOT_*`. Sono letture dello stato a
    # tutti gli effetti, e chiamarle «altri comandi» rispondeva alla domanda di #237
    # con un'etichetta vuota — cioe' non rispondeva.
    #
    # Un comando shell pero' non dice da se' se legge o scrive. Percio' tre esiti, e
    # il terzo e' dichiarato invece che spalmato sugli altri due: un heredoc python su
    # SOT_STATE.md puo' fare entrambe le cose, e fingere di saperlo sarebbe peggio.
    LETTURA = ("cat ", "head ", "tail ", "sed -n", "grep", "less ", "wc ", "rg ",
               "get-content", "select-string", "read_text", "nl ")
    SCRITTURA = (">", ">>", "tee ", "write_text", "set-content", "add-content",
                 "out-file", "sponge")
    for nome, blob in testi:
        b = blob.lower()
        if not any(s.lower() in b for s in STATO):
            continue
        if nome in ("Edit", "Write", "NotebookEdit"):
            return "scrittura di stato"
        if nome in ("Read", "Grep", "Glob"):
            return "lettura di stato"
        if nome in ("Bash", "PowerShell"):
            if any(v in b for v in SCRITTURA):
                return "scrittura di stato"
            if any(v in b for v in LETTURA):
                return "lettura di stato"
            return "stato via shell (misto)"

    if any(n in ("Edit", "Write", "NotebookEdit") for n, _ in testi):
        return "scrittura (altri file)"
    if any(n in ("Read", "Grep", "Glob") for n, _ in testi):
        return "lettura (altri file)"
    if any(n in ("Bash", "PowerShell") for n, _ in testi):
        return "altri comandi"
    return "altro (non classificato)"


def _contesto(rec):
    u = (rec.get("message") or {}).get("usage") or {}
    try:
        return (int(u.get("input_tokens") or 0)
                + int(u.get("cache_creation_input_tokens") or 0)
                + int(u.get("cache_read_input_tokens") or 0))
    except (TypeError, ValueError):
        return None


def _dir_transcript(cwd=None):
    base = Path.home() / ".claude" / "projects"
    slug = str(Path(cwd or os.getcwd()).resolve()).replace("\\", "-").replace("/", "-")
    slug = slug.replace(":", "-").replace(".", "-")
    d = base / slug
    if d.is_dir():
        return d
    # ripiego: la directory che contiene piu' transcript col nostro nome di progetto
    nome = Path(cwd or os.getcwd()).name.lower()
    cand = [p for p in base.glob("*") if p.is_dir() and nome in p.name.lower()]
    return max(cand, key=lambda p: len(list(p.glob("*.jsonl")))) if cand else d


def _blocchi(rec):
    """I blocchi di contenuto di un turno: uno solo, o quelli fusi da `_turni`."""
    return rec.get("_content") or (rec.get("message") or {}).get("content") or []


def _turni(path):
    """I TURNI di un transcript: un turno = un messaggio, non un record.

    ⚠ DIFETTO REALE, trovato dalla prova di falsificabilita' alla prima misura
    (2026-08-29, S1084). Claude Code scrive **piu' record `assistant` per lo stesso
    messaggio** — uno per blocco di contenuto (il ragionamento, il testo, ogni
    `tool_use`) — e tutti portano **lo stesso `usage`**. Misurato su un transcript
    vero: 1.049 record per 525 messaggi, fino a 6 record per messaggio.

    Contarli come turni distinti falsa tutto: fra due record dello stesso messaggio
    la crescita di contesto e' ZERO, quindi il blocco di testo prendeva 0 token e
    l'intero costo finiva sull'ultimo blocco — di solito il `tool_use`. Il sintomo
    era visibile in tabella: «deliberazione (solo testo)» col 41,9% dei BYTE e il
    3,6% dei token. Le due misure indipendenti dicevano cose opposte, ed e'
    esattamente per questo che ce ne sono due.

    Qui i record si fondono per `message.id` (ripiego su `requestId`): un messaggio,
    un `usage`, tutti i suoi blocchi insieme per deciderne la categoria.
    """
    per_msg, ordine, uuid2msg = {}, [], {}
    risultati = []          # (uuid dell'assistant che l'ha causato, byte)
    try:
        with io.open(path, encoding="utf-8", errors="replace") as fh:
            for l in fh:
                l = l.strip()
                if not l:
                    continue
                if '"toolUseResult"' in l:
                    try:
                        r = json.loads(l)
                    except ValueError:
                        continue
                    src = r.get("sourceToolAssistantUUID")
                    if src:
                        try:
                            by = len(json.dumps(r.get("toolUseResult"),
                                                ensure_ascii=False).encode("utf-8"))
                        except (TypeError, ValueError):
                            by = 0
                        risultati.append((src, by))
                    continue
                if '"assistant"' not in l:
                    continue
                try:
                    r = json.loads(l)
                except ValueError:
                    continue
                if r.get("type") != "assistant" or r.get("isSidechain"):
                    continue
                if _contesto(r) is None:
                    continue
                msg = r.get("message") or {}
                chiave = msg.get("id") or r.get("requestId") or r.get("uuid")
                if r.get("uuid"):
                    uuid2msg[r["uuid"]] = chiave
                if chiave not in per_msg:
                    r = dict(r)
                    r["_content"] = list(msg.get("content") or [])
                    r["_byte_risultati"] = 0
                    per_msg[chiave] = r
                    ordine.append(chiave)
                else:
                    per_msg[chiave]["_content"].extend(msg.get("content") or [])
                    # la skill puo' essere marcata su un solo blocco del messaggio
                    if r.get("attributionSkill") and not per_msg[chiave].get("attributionSkill"):
                        per_msg[chiave]["attributionSkill"] = r["attributionSkill"]
    except OSError:
        return []

    # I RISULTATI DEI TOOL vanno al turno che li ha chiesti.
    # ⚠ Senza questo, la seconda misura non e' un controllo: e' un'altra misura della
    # stessa cosa a meta'. Il comando `cat SOT_STATE.md` pesa 30 byte e ne immette in
    # contesto centomila — e la tabella mostrava «lettura di stato» al 26,8% dei token
    # e al 12,2% dei byte, una divergenza che sembrava un difetto della misura ed era
    # invece il tool_result mancante.
    for src, by in risultati:
        k = uuid2msg.get(src)
        if k in per_msg:
            per_msg[k]["_byte_risultati"] += by

    return [per_msg[k] for k in ordine]


def _peso_contenuto(rec):
    """Byte che il turno immette in contesto: il suo testo, i tool_use, e i RISULTATI."""
    try:
        n = len(json.dumps(_blocchi(rec), ensure_ascii=False).encode("utf-8"))
    except (TypeError, ValueError):
        n = 0
    return n + int(rec.get("_byte_risultati") or 0)


def misura_sessione(path):
    """La chiusura dentro UN transcript: costo per categoria, e cio' che non e' misurabile."""
    turni = _turni(path)
    if not turni:
        return None

    per_cat = {}          # categoria -> [token, byte, n_turni]
    tot_tok = tot_byte = 0
    n_chiusura = 0
    non_misurabili = 0    # turni di chiusura senza un turno successivo
    negativi = []         # crescite negative: compattazioni, dichiarate a parte
    dettaglio = []

    for i, r in enumerate(turni):
        if r.get("attributionSkill") != SKILL_CHIUSURA:
            continue
        n_chiusura += 1
        if i + 1 >= len(turni):
            non_misurabili += 1
            continue
        d = _contesto(turni[i + 1]) - _contesto(r)
        if d < 0:
            negativi.append(d)
            continue
        cat = _classifica(r)
        by = _peso_contenuto(r)
        v = per_cat.setdefault(cat, [0, 0, 0])
        v[0] += d
        v[1] += by
        v[2] += 1
        tot_tok += d
        tot_byte += by
        dettaglio.append(((r.get("timestamp") or "")[11:19], cat, d, by))

    if not n_chiusura:
        return None
    return {
        "file": os.path.basename(path),
        "quando": (turni[-1].get("timestamp") or "")[:16].replace("T", " "),
        "turni_chiusura": n_chiusura,
        "turni_sessione": len(turni),
        "per_cat": per_cat,
        "token": tot_tok,
        "byte": tot_byte,
        "non_misurabili": non_misurabili,
        "negativi": negativi,
        "ctx_finale": _contesto(turni[-1]),
        "dettaglio": dettaglio,
    }


def dedup(misure):
    """Toglie la STESSA chiusura vista da due transcript. Ritorna (tenute, scartate).

    ⚠ TERZO DIFETTO TROVATO DALLA MISURA (2026-08-29). Nella prima tabella comparivano
    due coppie con numeri identici al singolo token — `35b5e4c0`/`ef9b5eae` (28 turni,
    37.855) e `8f1b3cb3`/`94a7ef73` (21 turni, 14.504). I file NON sono identici (2.422
    righe contro 3.157): sono il **fork o la ripresa** di una stessa sessione, che si
    portano dietro la medesima coda di chiusura. Contarle due volte gonfia il peso di
    quelle chiusure nella media, cioe' falsa proprio il numero che #237 vuole vedere.

    La regola e' meccanica: stesso numero di turni di chiusura E stesso totale di token
    al singolo token = la stessa chiusura. Due chiusure diverse che coincidano cosi'
    non sono impossibili, sono trascurabili — e comunque lo strumento **dichiara**
    quante ne ha fuse, invece di farlo in silenzio.
    """
    visti, tenute, scartate = set(), [], []
    for m in misure:
        k = (m["turni_chiusura"], m["token"])
        (scartate if k in visti else tenute).append(m)
        visti.add(k)
    return tenute, scartate


def _tabella(per_cat, tot_tok, tot_byte):
    righe = sorted(per_cat.items(), key=lambda kv: -kv[1][0])
    print(f"  {'categoria':<28}{'token':>10}{'%':>7}{'turni':>7}"
          f"{'byte':>11}{'% byte':>8}   segnale")
    print("  " + "-" * 78)
    for cat, (tok, by, n) in righe:
        qt = 100.0 * tok / tot_tok if tot_tok else 0.0
        qb = 100.0 * by / tot_byte if tot_byte else 0.0
        # il confronto fra le due misure: se divergono di molto, lo si vede a occhio
        segn = "  " if abs(qt - qb) < 12 else "<>"
        print(f"  {cat:<28}{tok:>10,}{qt:>6.1f}%{n:>7}{by:>11,}{qb:>7.1f}%   {segn}")
    print("  " + "-" * 78)
    print(f"  {'TOTALE':<28}{tot_tok:>10,}{100.0:>6.1f}%"
          f"{sum(v[2] for v in per_cat.values()):>7}{tot_byte:>11,}{100.0:>7.1f}%")


def main(argv):
    n = 5
    if "-n" in argv:
        try:
            n = int(argv[argv.index("-n") + 1])
        except (IndexError, ValueError):
            pass
    d = _dir_transcript()
    if not d.is_dir():
        print(f"NON MISURABILE: nessuna directory di transcript in {d}")
        return 2

    files = sorted(d.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    misure = []
    for p in files:
        m = misura_sessione(p)
        if m:
            misure.append(m)
        if len(misure) >= n:
            break

    if not misure:
        print(f"NON MISURABILE: nessuna chiusura marcata `{SKILL_CHIUSURA}` in {d}")
        return 2

    print("=" * 80)
    print(" COSTO DELLA CHIUSURA — #237 F1 · misurato dal transcript, non stimato")
    print("=" * 80)
    print(f" fonte: {d}")
    print(f" turni di chiusura = quelli marcati `attributionSkill: {SKILL_CHIUSURA}`")
    print(f" costo di un turno = crescita del contesto fino al turno successivo\n")

    misure, doppie = dedup(misure)
    print(f"  {'sessione':<12}{'quando':<18}{'turni':>6}{'token':>11}"
          f"{'% di 1M':>9}   su {'tot turni':>9}")
    print("  " + "-" * 78)
    for m in misure:
        q = 100.0 * m["token"] / 1_000_000
        print(f"  {m['file'][:8]:<12}{m['quando']:<18}{m['turni_chiusura']:>6}"
              f"{m['token']:>11,}{q:>8.1f}%   {m['turni_sessione']:>9}")
    for m in doppie:
        print(f"  {m['file'][:8]:<12}{m['quando']:<18}   — stessa chiusura di una"
              f" sopra (fork/ripresa), esclusa")

    agg, tot_tok, tot_byte = {}, 0, 0
    nm = neg = 0
    for m in misure:
        for cat, (tok, by, k) in m["per_cat"].items():
            v = agg.setdefault(cat, [0, 0, 0])
            v[0] += tok
            v[1] += by
            v[2] += k
        tot_tok += m["token"]
        tot_byte += m["byte"]
        nm += m["non_misurabili"]
        neg += len(m["negativi"])

    print(f"\n RIPARTIZIONE — {len(misure)} chiusure aggregate\n")
    _tabella(agg, tot_tok, tot_byte)

    medio = tot_tok / len(misure)
    print(f"\n  chiusura PURA, media su {len(misure)} sessioni: "
          f"{medio:,.0f} token = {100.0 * medio / 1_000_000:.1f}% di una finestra da 1M")

    print("\n CIO' CHE QUESTA MISURA NON DICE (dichiarato, non nascosto)")
    non_cl = agg.get("altro (non classificato)", [0, 0, 0])[0]
    qn = 100.0 * non_cl / tot_tok if tot_tok else 0.0
    print(f"  · turni non classificati: {qn:.1f}% del totale"
          + ("  ← se cresce, la ripartizione e' da rifare" if qn > 10 else ""))
    print(f"  · turni senza un successivo (costo non osservabile): {nm}")
    print(f"  · crescite negative (compattazione o riavvio), escluse: {neg}")
    print(f"  · chiusure escluse perche' duplicate (fork/ripresa): {len(doppie)}")
    print("  · il costo del LAVORO fatto in mezzo a una chiusura resta fuori:"
          " e' proprio la\n    confusione che rendeva falso il 19,2% di S1083.")
    print("  · `<>` = le due misure divergono di oltre 12 punti su quella riga."
          " Su `scrittura\n    di stato` la divergenza e' ATTESA e non e' un difetto:"
          " il transcript salva per\n    ogni Edit anche `oldString`/`newString`/"
          "`structuredPatch`, che pesano in byte\n    ma in contesto non entrano."
          " Altrove, un `<>` va guardato.")

    if "--dettaglio" in argv:
        for m in misure:
            print(f"\n --- {m['file'][:8]} · {m['quando']}")
            for ts, cat, tok, by in m["dettaglio"]:
                print(f"   {ts}  {cat:<28}{tok:>9,} tok{by:>10,} B")

    if "--csv" in argv:
        print("\nCSV")
        print("sessione,quando,categoria,token,byte,turni")
        for m in misure:
            for cat, (tok, by, k) in sorted(m["per_cat"].items()):
                print(f"{m['file'][:8]},{m['quando']},{cat},{tok},{by},{k}")
    return 0


# --------------------------------------------------------------------- selftest
_SEQ = [0]


def _rec(ctx, skill=None, tool=None, cmd="", testo="x", ts="2026-08-29T10:00:00Z",
         mid=None):
    """Un record assistant sintetico. `mid` uguale su piu' record = stesso messaggio."""
    content = ([{"type": "tool_use", "name": tool,
                 "input": {"command": cmd} if tool in ("Bash", "PowerShell")
                 else {"file_path": cmd}}]
               if tool else [{"type": "text", "text": testo}])
    if mid is None:
        _SEQ[0] += 1
        mid = f"msg_{_SEQ[0]}"
    r = {"type": "assistant", "isSidechain": False, "timestamp": ts,
         "message": {"id": mid, "content": content,
                     "usage": {"input_tokens": 0, "cache_creation_input_tokens": 0,
                               "cache_read_input_tokens": ctx}}}
    if skill:
        r["attributionSkill"] = skill
    return r


def selftest():
    """Costruisce transcript SINTETICI: i numeri attesi sono noti a priori.

    Il caso che conta non e' «gira»: e' che un turno di LAVORO in mezzo alla chiusura
    NON venga contato: e' l'errore preciso che rendeva falso il 19,2% di S1083.
    """
    import tempfile
    ko = 0

    def scrivi(recs):
        fh = tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False,
                                         encoding="utf-8")
        for r in recs:
            fh.write(json.dumps(r) + "\n")
        fh.close()
        return fh.name

    def prova(nome, recs, att_tok, att_cat=None, att_nm=None, att_neg=None):
        nonlocal ko
        p = scrivi(recs)
        m = misura_sessione(p)
        os.unlink(p)
        got = (m or {}).get("token")
        ok = got == att_tok
        if att_cat is not None:
            ok = ok and set((m or {}).get("per_cat", {})) == set(att_cat)
        if att_nm is not None:
            ok = ok and (m or {}).get("non_misurabili") == att_nm
        if att_neg is not None:
            ok = ok and len((m or {}).get("negativi", [])) == att_neg
        ko += 0 if ok else 1
        cats = sorted((m or {}).get("per_cat", {}))
        print(f"  [{'OK' if ok else '!!'}] {nome}\n        token {got} (atteso {att_tok})"
              f" · categorie {cats}")

    # 1. il caso base: due turni di chiusura, crescita nota
    prova("chiusura semplice: 100->300->700 = 600 token",
          [_rec(100, "handoff", "Bash", "git commit -m x"),
           _rec(300, "handoff", "Edit", "docs/kb/SOT_STATE.md"),
           _rec(700)],
          600, {"commit e push", "scrittura di stato"})

    # 2. IL CASO CHE CONTA: lavoro vero in mezzo, non deve entrare
    prova("lavoro NON marcato in mezzo: i suoi 5000 token restano fuori",
          [_rec(100, "handoff", "Bash", "git add ."),
           _rec(200),                                   # +5000 = lavoro, escluso
           _rec(5200, "handoff", "Bash", "bash scripts/close-propagate.sh"),
           _rec(5300)],
          200, {"commit e push", "propagazione"})

    # 3. l'ultimo turno non e' misurabile e si DICHIARA
    prova("ultimo turno della sessione: non misurabile, dichiarato",
          [_rec(100, "handoff", "Bash", "git commit -m x"),
           _rec(400, "handoff", "Bash", "python docs/kb/tools/build_derivati.py")],
          300, {"commit e push"}, att_nm=1)

    # 4. una crescita negativa (compattazione) non si somma come zero
    prova("compattazione: crescita negativa esclusa e contata a parte",
          [_rec(9000, "handoff", "Bash", "git push"),
           _rec(500, "handoff", "Edit", "docs/kb/SOT_BACKLOG.md"),
           _rec(900)],
          400, {"scrittura di stato"}, att_neg=1)

    # 5. nessuna chiusura -> nessuna misura inventata
    prova("sessione senza chiusura: None, non uno zero rassicurante",
          [_rec(100), _rec(500)], None)

    # 6. l'ordine delle regole e' una decisione, e si prova
    p = scrivi([_rec(0, "handoff", "Bash",
                     "python docs/kb/tools/build_derivati.py && git commit -m x"),
                _rec(10)])
    cat = sorted(misura_sessione(p)["per_cat"])
    os.unlink(p)
    ok6 = cat == ["commit e push"]
    ko += 0 if ok6 else 1
    print(f"  [{'OK' if ok6 else '!!'}] derivati+commit nello stesso comando -> "
          f"commit vince (ordine REGOLE)\n        categorie {cat}")

    # 7. lettura e scrittura dello stesso file NON sono la stessa categoria
    p = scrivi([_rec(0, "handoff", "Read", "docs/kb/SOT_BACKLOG.md"),
                _rec(10, "handoff", "Write", "docs/kb/SOT_BACKLOG.md"),
                _rec(30)])
    cat = sorted(misura_sessione(p)["per_cat"])
    os.unlink(p)
    ok7 = cat == ["lettura di stato", "scrittura di stato"]
    ko += 0 if ok7 else 1
    print(f"  [{'OK' if ok7 else '!!'}] stesso file, Read vs Write -> due categorie"
          f"\n        categorie {cat}")

    # 8. IL DIFETTO TROVATO DALLA PROVA: piu' record, UN messaggio, UN usage.
    #    Senza la fusione, il blocco di testo prende 0 token e il tool_use tutto:
    #    la categoria diventa «commit e push» e la deliberazione sparisce dai token.
    p = scrivi([_rec(0, "handoff", None, testo="rifletto", mid="M1"),
                _rec(0, "handoff", "Bash", "git commit -m x", mid="M1"),
                _rec(900)])
    m = misura_sessione(p)
    os.unlink(p)
    ok8 = (m["token"] == 900 and m["turni_chiusura"] == 1
           and sorted(m["per_cat"]) == ["commit e push"])
    ko += 0 if ok8 else 1
    print(f"  [{'OK' if ok8 else '!!'}] 2 record + 1 messaggio -> UN turno da 900, "
          f"non due\n        turni {m['turni_chiusura']} · token {m['token']} · "
          f"categorie {sorted(m['per_cat'])}")

    # 9. e il contrario: due messaggi distinti restano due turni
    p = scrivi([_rec(0, "handoff", None, testo="rifletto", mid="A"),
                _rec(400, "handoff", "Bash", "git commit -m x", mid="B"),
                _rec(900)])
    m = misura_sessione(p)
    os.unlink(p)
    ok9 = (m["turni_chiusura"] == 2
           and m["per_cat"].get("deliberazione (solo testo)", [0])[0] == 400)
    ko += 0 if ok9 else 1
    print(f"  [{'OK' if ok9 else '!!'}] 2 messaggi distinti -> 2 turni, la "
          f"deliberazione tiene i suoi 400\n        turni {m['turni_chiusura']} · "
          f"per_cat { {k: v[0] for k, v in m['per_cat'].items()} }")

    # 10-12. IL SECONDO DIFETTO: lo stato letto via shell non e' «altri comandi».
    for nome, cmd, atteso in [
        ("`cat .handoff/STATE.md` e' lettura di stato",
         "cat .handoff/STATE.md", "lettura di stato"),
        ("un redirect su SOT_BACKLOG e' scrittura di stato",
         "python x.py > docs/kb/SOT_BACKLOG.md", "scrittura di stato"),
        ("un heredoc su SOT_STATE e' MISTO, e si dichiara",
         "python - <<'PY'\np='docs/kb/SOT_STATE.md'\nPY", "stato via shell (misto)"),
    ]:
        p = scrivi([_rec(0, "handoff", "Bash", cmd), _rec(10)])
        cat = sorted(misura_sessione(p)["per_cat"])
        os.unlink(p)
        ok = cat == [atteso]
        ko += 0 if ok else 1
        print(f"  [{'OK' if ok else '!!'}] {nome}\n        categorie {cat}")

    # 13. e un comando che NON nomina lo stato resta fuori da quelle categorie
    p = scrivi([_rec(0, "handoff", "Bash", "cat package.json"), _rec(10)])
    cat = sorted(misura_sessione(p)["per_cat"])
    os.unlink(p)
    ok13 = cat == ["altri comandi"]
    ko += 0 if ok13 else 1
    print(f"  [{'OK' if ok13 else '!!'}] un file qualunque NON diventa stato"
          f"\n        categorie {cat}")

    # 14-15. la dedup delle chiusure viste due volte, e il caso in cui NON deve scattare
    a = {"turni_chiusura": 28, "token": 37855, "file": "a"}
    b = {"turni_chiusura": 28, "token": 37855, "file": "b"}
    c = {"turni_chiusura": 28, "token": 37856, "file": "c"}
    t, s = dedup([a, b, c])
    ok14 = len(t) == 2 and len(s) == 1 and s[0]["file"] == "b"
    ko += 0 if ok14 else 1
    print(f"  [{'OK' if ok14 else '!!'}] due chiusure identiche -> una sola tenuta"
          f"\n        tenute {[x['file'] for x in t]} · scartate {[x['file'] for x in s]}")
    t, s = dedup([a, c])
    ok15 = len(t) == 2 and not s
    ko += 0 if ok15 else 1
    print(f"  [{'OK' if ok15 else '!!'}] UN token di differenza -> due chiusure diverse"
          f"\n        tenute {[x['file'] for x in t]} · scartate {[x['file'] for x in s]}")

    tot = 15
    print(f"\n  {tot - ko}/{tot} casi verdi")
    return 1 if ko else 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        raise SystemExit(selftest())
    raise SystemExit(main(sys.argv[1:]))
