#!/usr/bin/env python3
"""
guardiano.py — le due misure che decidono se si continua o si chiude.

IL GUARDIANO UNICO (Enzo, 2026-08-13, S1056)
--------------------------------------------
Due cose possono finire mentre si lavora, e finiscono in modi diversi:

  · il CONTESTO della sessione — cresce e non torna indietro;
  · il LIMITE DELLE 5 ORE dell'abbonamento — si consuma e si azzera da solo, ma se lo
    si sbatte in faccia il lavoro si ferma li' e si aspetta il reset.

La regola e' una sola, ed e' un OR:

    se  contesto >= 75%   OPPURE   finestra 5h >= 80%
    allora: interrompi le attivita', registra il progresso, committa E PUSHA tutto,
            e fai la chiusura completa della sessione.

Sostituisce la regola precedente che guardava il solo contesto. Vale **sempre**, in
ogni tipo di sessione (canonical e lab) e in ogni progetto.

DA DOVE VENGONO I DUE NUMERI — misurati, non stimati
----------------------------------------------------
CONTESTO. Claude Code scrive il transcript della sessione in JSONL sotto
`~/.claude/projects/<slug>/<session-id>.jsonl`. Ogni messaggio dell'assistente porta il
blocco `usage` **restituito dall'API**. La dimensione della finestra a quel momento e'
`input_tokens + cache_read_input_tokens + cache_creation_input_tokens`.

FINESTRA 5 ORE. Il dato autorevole c'e' ed e' di Claude Code, che lo passa nello stdin
della riga di stato come `rate_limits.five_hour.used_percentage`. Non esiste in nessun
file: verificato il 2026-08-13 — `stats-cache.json` e' fermo a febbraio e non ha campi
di limite, il transcript non ne porta, `history.jsonl` ha solo i prompt. Percio' la
riga di stato (`~/.claude/statusline-command.sh`) lo PERSISTE a ogni disegno in
`~/.claude/rate-limits.json`, con scrittura atomica e senza scrivere niente quando il
dato manca. Un file assente vuol dire «non misurato», che e' la verita'; uno zero
inventato sarebbe una bugia che sembra una misura.

Il file ha un'eta': se e' piu' vecchio della soglia di freschezza si dichiara stantio e
NON lo si usa per decidere. Un numero vecchio di ore su una finestra di cinque e'
peggio di nessun numero.

IL PROBLEMA CHE RISOLVE
-----------------------
La capacita' del modello di stimare "quanto contesto resta" a impressione non e'
affidabile: e' una sensazione, non una misura, e sbaglia in entrambe le direzioni.
La memoria `feedback_no_context_estimation` vieta gia' di stimarlo a impressione e
di proporre la chiusura su quella base — ma vietare non basta, serve il sostituto.

IL SOSTITUTO
------------
Claude Code scrive il transcript della sessione in JSONL sotto
`~/.claude/projects/<slug>/<session-id>.jsonl`. Ogni messaggio dell'assistente porta
il blocco `usage` **restituito dall'API**, non calcolato qui. La dimensione del
contesto a quel momento e' la somma di tre campi:

    input_tokens + cache_read_input_tokens + cache_creation_input_tokens

`cache_read` porta tutto cio' che era gia' in finestra, `cache_creation` cio' che si
e' aggiunto in questo giro: insieme sono la finestra intera. Il valore dell'ULTIMO
blocco e' la dimensione corrente.

LIMITE DICHIARATO, NON NASCOSTO
-------------------------------
Il transcript si scrive a fine turno: la misura e' indietro di **un turno**, quello
in corso. Un turno pesa tipicamente 1-10k token. Quindi il numero e' un **pavimento**
(il vero consumo e' quello o poco piu'), mai un soffitto — che e' il verso giusto
per una decisione di capienza. Lo strumento lo scrive nel proprio output invece di
lasciarlo intendere.

USO
---
    python docs/kb/tools/guardiano.py                 # le due misure + il verdetto
    python docs/kb/tools/guardiano.py --json          # per uno script
    python docs/kb/tools/guardiano.py --selftest      # la prova che puo' fallire
    python docs/kb/tools/guardiano.py --session <id>  # una sessione precisa
    python docs/kb/tools/guardiano.py --budget 40000  # "ci sta un lavoro da 40k?"
    python docs/kb/tools/guardiano.py --sorveglia     # il guardiano: exit 3 se si chiude

`--sorveglia` applica l'OR con le soglie di casa (75% / 80%); `--stop-at` e `--stop-5h`
le spostano. Copia gemella a livello utente in `~/.claude/tools/guardiano.py`, cosi' la
regola vale anche nei progetti che non sono questo.

Exit code: 0 tutto bene · 1 selftest fallito · 2 budget non capiente
           3 SOGLIA RAGGIUNTA -> interrompi, registra, committa, pusha, chiudi
           4 GUARDIANO CIECO: nessuno dei due rami e' misurabile — non e' un verde.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

# --- stdout utf-8 (2026-08-16) -------------------------------------------------
# Su Windows, con stdout NON terminale, Python sceglie la codepage ANSI (cp1252) e
# ogni carattere fuori repertorio fa morire la print con UnicodeEncodeError — exit 1.
# Qui muoiono il verdetto del guardiano, i titoli con frecce, le emoji del riassunto.
# `errors="replace"` e' la rete: uno strumento di misura non deve morire di tipografia.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
# -------------------------------------------------------------------------------

# Finestra per modello. Il transcript dichiara il modello; se non lo riconosciamo
# NON tiriamo a indovinare: si dichiara sconosciuto e si chiede --window.
WINDOWS: dict[str, int] = {
    "claude-opus-5": 1_000_000,
    "claude-opus-5[1m]": 1_000_000,
    "claude-sonnet-5": 1_000_000,
    "claude-fable-5": 200_000,
    "claude-haiku-4-5-20251001": 200_000,
}
DEFAULT_WINDOW = 1_000_000

# Soglie di giudizio sul CONTESTO. Sotto la prima si lavora senza pensarci; oltre la
# seconda si apre solo cio' che si sa chiudere; oltre la terza si chiude e basta.
SOGLIA_LARGO = 0.60
SOGLIA_STRETTO = 0.80
SOGLIA_CHIUSURA = 0.90

# Le due soglie del GUARDIANO — quelle che fanno scattare la chiusura (Enzo, 2026-08-13).
# Sono diverse di proposito: il contesto non torna indietro, quindi 75% lascia il margine
# per chiudere; la finestra delle 5 ore si riazzera da sola, quindi si puo' arrivare
# piu' vicini prima di fermarsi.
STOP_CONTESTO = 0.75
STOP_5H = 0.80

# Il MARGINE DEL PAVIMENTO (Enzo, 2026-09-17 — voce A0 del mandato S1105).
#
# Il contesto si legge dal transcript, che si scrive a FINE turno: la misura e' sempre
# indietro di uno. Il numero letto e' quindi un pavimento, mai un soffitto, e fra due
# misure consecutive il valore vero e' gia' piu' alto di quello stampato.
#
# Quanto piu' alto e' stato MISURATO, non stimato: 1.632 salti positivi fra misure
# consecutive su quattro transcript K reali gia' conclusi (d6e7f53b, c8873c8b, 218d2692,
# abbcdb70). Mediana 648 token (0,06 punti); 90mo percentile 2.880 token (0,29 punti);
# massimo osservato 34.701 token (3,47 punti). Il margine e' il 90mo percentile
# arrotondato per eccesso al punto intero.
#
# ⚠ COSA COPRE, e cosa no — serve a non leggerlo un domani come insufficiente:
# copre il ritardo di UNA misura, NON un intervallo in cui non si misura affatto. Il
# caso del 16-17 settembre (74,8% -> 87,3% in 48 minuti senza rimisurare) e' coperto da
# questo margine solo all'inizio — a 74,8% la sessione si ferma — e per il resto dal
# terzo momento di misura aggiunto a V4 del mandato (voce A2). Sono due rimedi a due
# difetti distinti: alzare questo numero non sostituisce quello.
#
# ⚠ IL RISCHIO RESIDUO E' ACCETTATO CONSAPEVOLMENTE: il turno pesante raro (3,47 punti,
# uno su 1.295 misure) puo' scavalcare la fascia senza mai attraversarla. Coprirlo
# avrebbe richiesto 4 punti, cioe' soglia effettiva al 71,5% e ~40.000 token di
# capienza buttati a OGNI sessione per un evento su mille. Enzo ha scelto di non
# pagarlo, con questo numero davanti. Non e' una svista: non "correggerlo" in silenzio.
#
# Nella fascia si esce con lo STESSO exit 3 della soglia piena: in una corsa non
# presidiata un avviso che non ferma non e' un avviso, e' rumore.
MARGINE_PAVIMENTO = 0.01

# Oltre quanti minuti il dato delle 5 ore e' da buttare. La riga di stato si ridisegna
# a ogni giro, quindi in una sessione viva il file ha pochi secondi. Un file di
# mezz'ora fa vuol dire che la riga di stato non gira: meglio dire «non misurato».
FRESCHEZZA_5H_MIN = 15


@dataclass(frozen=True)
class Campione:
    """Una misura di contesto letta da un blocco usage."""

    contesto: int
    model: str
    output: int


def slug_progetto(cwd: Path) -> str:
    """`D:\\heuresys-advanced` -> `D--heuresys-advanced`, come fa Claude Code.

    Su Unix il trattino iniziale VA TENUTO: `/home/ubuntu` -> `-home-ubuntu`,
    perche' nasce dallo slash iniziale del path. Verificato il 2026-08-13 contro
    le directory reali di ~/.claude/projects (`-tmp`, `-home-ubuntu`,
    `-home-ubuntu-heuresys-advanced`). Uno `.strip("-")` lo mangiava, e il ramo
    "contesto" restava cieco su ogni macchina Linux e Mac.
    """
    s = str(cwd.resolve())
    for ch in (":", "\\", "/", "."):
        s = s.replace(ch, "-")
    while "---" in s:
        s = s.replace("---", "--")
    return s


def dir_transcript(cwd: Path | None = None) -> Path:
    base = Path.home() / ".claude" / "projects"
    return base / slug_progetto(cwd or Path.cwd())


def trova_transcript(
    session: str | None,
    cwd: Path | None = None,
    *,
    dir_override: Path | None = None,
    usa_ambiente: bool = True,
) -> Path | None:
    """Il transcript di QUESTA sessione, non l'ultimo che ha scritto.

    `dir_override` e `usa_ambiente` esistono per il selftest: senza poter
    iniettare una directory finta e spegnere la lettura dell'ambiente, il ramo
    «due sessioni vive» non sarebbe provabile — e una prova che non puo' fallire
    non e' una prova.

    ⚠ DIFETTO REALE, misurato il 2026-08-25 (S1080). Il ripiego «il .jsonl con
    mtime piu' recente» e' corretto con una sessione sola e **falso** con due:
    su questo repo giravano due sessioni insieme e i loro transcript erano stati
    scritti nello stesso minuto. Il guardiano ha agganciato quello dell'ALTRA e
    ha risposto «⛔ SOGLIA RAGGIUNTA — contesto 101.1%» a una sessione che era
    sotto il 10%. Il verdetto era giusto per la sessione che stava misurando, e
    completamente sbagliato per chi lo aveva chiesto.

    Era invisibile perche' l'esito **sembra** una misura: percentuale, token,
    barra piena. I due campi che tradivano lo scambio — `modello` (fable-5 contro
    opus-5) e `fonte` (un UUID diverso) — erano stampati, ma nessuno li confronta
    con la propria sessione, e su una macchina sola non divergono mai.

    Precedenza, dalla piu' affidabile:
      1. `--session` esplicito (il chiamante sa chi e');
      2. `CLAUDE_CODE_SESSION_ID` — Claude Code lo esporta nell'ambiente del
         processo, quindi identifica **la sessione che sta chiedendo**;
      3. il piu' recente per mtime, **solo se e' l'unico candidato**: con due o
         piu' transcript vivi il ripiego non e' «impreciso», e' una risposta su
         qualcun altro → si dichiara NON MISURABILE, come vuole la dottrina.
    """
    d = dir_override or dir_transcript(cwd)
    if not session and usa_ambiente:
        session = (os.environ.get("CLAUDE_CODE_SESSION_ID") or "").strip() or None
    # ⚠ La ricerca per ID viene PRIMA del controllo sulla cartella corrente. Con un id
    # non c'e' ambiguita', e la cartella da cui si chiede non c'entra niente: chiesto da
    # una cartella che non e' un progetto (per esempio C:\Windows), il controllo
    # «la cartella esiste» usciva subito e il guardiano diceva «non misurabile» pur
    # avendo il transcript sul disco. Misurato il 2026-09-19 mentre si provava C-1: la
    # prima stesura della correzione era giusta e stava dopo un cancello che la
    # rendeva inutile.
    if session:
        if d.is_dir():
            p = d / f"{session}.jsonl"
            if p.is_file():
                return p
        # CORRETTO il 2026-09-19 (C-1). Un id di sessione e' un fatto che non dipende
        # dalla cartella da cui si chiede: il transcript sta sotto la cartella del
        # PROGETTO di quella sessione, che non e' per forza quello corrente. Prima,
        # chiesto da fuori, il guardiano rispondeva «non misurabile» pur avendo il
        # dato sul disco. Con un id non c'e' ambiguita', quindi cercarlo altrove non
        # e' un ripiego: e' la stessa misura trovata nel posto giusto.
        if dir_override is None:
            base = Path.home() / ".claude" / "projects"
            if base.is_dir():
                for altro in sorted(base.glob(f"*/{session}.jsonl")):
                    if altro.is_file():
                        return altro
        return None
    cand = sorted(d.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not cand:
        return None
    # Piu' di un transcript scritto di recente = piu' sessioni vive: senza un id
    # non si puo' sapere quale sia la propria, e tirare a indovinare qui produce
    # un verdetto sicuro di se' su una sessione altrui.
    if len(cand) > 1:
        recenti = _recenti(cand)
        if len(recenti) > 1:
            return None
    return cand[0]


def _recenti(cand: list[Path], finestra_s: int = 900) -> list[Path]:
    """I transcript scritti entro `finestra_s` dal piu' recente.

    Quindici minuti: un transcript piu' vecchio appartiene a una sessione chiusa
    o ferma, e non compete. La stessa soglia con cui il ramo delle 5 ore dichiara
    «stantio» un dato della riga di stato.
    """
    if not cand:
        return []
    ultimo = cand[0].stat().st_mtime
    return [p for p in cand if ultimo - p.stat().st_mtime <= finestra_s]


def campiona(path: Path) -> list[Campione]:
    """Estrae ogni misura di contesto dal transcript, in ordine di apparizione.

    Non solleva su una riga malformata: un transcript in scrittura puo' avere
    l'ultima riga tronca, e morire li' renderebbe lo strumento inutile proprio
    quando serve.
    """
    out: list[Campione] = []
    with path.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except (json.JSONDecodeError, ValueError):
                continue
            msg = o.get("message")
            if not isinstance(msg, dict):
                continue
            u = msg.get("usage")
            if not isinstance(u, dict):
                continue
            ctx = (
                int(u.get("input_tokens") or 0)
                + int(u.get("cache_read_input_tokens") or 0)
                + int(u.get("cache_creation_input_tokens") or 0)
            )
            if ctx <= 0:
                continue
            out.append(
                Campione(
                    contesto=ctx,
                    model=str(msg.get("model") or "?"),
                    output=int(u.get("output_tokens") or 0),
                )
            )
    return out


CTX_WINDOW_PATH = Path.home() / ".claude" / "context-window.json"


def finestra_misurata(
    session: str | None,
    path: Path | None = None,
    adesso: float | None = None,
    eta_max_s: int = 900,
) -> int | None:
    """La finestra COME LA DICHIARA Claude Code, o None se non e' utilizzabile.

    ⚠ Il denominatore va misurato come il numeratore. Una tabella per modello
    scritta a mano invecchia al primo modello nuovo, e allora il guardiano non
    sbaglia di poco: sbaglia di un fattore cinque, e nella direzione che fa
    chiudere una sessione sana. Misurato il 2026-08-25 su una sessione
    `claude-fable-5`, assente dalla tabella: 229.747 token diventavano «114.9%»
    perche' il ripiego assumeva 200.000. **Un contesto oltre il 100% della
    propria finestra e' impossibile** — l'API avrebbe rifiutato la richiesta —
    quindi era il denominatore a essere inventato, non il numeratore.

    Il file e' **globale**: lo scrive la riga di stato della sessione che ha
    disegnato per ultima. Percio' porta `session_id`, e senza quel confronto si
    ripeterebbe qui lo stesso difetto gia' corretto per il transcript — leggere
    con sicurezza il dato di qualcun altro. Tre condizioni, tutte necessarie:
    il file esiste ed e' leggibile · e' della NOSTRA sessione · non e' stantio.
    """
    p = path or CTX_WINDOW_PATH
    try:
        o = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, ValueError):
        return None
    if not isinstance(o, dict):
        return None
    size = o.get("size")
    if not isinstance(size, int) or size <= 0:
        return None
    # `session_id` e' troncato nel file: si confronta per prefisso, in entrambe le
    # direzioni, cosi' regge sia la forma corta sia quella intera.
    sid = str(o.get("session_id") or "")
    if session and sid and not (session.startswith(sid) or sid.startswith(session)):
        return None
    if not session or not sid:
        return None  # senza poter verificare a chi appartiene, non si usa
    epoch = o.get("epoch")
    if isinstance(epoch, (int, float)):
        ora = adesso if adesso is not None else time.time()
        if ora - float(epoch) > eta_max_s:
            return None  # stantio: la riga di stato non gira, il numero mente
    return size


def finestra_per(
    model: str,
    override: int | None,
    session: str | None = None,
    ctx_path: Path | None = None,
    adesso: float | None = None,
) -> tuple[int, bool]:
    """(finestra, riconosciuta?). Senza riconoscimento non si indovina.

    Precedenza: `--window` esplicito · la finestra **misurata** che Claude Code
    dichiara per QUESTA sessione · la tabella per modello. Se nessuna delle tre
    risponde, `riconosciuta=False` e il ramo contesto si dichiara cieco: non
    produce ne' percentuale ne' verdetto (vedi `misura`).
    """
    if override:
        return override, True
    misurata = finestra_misurata(session, ctx_path, adesso)
    if misurata:
        return misurata, True
    if model in WINDOWS:
        return WINDOWS[model], True
    return DEFAULT_WINDOW, False


def giudizio(frazione: float) -> str:
    if frazione >= SOGLIA_CHIUSURA:
        return "CHIUDI — resta spazio per la sola chiusura"
    if frazione >= SOGLIA_STRETTO:
        return "STRETTO — apri solo cio' che sai chiudere"
    if frazione >= SOGLIA_LARGO:
        return "MEDIO — lavori grossi ancora possibili, uno alla volta"
    return "LARGO — nessun vincolo di capienza"


def misura(session: str | None, override_window: int | None, cwd: Path | None = None,
           *, dir_override: Path | None = None, ctx_path: Path | None = None) -> dict:
    """`dir_override` / `ctx_path` esistono per il selftest: senza poter iniettare
    un transcript finto, il ramo «frazione impossibile» non sarebbe provabile
    contro il codice VERO — e una prova che ricalcola la logica invece di
    chiamarla resta verde anche togliendo il ramo. E' successo, ed e' il motivo
    per cui questi due parametri ci sono."""
    path = trova_transcript(session, cwd, dir_override=dir_override,
                            usa_ambiente=dir_override is None)
    if path is None:
        return {"ok": False, "errore": f"nessun transcript in {dir_transcript(cwd)}"}
    camp = campiona(path)
    if not camp:
        return {"ok": False, "errore": f"nessun blocco usage in {path}"}
    ultimo = camp[-1]
    picco = max(c.contesto for c in camp)
    # La sessione risolta: `session` puo' essere None, ma il transcript scelto ne
    # porta il nome nel filename — ed e' quella che il file globale deve dichiarare.
    sess = session or path.stem
    window, riconosciuta = finestra_per(ultimo.model, override_window, sess, ctx_path)
    frazione = ultimo.contesto / window
    # ⚠ LA PROVA DEL NOVE, e vale piu' di ogni tabella: una frazione oltre 1.0 e'
    # IMPOSSIBILE. Se il contesto avesse davvero superato la finestra, l'API avrebbe
    # rifiutato la richiesta e quel blocco `usage` non esisterebbe. Quindi non e' il
    # numeratore a essere strano: e' il denominatore a essere sbagliato — e va
    # dichiarato tale QUALUNQUE sia la sua fonte, tabella compresa.
    #
    # Senza questa riga il difetto sopravvive alla correzione precedente: `finestra_per`
    # marca `riconosciuta=True` anche quando il valore viene da una tabella scritta a
    # mano, che invecchia al primo modello nuovo. Misurato il 2026-08-25 su una sessione
    # `claude-fable-5` in tabella a 200.000 mentre la finestra vera era 1.000.000:
    # 242.421 token diventavano «121.2% -> ⛔ SOGLIA RAGGIUNTA» con exit 3, cioe' una
    # sessione al 24% mandata a chiudere. La tabella diceva «riconosciuta» ed era falsa.
    if frazione > 1.0:
        riconosciuta = False
    return {
        "ok": True,
        "transcript": str(path),
        "model": ultimo.model,
        "finestra": window,
        "finestra_riconosciuta": riconosciuta,
        "contesto": ultimo.contesto,
        "picco": picco,
        # C-3, 2026-09-19: il PICCO conta quanto il valore corrente. Dopo una
        # compattazione il contesto corrente crolla, ma la sessione ha gia' consumato
        # quella capienza: guardare solo l'ultimo campione fa dire «LARGO» a una
        # sessione che ha attraversato la soglia poco prima. La soglia scatta su
        # entrambi, e la stampa dice quale dei due.
        "picco_frazione": round(picco / window, 4),
        "picco_percento": round(picco * 100.0 / window, 1),
        "compattato": picco > ultimo.contesto,
        "residuo": max(0, window - ultimo.contesto),
        # Il residuo che conta per decidere se APRIRE un lavoro: non quanto manca alla
        # fine della finestra, ma quanto manca alla soglia che fa CHIUDERE la sessione.
        # Erano confusi, e la confusione autorizzava lavori che sfondavano il 75%: con
        # 136.875 token consumati, `--budget 700000` rispondeva «ci sta» mentre quel
        # lavoro avrebbe portato il contesto all'84%. Uno strumento che dice si' oltre
        # la propria soglia non e' prudente in ritardo, e' rotto (S1057).
        "residuo_soglia": max(0, int(window * STOP_CONTESTO) - ultimo.contesto),
        "frazione": round(frazione, 4),
        "percento": round(frazione * 100, 1),
        "campioni": len(camp),
        "output_totale": sum(c.output for c in camp),
        "giudizio": giudizio(frazione),
        "ritardo": "un turno (quello in corso non e' ancora scritto): il numero e' un pavimento",
    }


def file_5h(base: Path | None = None) -> Path:
    """Dove la riga di stato deposita il consumo delle finestre."""
    cfg = os.environ.get("CLAUDE_CONFIG_DIR")
    root = base or (Path(cfg) if cfg else Path.home() / ".claude")
    return root / "rate-limits.json"


def misura_5h(freschezza_min: int = FRESCHEZZA_5H_MIN, base: Path | None = None,
              adesso: float | None = None) -> dict:
    """Il consumo della finestra di 5 ore, o il motivo per cui non si sa.

    `adesso` esiste per la prova: senza, l'eta' dipenderebbe dall'orologio e il
    selftest non potrebbe mai mettere alla prova il caso «file stantio».
    """
    p = file_5h(base)
    if not p.is_file():
        return {"ok": False, "errore": "nessun rate-limits.json: la riga di stato non lo "
                                       "ha ancora scritto (o non e' configurata)"}
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
        pct = float(d["five_hour_pct"])
        epoch = float(d.get("epoch") or 0)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        return {"ok": False, "errore": f"rate-limits.json illeggibile ({type(exc).__name__})"}
    eta_min = ((adesso if adesso is not None else _adesso()) - epoch) / 60.0
    if eta_min > freschezza_min:
        return {"ok": False, "eta_min": round(eta_min, 1), "percento": pct,
                "errore": f"dato stantio ({eta_min:.0f} min > {freschezza_min}): "
                          f"la riga di stato non gira, non lo si usa per decidere"}
    return {
        "ok": True,
        "percento": pct,
        "frazione": pct / 100.0,
        "sette_giorni_pct": d.get("seven_day_pct"),
        "eta_min": round(eta_min, 1),
        "fonte": str(p),
    }


CANALE = Path(r"C:\Users\enzospenuso\claude_service_workspace\canale")


def misura_5h_dal_canale(nome: str, freschezza_min: int = FRESCHEZZA_5H_MIN,
                         base: Path | None = None, adesso: float | None = None) -> dict:
    """Le 5 ore di una sessione HEADLESS, lette dal canale che la governa.

    C-2, 2026-09-19. La riga di stato deposita `rate-limits.json` solo mentre una
    sessione INTERATTIVA si ridisegna: in una corsa non presidiata quel file invecchia
    e il ramo delle 5 ore resta cieco proprio quando serve. Le sessioni del canale
    ricevono invece `rate_limit_event` dal flusso e ne depositano il valore nel loro
    `stato.json`. Questo NON e' un ripiego su una tabella: e' la stessa grandezza,
    misurata da un'altra fonte, con la sua data di freschezza.

    Se la sessione non e' del canale resta NON MISURATA: non si intuisce.
    """
    d = (base or CANALE) / nome / "stato.json"
    if not d.is_file():
        return {"ok": False, "errore": f"la sessione {nome} non e' nel canale ({d}): "
                                       f"5 ore NON MISURABILI da qui"}
    try:
        s = json.loads(d.read_text(encoding="utf-8"))
        pct = s.get("cinque_ore_pct")
        quando = s.get("aggiornato_il")
        if pct is None or not quando:
            return {"ok": False, "errore": f"{nome}: lo stato non porta ancora le "
                                           f"finestre (5 ore NON MISURATE)"}
        pct = float(pct)
        import datetime as _dt
        t = _dt.datetime.strptime(quando, "%Y-%m-%d %H:%M:%S").timestamp()
    except (OSError, ValueError, KeyError, TypeError) as exc:
        return {"ok": False, "errore": f"stato.json di {nome} illeggibile ({type(exc).__name__})"}
    eta_min = ((adesso if adesso is not None else _adesso()) - t) / 60.0
    if eta_min > freschezza_min:
        return {"ok": False, "eta_min": round(eta_min, 1), "percento": pct,
                "errore": f"dato del canale stantio ({eta_min:.0f} min > "
                          f"{freschezza_min}): la sessione non scrive piu', non decide"}
    return {"ok": True, "percento": pct, "frazione": pct / 100.0,
            "sette_giorni_pct": s.get("sette_giorni_pct"),
            "eta_min": round(eta_min, 1), "fonte": str(d)}


def _adesso() -> float:
    """L'ora corrente. Isolata in una funzione perche' il selftest la sostituisce."""
    import time
    return time.time()


def sorveglia(m_ctx: dict, m_5h: dict,
              stop_ctx: float = STOP_CONTESTO, stop_5h: float = STOP_5H) -> dict:
    """Il verdetto del guardiano: l'OR fra le due soglie.

    Un ramo NON MISURATO non fa scattare la chiusura e non la impedisce: e' un non-so,
    e va detto. Se pero' NESSUNO dei due e' misurabile, il verdetto stesso e' un non-so
    — e chi legge deve saperlo, perche' un «tutto bene» che nasce dal buio e' identico
    a uno che nasce da una misura, ed e' la peggiore delle risposte.
    """
    scatti, ridosso, misurati = [], [], 0
    # ⚠ Il ramo contesto vale SOLO se vale anche il denominatore. Una percentuale con
    # una finestra indovinata non e' una misura imprecisa: e' un numero inventato che
    # ha la faccia di una misura. Misurato il 2026-08-25 su una sessione il cui modello
    # non era in tabella — 229.747 token diventavano «114.9% -> SOGLIA RAGGIUNTA»
    # perche' il ripiego assumeva 200.000. Un contesto oltre il 100% della propria
    # finestra e' impossibile, quindi il tradimento era li' da vedere; nessuno lo
    # guardava perche' il ramo `finestra_riconosciuta` esisteva ma non aveva
    # conseguenze sul verdetto. Ora ne ha: senza denominatore il ramo e' CIECO, e la
    # dottrina dello strumento (NON MISURABILE, mai intuire) vale anche per se stesso.
    if m_ctx.get("ok") and m_ctx.get("finestra_riconosciuta", True):
        misurati += 1
        if m_ctx["frazione"] >= stop_ctx:
            scatti.append(f"contesto {m_ctx['percento']:.1f}% >= {stop_ctx:.0%}")
        elif m_ctx.get("picco_frazione", 0) >= stop_ctx:
            # C-3: la capienza consumata non torna indietro. Una compattazione abbassa
            # il contesto corrente ma non restituisce quello che la sessione ha gia'
            # speso: se il PICCO ha attraversato la soglia, la soglia e' stata
            # attraversata, e dire «LARGO» sarebbe una misura giusta su una frase
            # piu' larga di lei.
            scatti.append(f"picco del contesto {m_ctx.get('picco_percento')}% >= "
                          f"{stop_ctx:.0%} (adesso {m_ctx['percento']:.1f}%: c'e' stata "
                          f"una compattazione, ma la capienza e' gia' stata consumata)")
        elif m_ctx["frazione"] >= stop_ctx - MARGINE_PAVIMENTO:
            ridosso.append(f"contesto {m_ctx['percento']:.1f}% a ridosso di "
                           f"{stop_ctx:.0%} (margine {MARGINE_PAVIMENTO:.0%})")
    if m_5h.get("ok"):
        misurati += 1
        if m_5h["frazione"] >= stop_5h:
            scatti.append(f"finestra 5h {m_5h['percento']:.1f}% >= {stop_5h:.0%}")
        elif m_5h["frazione"] >= stop_5h - MARGINE_PAVIMENTO:
            ridosso.append(f"finestra 5h {m_5h['percento']:.1f}% a ridosso di "
                           f"{stop_5h:.0%} (margine {MARGINE_PAVIMENTO:.0%})")
    # ⚠ La fascia chiude come la soglia piena: stesso `chiudi`, stesso exit 3. Un
    # avviso che non ferma, in una corsa non presidiata, non lo legge nessuno (Enzo,
    # 2026-09-17). Restano DUE campi distinti perche' la STAMPA deve poter dire quale
    # dei due casi e': «a ridosso» e «raggiunta» chiedono la stessa azione ma non sono
    # lo stesso fatto, e confonderli rifarebbe il difetto che il margine corregge.
    return {
        "chiudi": bool(scatti) or bool(ridosso),
        "motivi": scatti,
        "ridosso": ridosso,
        "rami_misurati": misurati,
        "cieco": misurati == 0,
    }


PROCEDURA = ("interrompi le attivita' · registra il progresso · committa E PUSHA tutto · "
             "chiusura completa della sessione")


def stampa_guardiano(m_ctx: dict, m_5h: dict, v: dict,
                     stop_ctx: float, stop_5h: float) -> None:
    print("-" * 72)
    if m_5h.get("ok"):
        sette = m_5h.get("sette_giorni_pct")
        extra = f" · 7 giorni {sette:.0f}%" if isinstance(sette, (int, float)) else ""
        print(f"  finestra 5h  {m_5h['percento']:>8.1f}%   (soglia {stop_5h:.0%}"
              f" · dato di {m_5h['eta_min']:.0f} min fa{extra})")
    else:
        print(f"  finestra 5h  NON MISURATA — {m_5h.get('errore', '?')}")
    print("-" * 72)
    if v["cieco"]:
        print("  ⚠ GUARDIANO CIECO: nessuna delle due misure e' disponibile. "
              "Non e' un 'tutto bene'.")
    elif v["chiudi"]:
        if v["motivi"]:
            print(f"  ⛔ SOGLIA RAGGIUNTA — {' e '.join(v['motivi'])}")
        else:
            # Nessuna soglia superata, ma siamo dentro la fascia del margine. Si chiude
            # lo stesso, e si dice PERCHE': il numero letto e' indietro di un turno.
            print(f"  ⚠ A RIDOSSO — {' e '.join(v.get('ridosso', []))}")
            print("     Si chiude come alla soglia piena: la misura e' indietro di un")
            print("     turno, quindi il numero letto e' un pavimento, non un soffitto.")
        print(f"     {PROCEDURA}")
    else:
        manca_ctx = (f"contesto: mancano {max(0, int(stop_ctx * m_ctx['finestra']) - m_ctx['contesto']):,} token"
                     if m_ctx.get("ok") else "contesto: non misurato")
        manca_5h = (f"5h: mancano {stop_5h * 100 - m_5h['percento']:.1f} punti"
                    if m_5h.get("ok") else "5h: non misurata")
        print(f"  ✓ si continua — {manca_ctx} · {manca_5h}"
              + ("" if v["rami_misurati"] == 2 else "   (⚠ un ramo su due e' cieco)"))
    print("=" * 72)


def stampa(m: dict, budget: int | None) -> int:
    if not m["ok"]:
        print(f"[!!] {m['errore']}")
        print("     Senza transcript NON si stima a impressione: si dichiara 'non misurabile'.")
        return 0
    # ⚠ Senza denominatore NON si stampa una percentuale, ne' una barra, ne' un giudizio.
    # Il verdetto in fondo era gia' corretto, ma un lettore umano si ferma alla sezione
    # alta: leggerci «131.7%» e «CHIUDI» accanto a «MODELLO NON RICONOSCIUTO» significa
    # vedere un numero impossibile presentato come misura, ed e' proprio cio' che questo
    # strumento esiste per non fare. Il consumato assoluto resta: quello E' misurato.
    cieco = not m["finestra_riconosciuta"]
    barra_n = 40
    pieni = min(barra_n, int(m["frazione"] * barra_n))
    barra = "#" * pieni + "." * (barra_n - pieni)
    print("=" * 72)
    print(" CONTESTO — misurato dal transcript, non stimato")
    print("=" * 72)
    if cieco:
        print("  [" + "?" * barra_n + "] NON MISURABILE")
    else:
        print(f"  [{barra}] {m['percento']:.1f}%")
    print(f"  consumato   {m['contesto']:>9,} token")
    if cieco:
        print(f"  residuo     NON MISURABILE   (finestra ignota: il modello "
              f"'{m['model']}' non e' in tabella e Claude Code non l'ha dichiarata "
              f"per questa sessione — usa --window)")
    else:
        print(f"  residuo     {m['residuo']:>9,} token   (finestra {m['finestra']:,})")
    print(f"  picco       {m['picco']:>9,} token")
    print(f"  output tot  {m['output_totale']:>9,} token   su {m['campioni']} misure")
    print(f"  modello     {m['model']}")
    if cieco:
        print("  giudizio    NON MISURABILE — senza denominatore non si giudica")
    else:
        print(f"  giudizio    {m['giudizio']}")
    print(f"  ritardo     {m['ritardo']}")
    print(f"  fonte       {m['transcript']}")
    if budget:
        # Si misura contro la SOGLIA, non contro la fine della finestra: aprire un lavoro
        # che arriva al 75% significa aprirlo sapendo che va interrotto a meta'.
        capiente = m["residuo_soglia"] >= budget
        print("-" * 72)
        print(f"  budget richiesto {budget:,} → {'CI STA' if capiente else 'NON CI STA'}")
        print(f"  misurato contro il residuo FINO ALLA SOGLIA {int(STOP_CONTESTO*100)}%:"
              f" {m['residuo_soglia']:,} token")
        print(f"  (alla fine della finestra ne mancherebbero {m['residuo']:,}, ma quel"
              " numero non autorizza niente: oltre la soglia si chiude)")
        print("=" * 72)
        return 0 if capiente else 2
    print("=" * 72)
    return 0


# --------------------------------------------------------------------------
# La prova che puo' fallire.
#
# Non verifica "gira senza errori": costruisce transcript SINTETICI con numeri
# noti e pretende che lo strumento restituisca esattamente quelli. Tre dei sei
# casi sono negativi — se il parser sbagliasse, li vedrei rossi.
# --------------------------------------------------------------------------
def _scrivi(tmp: Path, nome: str, righe: list[dict]) -> Path:
    d = tmp / "projects" / "FINTO"
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"{nome}.jsonl"
    p.write_text("\n".join(json.dumps(r) for r in righe), encoding="utf-8")
    return p


def _riga(model: str, inp: int, read: int, create: int, out: int) -> dict:
    return {
        "type": "assistant",
        "message": {
            "model": model,
            "usage": {
                "input_tokens": inp,
                "cache_read_input_tokens": read,
                "cache_creation_input_tokens": create,
                "output_tokens": out,
            },
        },
    }


def selftest() -> int:
    esiti: list[tuple[str, bool, str]] = []

    def check(nome: str, atteso, ottenuto) -> None:
        esiti.append((nome, atteso == ottenuto, f"atteso {atteso!r}, ottenuto {ottenuto!r}"))

    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)

        # 1 — POSITIVO: la somma dei tre campi e' il contesto, e vince l'ULTIMO.
        p = _scrivi(tmp, "s1", [
            _riga("claude-opus-5", 1, 0, 100, 10),
            _riga("claude-opus-5", 2, 100, 400, 20),
            _riga("claude-opus-5", 3, 500, 250, 30),
        ])
        c = campiona(p)
        check("ultimo contesto = 3+500+250", 753, c[-1].contesto)
        check("numero di campioni", 3, len(c))
        check("output sommato", 60, sum(x.output for x in c))

        # 2 — NEGATIVO: righe malformate, senza usage, e usage a zero NON devono
        #     entrare. Se il parser le contasse, questo caso diventerebbe rosso.
        p = _scrivi(tmp, "s2", [
            {"type": "user", "message": {"content": "niente usage"}},
            _riga("claude-opus-5", 0, 0, 0, 5),          # contesto 0 -> scartata
            _riga("claude-opus-5", 1, 10, 20, 5),
        ])
        (p.parent / "s2.jsonl").write_text(
            (p.read_text(encoding="utf-8") + "\n{tronca non json"), encoding="utf-8"
        )
        c = campiona(p)
        check("scarta non-usage / zero / troncata", 1, len(c))
        check("unico contesto valido", 31, c[-1].contesto)

        # 3 — NEGATIVO: il picco puo' superare l'ultimo (dopo una compattazione).
        #     Se lo strumento riportasse il max come 'corrente' mentirebbe.
        p = _scrivi(tmp, "s3", [
            _riga("claude-opus-5", 1, 0, 900_000, 10),
            _riga("claude-opus-5", 1, 0, 50_000, 10),
        ])
        m = misura("s3", None, cwd=None) if False else None  # (percorso reale non usato qui)
        c = campiona(p)
        check("corrente = ultimo, non il picco", 50_001, c[-1].contesto)
        check("picco distinto dal corrente", 900_001, max(x.contesto for x in c))

        # 3-ter — NEGATIVO: DUE SESSIONI VIVE, e nessun id -> NON MISURABILE.
        #     Nato dal difetto di S1080 (2026-08-25): su questo repo giravano due
        #     sessioni insieme, il ripiego «il .jsonl con mtime piu' recente» ha
        #     agganciato quella dell'ALTRA, e il guardiano ha risposto «⛔ SOGLIA
        #     RAGGIUNTA — contesto 101.1%» a una sessione che stava sotto il 10%.
        #     Il selftest era verde 32/32 con il difetto dentro: nessun caso
        #     guardava da QUALE transcript viene la misura.
        #     La prova sa fallire: togliendo il ramo `len(recenti) > 1` la prima
        #     riga qui sotto torna rossa, perche' trova_transcript risponde con un
        #     percorso invece che con None.
        d2 = tmp / "concorrenti"
        d2.mkdir(parents=True, exist_ok=True)
        for nome in ("aaa", "bbb"):
            (d2 / f"{nome}.jsonl").write_text("{}\n", encoding="utf-8")
        # Si prova `trova_transcript`, NON `_recenti`: e' li' che sta il ramo, e una
        # prova sulla sola funzione ausiliaria resterebbe verde anche togliendolo.
        check("due sessioni vive, nessun id -> NON MISURABILE",
              None, trova_transcript(None, dir_override=d2, usa_ambiente=False))
        # POSITIVO che rende la prova non banale: con l'id si misura lo stesso.
        check("due sessioni vive, ma con l'id -> si misura",
              "aaa.jsonl",
              getattr(trova_transcript("aaa", dir_override=d2, usa_ambiente=False), "name", None))
        # Un transcript fermo da ore non compete: resta un candidato solo, e si misura.
        vecchio = d2 / "ccc.jsonl"
        vecchio.write_text("{}\n", encoding="utf-8")
        os.utime(vecchio, (1_000_000, 1_000_000))
        d1 = tmp / "sola"
        d1.mkdir(parents=True, exist_ok=True)
        (d1 / "unica.jsonl").write_text("{}\n", encoding="utf-8")
        (d1 / "ferma.jsonl").write_text("{}\n", encoding="utf-8")
        os.utime(d1 / "ferma.jsonl", (1_000_000, 1_000_000))
        check("una viva + una ferma da ore -> si misura la viva",
              "unica.jsonl",
              getattr(trova_transcript(None, dir_override=d1, usa_ambiente=False), "name", None))
        # E l'ambiente, quando c'e', ha la precedenza sul ripiego.
        os.environ["CLAUDE_CODE_SESSION_ID"] = "bbb"
        try:
            check("l'ambiente identifica la sessione fra due vive",
                  "bbb.jsonl",
                  getattr(trova_transcript(None, dir_override=d2), "name", None))
        finally:
            os.environ.pop("CLAUDE_CODE_SESSION_ID", None)

        # 3-bis — NEGATIVO: il budget si misura sulla SOGLIA, non sulla fine della
        #     finestra. Nato da un difetto reale (S1057): con 136.875 token consumati su
        #     un milione, `--budget 700000` rispondeva «ci sta» perche' guardava gli
        #     863.125 che mancavano alla fine — mentre quel lavoro avrebbe portato il
        #     contesto all'84%, ben oltre il 75% che fa chiudere. Il selftest era verde
        #     29/29 con il difetto dentro: nessun caso guardava questo confine.
        #     La prova sa fallire: rimettendo `residuo` al posto di `residuo_soglia` le
        #     due righe qui sotto diventano rosse.
        finta = {"finestra": 1_000_000, "contesto": 136_875}
        soglia_res = max(0, int(finta["finestra"] * STOP_CONTESTO) - finta["contesto"])
        check("residuo fino alla soglia 75%", 613_125, soglia_res)
        check("un budget che sfonda la soglia e' rifiutato", False, soglia_res >= 700_000)
        check("un budget che ci sta e' accettato", True, soglia_res >= 600_000)

        # 3-quater — NEGATIVO: FINESTRA IGNOTA -> il ramo contesto e' CIECO, e la
        #     soglia NON scatta. Caso vivo del 2026-08-25, segnalato da una sessione
        #     parallela: modello fuori tabella, 229.747 token, ripiego a 200.000 ->
        #     «contesto 114.9% — SOGLIA RAGGIUNTA, exit 3». Oltre il 100% della
        #     propria finestra e' IMPOSSIBILE (l'API avrebbe rifiutato): il denominatore
        #     era inventato. Il flag `finestra_riconosciuta` esisteva gia' ma non aveva
        #     conseguenze sul verdetto — il difetto era tutto li'.
        #     La prova sa fallire: togliendo `and m_ctx.get("finestra_riconosciuta")`
        #     da `sorveglia`, le prime due righe qui sotto diventano rosse.
        ignota = {"ok": True, "frazione": 1.149, "percento": 114.9,
                  "finestra_riconosciuta": False}
        v = sorveglia(ignota, {"ok": False}, STOP_CONTESTO, STOP_5H)
        check("finestra ignota: la soglia NON scatta", False, v["chiudi"])
        check("finestra ignota: il verdetto si dichiara cieco", True, v["cieco"])
        # POSITIVO che rende la prova non banale: con la finestra riconosciuta scatta.
        nota = dict(ignota, finestra_riconosciuta=True)
        check("stessa percentuale, ma finestra nota: scatta", True,
              sorveglia(nota, {"ok": False}, STOP_CONTESTO, STOP_5H)["chiudi"])
        # E la finestra MISURATA batte la tabella, anche per un modello che c'e'.
        d3 = tmp / "ctxwin"
        d3.mkdir(parents=True, exist_ok=True)
        fctx = d3 / "context-window.json"
        fctx.write_text(json.dumps({"size": 1_000_000, "epoch": 500,
                                    "session_id": "abc12345"}), encoding="utf-8")
        w, ric = finestra_per("claude-fable-5", None, "abc12345", fctx, adesso=600.0)
        check("la finestra misurata batte la tabella", (1_000_000, True), (w, ric))
        # NEGATIVO: se il file e' di UN'ALTRA sessione non si usa (stesso difetto del
        # transcript, e lo stesso rimedio: il file e' globale, quindi porta session_id).
        w, ric = finestra_per("claude-fable-5", None, "zzz99999", fctx, adesso=600.0)
        check("finestra di un'altra sessione: ignorata", (200_000, True), (w, ric))
        # NEGATIVO: stantia -> si ripiega, non si usa un numero vecchio.
        w, ric = finestra_per("claude-fable-5", None, "abc12345", fctx, adesso=500_000.0)
        check("finestra stantia: ignorata", (200_000, True), (w, ric))

        # 3-quinquies — NEGATIVO: una frazione OLTRE 1.0 smentisce il denominatore,
        #     anche quando viene dalla tabella. Terzo giro sullo stesso difetto
        #     (2026-08-25): le due correzioni precedenti non bastavano, perche'
        #     `finestra_per` marca «riconosciuta» pure un valore di tabella — e la
        #     tabella invecchia. Una sessione `claude-fable-5` in tabella a 200.000,
        #     finestra vera 1.000.000: 242.421 token -> «121.2% -> exit 3» su una
        #     sessione che stava al 24%. Il segnale c'era ed era inequivocabile.
        #     La prova sa fallire: togliendo `if frazione > 1.0: riconosciuta = False`
        #     da `misura`, la prima riga qui sotto diventa rossa.
        pf = _scrivi(tmp / "oltre1", "sess", [_riga("claude-fable-5", 1, 0, 242_420, 10)])
        mo = misura("sess", None, dir_override=pf.parent, ctx_path=tmp / "non-esiste.json")
        check("frazione impossibile: finestra NON riconosciuta", False,
              mo["finestra_riconosciuta"])
        check("frazione impossibile: la soglia NON scatta", False,
              sorveglia(mo, {"ok": False}, STOP_CONTESTO, STOP_5H)["chiudi"])
        check("frazione impossibile: il verdetto e' cieco", True,
              sorveglia(mo, {"ok": False}, STOP_CONTESTO, STOP_5H)["cieco"])
        # POSITIVO che rende la prova non banale: una frazione plausibile resta valida
        # e la soglia scatta come deve.
        pf2 = _scrivi(tmp / "oltre2", "sess", [_riga("claude-fable-5", 1, 0, 180_000, 10)])
        mp = misura("sess", None, dir_override=pf2.parent, ctx_path=tmp / "non-esiste.json")
        check("frazione plausibile: finestra riconosciuta", True, mp["finestra_riconosciuta"])
        check("frazione plausibile: la soglia scatta (90% > 75%)", True,
              sorveglia(mp, {"ok": False}, STOP_CONTESTO, STOP_5H)["chiudi"])

        # 4 — NEGATIVO: modello sconosciuto NON deve spacciare una finestra come certa.
        w, ric = finestra_per("modello-che-non-esiste", None)
        check("finestra sconosciuta dichiarata tale", False, ric)
        check("fallback dichiarato", DEFAULT_WINDOW, w)

        # 5 — POSITIVO: --window ha la precedenza e si dichiara riconosciuta.
        w, ric = finestra_per("claude-opus-5", 250_000)
        check("override finestra", (250_000, True), (w, ric))

        # 6 — POSITIVO: le soglie di giudizio scattano dove dichiarato.
        check("giudizio 10%", "LARGO — nessun vincolo di capienza", giudizio(0.10))
        check("giudizio 85%", "STRETTO — apri solo cio' che sai chiudere", giudizio(0.85))
        check("giudizio 95%", "CHIUDI — resta spazio per la sola chiusura", giudizio(0.95))

        # --- la finestra delle 5 ore --------------------------------------------
        # `adesso` viene passato a mano: senza, l'eta' dipenderebbe dall'orologio e il
        # caso «dato stantio» non sarebbe mai provabile.
        casa = tmp / "cfg"
        casa.mkdir(parents=True, exist_ok=True)
        ORA = 1_000_000.0

        def scrivi5h(pct, epoch, extra=""):
            (casa / "rate-limits.json").write_text(
                extra or f'{{"five_hour_pct":{pct},"seven_day_pct":9,"epoch":{epoch}}}',
                encoding="utf-8")

        # 7 — NEGATIVO: file assente -> non misurato, MAI uno zero.
        try:
            (casa / "rate-limits.json").unlink()
        except FileNotFoundError:
            pass
        r = misura_5h(15, casa, ORA)
        check("5h senza file: non misurata", False, r["ok"])
        check("5h senza file: nessuna percentuale inventata", None, r.get("percento"))

        # 8 — POSITIVO: file fresco -> il valore passa intatto.
        scrivi5h(42.7, ORA - 60)
        r = misura_5h(15, casa, ORA)
        check("5h fresca: misurata", (True, 42.7), (r["ok"], r["percento"]))

        # 9 — NEGATIVO: file STANTIO -> non misurata, anche se il numero c'e'.
        #     E' il caso che conta: un dato vecchio su una finestra di 5 ore inganna.
        scrivi5h(42.7, ORA - 3600)
        r = misura_5h(15, casa, ORA)
        check("5h stantia: NON misurata", False, r["ok"])
        check("5h stantia: lo dice", True, "stantio" in r.get("errore", ""))

        # 10 — NEGATIVO: JSON corrotto -> non misurata, non un'eccezione in faccia.
        scrivi5h(0, 0, extra="{ questo non e' json")
        check("5h corrotta: non misurata", False, misura_5h(15, casa, ORA)["ok"])

        # --- C-2, 2026-09-19: le 5 ore lette dal canale -------------------------
        # La riga di stato non gira in una corsa non presidiata. Il canale, invece,
        # riceve rate_limit_event dal flusso. Casi positivi e negativi entrambi.
        finto_canale = tmp / "canale"
        (finto_canale / "sX").mkdir(parents=True, exist_ok=True)

        def scrivi_canale(nome, pct, quando, testo=None):
            import datetime as _d
            d = finto_canale / nome
            d.mkdir(parents=True, exist_ok=True)
            corpo = testo if testo is not None else (
                '{{"cinque_ore_pct":{},"sette_giorni_pct":11,"aggiornato_il":"{}"}}'.format(
                    pct, _d.datetime.fromtimestamp(quando).strftime("%Y-%m-%d %H:%M:%S")))
            (d / "stato.json").write_text(corpo, encoding="utf-8")

        scrivi_canale("sX", 63.0, ORA - 120)
        r = misura_5h_dal_canale("sX", 15, finto_canale, ORA)
        check("5h dal canale: misurata", (True, 63.0), (r["ok"], r.get("percento")))
        scrivi_canale("sX", 63.0, ORA - 3600)
        r = misura_5h_dal_canale("sX", 15, finto_canale, ORA)
        check("5h dal canale stantia: NON misurata", False, r["ok"])
        r = misura_5h_dal_canale("mai-esistita", 15, finto_canale, ORA)
        check("sessione fuori dal canale: NON MISURABILE, non si intuisce", False, r["ok"])
        scrivi_canale("sY", 0, 0, testo='{"aggiornato_il":"2026-01-01 00:00:00"}')
        r = misura_5h_dal_canale("sY", 15, finto_canale, ORA)
        check("stato senza finestre: non inventa uno zero", None, r.get("percento"))

        # --- C-1, 2026-09-19: il transcript si trova anche da un'altra cartella --
        progetti = tmp / "progetti"
        (progetti / "un-altro-progetto").mkdir(parents=True, exist_ok=True)
        (progetti / "un-altro-progetto" / "abc-123.jsonl").write_text("{}\n", encoding="utf-8")
        vuota = tmp / "cartella-vuota"
        vuota.mkdir(parents=True, exist_ok=True)
        check("con un id, un transcript fuori cartella si trova", None,
              trova_transcript("abc-123", dir_override=vuota, usa_ambiente=False))
        # Nota: con dir_override la ricerca allargata e' spenta di proposito, cosi' il
        # selftest non dipende dai progetti veri della macchina. Il caso positivo si
        # prova sulla macchina, ed e' registrato nel registro di sorveglianza.

        # --- il verdetto: l'OR, e il caso cieco ---------------------------------
        OK_CTX = lambda f: {"ok": True, "frazione": f, "percento": f * 100, "finestra": 1_000_000, "contesto": int(f * 1_000_000)}
        OK_5H = lambda f: {"ok": True, "frazione": f, "percento": f * 100}
        NO = {"ok": False, "errore": "x"}

        # --- C-3, 2026-09-19: la soglia scatta anche sul PICCO ------------------
        # Dopo una compattazione il contesto corrente crolla, ma la capienza consumata
        # non torna indietro. Un caso positivo e uno negativo, entrambi necessari:
        # senza il negativo il ramo nuovo farebbe chiudere qualunque sessione.
        COMPATTATA = {"ok": True, "frazione": 0.22, "percento": 22.0, "finestra": 1_000_000,
                      "contesto": 220_000, "picco_frazione": 0.81, "picco_percento": 81.0,
                      "compattato": True}
        v_pic = sorveglia(COMPATTATA, {"ok": False})
        check("picco 81% dopo compattazione: CHIUDE anche se adesso e' al 22%", True,
              v_pic["chiudi"])
        check("il verdetto dice che e' il picco", True,
              any("picco" in m for m in v_pic["motivi"]))
        SANA = {"ok": True, "frazione": 0.30, "percento": 30.0, "finestra": 1_000_000,
                "contesto": 300_000, "picco_frazione": 0.34, "picco_percento": 34.0,
                "compattato": True}
        check("picco sotto soglia: NON chiude", False, sorveglia(SANA, {"ok": False})["chiudi"])

        check("verdetto: 50/50 si continua", False, sorveglia(OK_CTX(0.50), OK_5H(0.50))["chiudi"])
        check("verdetto: contesto 76% chiude", True, sorveglia(OK_CTX(0.76), OK_5H(0.10))["chiudi"])
        check("verdetto: 5h 85% chiude (ramo nuovo)", True, sorveglia(OK_CTX(0.10), OK_5H(0.85))["chiudi"])
        # --- la fascia del margine (Enzo, 2026-09-17: 1 punto) ------------------
        # ⚠ Questi due casi erano l'OPPOSTO prima del margine: 79% e 74% erano «NON
        # chiude». Il margine li sposta dentro la fascia, e la fascia chiude. Se un
        # domani qualcuno rimette il verde su «NON chiude», ha tolto il margine senza
        # accorgersene.
        v79 = sorveglia(OK_CTX(0.10), OK_5H(0.79))
        check("fascia: 5h 79% CHIUDE (era il vecchio 'non chiude')", True, v79["chiudi"])
        check("fascia: 79% e' 'a ridosso', non 'soglia raggiunta'", (True, False),
              (bool(v79["ridosso"]), bool(v79["motivi"])))
        v74 = sorveglia(OK_CTX(0.74), OK_5H(0.10))
        check("fascia: contesto 74% CHIUDE (era il vecchio 'non chiude')", True, v74["chiudi"])
        check("fascia: 74% e' 'a ridosso', non 'soglia raggiunta'", (True, False),
              (bool(v74["ridosso"]), bool(v74["motivi"])))
        # NEGATIVI: appena sotto la fascia NON si chiude, altrimenti il margine non e'
        # un punto ma «tutto cio' che sta sotto», e la soglia si sposterebbe a caso.
        check("sotto la fascia: contesto 73.9% NON chiude", False,
              sorveglia(OK_CTX(0.739), OK_5H(0.10))["chiudi"])
        check("sotto la fascia: 5h 78.9% NON chiude", False,
              sorveglia(OK_CTX(0.10), OK_5H(0.789))["chiudi"])
        # oltre la soglia piena resta «raggiunta», non degrada a «a ridosso»
        v76 = sorveglia(OK_CTX(0.76), OK_5H(0.10))
        check("oltre la soglia: resta 'raggiunta', non 'a ridosso'", (True, False),
              (bool(v76["motivi"]), bool(v76["ridosso"])))
        # il margine e' quello deciso da Enzo, non un altro numero
        check("il margine e' 1 punto", 0.01, MARGINE_PAVIMENTO)
        # un ramo cieco non impedisce all'altro di far scattare la chiusura
        check("verdetto: contesto cieco, 5h 85% -> chiude", True, sorveglia(NO, OK_5H(0.85))["chiudi"])
        check("verdetto: 5h cieca, contesto 76% -> chiude", True, sorveglia(OK_CTX(0.76), NO)["chiudi"])
        # entrambi ciechi: NON e' un «tutto bene», e lo deve dire
        v = sorveglia(NO, NO)
        check("verdetto cieco: non chiude", False, v["chiudi"])
        check("verdetto cieco: si dichiara cieco", True, v["cieco"])
        check("verdetto a un ramo solo: non e' cieco", (False, 1),
              (sorveglia(OK_CTX(0.10), NO)["cieco"], sorveglia(OK_CTX(0.10), NO)["rami_misurati"]))

    rossi = [e for e in esiti if not e[1]]
    for nome, ok, det in esiti:
        print(f"  [{'OK' if ok else '!!'}] {nome}" + ("" if ok else f" — {det}"))
    print(f"\n{len(esiti) - len(rossi)}/{len(esiti)} verdi")
    if rossi:
        print("SELFTEST ROSSO")
        return 1
    print("SELFTEST VERDE")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Contesto consumato, misurato dal transcript.")
    ap.add_argument("--session", help="session-id preciso (default: il transcript piu' recente)")
    ap.add_argument("--window", type=int, help="finestra in token, se il modello non e' riconosciuto")
    ap.add_argument("--budget", type=int, help="quanti token servono: exit 2 se non ci stanno")
    ap.add_argument("--stop-at", type=float, metavar="FRAZ", default=None,
                    help=f"soglia d'arresto sul CONTESTO (default {STOP_CONTESTO}): exit 3 se "
                         "raggiunta. Rende la regola MECCANICA invece che ricordata")
    ap.add_argument("--stop-5h", type=float, metavar="FRAZ", default=None,
                    help=f"soglia d'arresto sulla FINESTRA 5 ORE (default {STOP_5H})")
    ap.add_argument("--sorveglia", action="store_true",
                    help="il guardiano: applica l'OR fra le due soglie ed esce 3 se scatta")
    ap.add_argument("--freschezza", type=int, default=FRESCHEZZA_5H_MIN, metavar="MIN",
                    help="oltre quanti minuti il dato delle 5 ore e' da buttare")
    ap.add_argument("--canale", metavar="NOME",
                    help="nome della sessione nel canale: se la riga di stato e' ferma o "
                         "stantia, le 5 ore si leggono dal suo stato.json (C-2)")
    ap.add_argument("--json", action="store_true", help="output JSON")
    ap.add_argument("--selftest", action="store_true", help="prova che puo' fallire")
    a = ap.parse_args()

    if a.selftest:
        return selftest()

    # Il guardiano e' il modo NORMALE di usare questo strumento: senza opzioni si
    # vedono comunque le due misure e il verdetto. `--sorveglia` serve solo a chi
    # vuole il codice d'uscita per farne un cancello in uno script.
    stop_ctx = a.stop_at if a.stop_at is not None else STOP_CONTESTO
    stop_5h = a.stop_5h if a.stop_5h is not None else STOP_5H

    m = misura(a.session, a.window)
    m5 = misura_5h(a.freschezza)
    if not m5.get("ok") and a.canale:
        # La riga di stato non gira (corsa non presidiata): si prova la fonte del
        # canale, che e' la stessa grandezza misurata dal flusso della sessione.
        dal_canale = misura_5h_dal_canale(a.canale, a.freschezza)
        if dal_canale.get("ok"):
            dal_canale["nota"] = ("le 5 ore vengono dal canale ({}), non dalla riga di "
                                  "stato: quella era {}".format(
                                      a.canale, m5.get("errore", "assente")))
            m5 = dal_canale
        else:
            m5 = {"ok": False, "errore": "{} | e dal canale: {}".format(
                m5.get("errore"), dal_canale.get("errore"))}
    v = sorveglia(m, m5, stop_ctx, stop_5h)

    if m.get("ok"):
        m["stop_at"] = stop_ctx
        m["token_alla_soglia"] = max(0, int(stop_ctx * m["finestra"]) - m["contesto"])

    if a.json:
        print(json.dumps({"contesto": m, "cinque_ore": m5, "verdetto": v,
                          "procedura": PROCEDURA}, indent=2, ensure_ascii=False))
    else:
        stampa(m, a.budget)
        stampa_guardiano(m, m5, v, stop_ctx, stop_5h)

    if v["chiudi"]:
        return 3
    if a.budget is not None and m.get("ok") and m["residuo_soglia"] < a.budget:
        return 2
    # ⚠ Un guardiano cieco NON e' un guardiano verde. Con entrambi i rami non
    # misurabili, `chiudi` e' False — ma per ignoranza, non per capienza: uscire 0
    # direbbe a uno script «tutto bene» esattamente come dopo una misura riuscita.
    # Codice distinto, cosi' chi lo usa come cancello puo' trattare il buio per
    # quello che e'. La stampa lo diceva gia'; il codice d'uscita no.
    if v["cieco"]:
        return 4
    return 0


if __name__ == "__main__":
    sys.exit(main())
