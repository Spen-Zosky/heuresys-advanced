#!/usr/bin/env python3
"""
grafo_ts.py - libreria condivisa dagli estrattori V1 (nessun AST: analisi lessicale).

Fornisce:
  - lettura di un sorgente TypeScript senza commenti (cache);
  - risoluzione degli import locali (relativi, alias '@/' dell'app web);
  - 'unita' di un file (funzioni, costanti-funzione, metodi di oggetti/classi) trovate per rientro del testo;
  - il grafo delle chiamate per nome, per seguire una pagina o una rotta fino alle funzioni e ai file che usa.

LIMITI (dichiarati anche nel LEGGIMI.md)
  - Le unita si riconoscono per rientro (2/4 spazi): il codice e' formattato da prettier, un file con altra
    formattazione puo' perdere metodi.
  - Una chiamata si risolve solo se il ricevitore e' un identificatore importato o una unita dello stesso file.
    Le chiamate attraverso oggetti passati come parametri (dependency injection) non sono seguite.
  - A nome uguale in contenitori diversi dello stesso file si seguono tutti: puo' sovrastimare.
"""
import os, re
from functools import lru_cache

from estrai_rotte import toglie_commenti, chiudi_parentesi, salta_stringa

EST = (".tsx", ".ts", ".jsx", ".js", ".mjs")

@lru_cache(maxsize=None)
def leggi_pulito(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return toglie_commenti(f.read())
    except OSError:
        return ""

@lru_cache(maxsize=None)
def leggi_grezzo(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return ""

# ---------------------------------------------------------------- risoluzione degli import
class Risolutore:
    def __init__(self, alias):
        """alias: dict prefisso -> cartella (es. {'@/': '/.../apps/web/src/'})"""
        self.alias = alias

    @lru_cache(maxsize=None)
    def risolvi(self, spec, da_file):
        base = None
        for pre, cart in self.alias.items():
            if spec.startswith(pre):
                base = os.path.join(cart, spec[len(pre):]); break
        if base is None:
            if spec.startswith("."):
                base = os.path.normpath(os.path.join(os.path.dirname(da_file), spec))
            else:
                return None
        cands = [base]
        if base.endswith(".js"): cands.append(base[:-3] + ".ts"); cands.append(base[:-3] + ".tsx")
        cands += [base + e for e in EST] + [os.path.join(base, "index" + e) for e in EST]
        for c in cands:
            if os.path.isfile(c): return c
        return None

RE_IMPORT = re.compile(r"""(?:^|\n)\s*import\s+(?:type\s+)?([\w$]+)?\s*,?\s*(\*\s+as\s+[\w$]+|\{[^}]*\})?\s*from\s*["']([^"']+)["']""")
RE_REEXP = re.compile(r"""(?:^|\n)\s*export\s+(?:type\s+)?(\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*["']([^"']+)["']""")

@lru_cache(maxsize=None)
def importazioni(path, ris):
    """ritorna dict nome_locale -> (file|None, nome_importato|'default'|'*', spec)"""
    t = leggi_pulito(path)
    out = {}
    for m in RE_IMPORT.finditer(t):
        dflt, resto, spec = m.group(1), m.group(2), m.group(3)
        f = ris.risolvi(spec, path)
        if dflt: out[dflt] = (f, "default", spec)
        if resto:
            if resto.startswith("*"):
                out[resto.split()[-1]] = (f, "*", spec)
            else:
                for pezzo in resto.strip("{} \n").split(","):
                    pezzo = pezzo.strip()
                    if not pezzo: continue
                    pezzo = re.sub(r"^type\s+", "", pezzo)
                    parti = re.split(r"\s+as\s+", pezzo)
                    out[parti[-1].strip()] = (f, parti[0].strip(), spec)
    return out

@lru_cache(maxsize=None)
def riesportazioni(path, ris):
    t = leggi_pulito(path)
    out = []
    for m in RE_REEXP.finditer(t):
        f = ris.risolvi(m.group(2), path)
        if not f: continue
        if m.group(1).startswith("*"): out.append(("*", f, None))
        else:
            for pezzo in m.group(1).strip("{} \n").split(","):
                pezzo = pezzo.strip()
                if not pezzo: continue
                parti = re.split(r"\s+as\s+", pezzo)
                out.append((parti[-1].strip(), f, parti[0].strip()))
    return out

# ---------------------------------------------------------------- unita
PAROLE_CHIAVE = {"if", "for", "while", "switch", "catch", "return", "await", "new", "typeof", "function", "super",
                 "import", "export", "else", "do", "try", "throw", "void", "case", "default", "yield", "with"}

class Unita:
    __slots__ = ("nome", "contenitore", "inizio", "fine", "rientro", "file")
    def __init__(self, nome, contenitore, inizio, fine, rientro, file):
        self.nome, self.contenitore, self.inizio, self.fine, self.rientro, self.file = nome, contenitore, inizio, fine, rientro, file
    def testo(self):
        return leggi_pulito(self.file)[self.inizio:self.fine]
    def __repr__(self): return f"<{self.contenitore or ''}.{self.nome}>"

RE_FUNZ = re.compile(r"^(\s*)(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s+([\w$]+)")
RE_CONST_FN = re.compile(r"^(?:export\s+)?(?:const|let)\s+([\w$]+)\b[^=\n]*=\s*(?:async\s+)?(?:\(|function\b|[\w$]+\s*=>|(?:React\.)?(?:memo|forwardRef)\(|dynamic\(|use\w+\(|create\w+\()")
RE_CONT = re.compile(r"^(?:export\s+)?(?:const|let)\s+([\w$]+)\b[^=\n]*=\s*(?:Object\.freeze\()?\{\s*$|^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([\w$]+)")
RE_METODO = re.compile(r"^(\s{2}|\s{4})(?:(?:public|private|protected|static|readonly|async|get|set)\s+)*([\w$]+)\s*(?:<[^>\n]*>)?\s*\(")
RE_PROP_FN = re.compile(r"^(\s{2}|\s{4})([\w$]+)\s*(?::|=)\s*(?:async\s*)?(?:\(|function\b|[\w$]+\s*=>)")

def _e_definizione(testo, pos_aperta):
    """testo[pos_aperta]=='(' : e' la firma di una definizione (segue '{' dopo il ')' ed eventuale tipo)?"""
    fine = chiudi_parentesi(testo, pos_aperta)
    j = fine; n = len(testo); d_ang = 0; d_par = 0
    limite = min(n, fine + 400)
    while j < limite:
        c = testo[j]
        if c == "{" and d_ang == 0 and d_par == 0: return True
        if c == ";" and d_ang == 0 and d_par == 0: return False
        if c == "<": d_ang += 1
        elif c == ">" and testo[j - 1] != "=": d_ang = max(0, d_ang - 1)
        elif c == "(": d_par += 1
        elif c == ")":
            if d_par == 0: return False
            d_par -= 1
        elif c == "=" and j + 1 < n and testo[j + 1] == ">" and d_ang == 0 and d_par == 0: return False
        elif c == "\n" and d_ang == 0 and d_par == 0:
            # una riga nuova senza tipo di ritorno in corso: dopo ')' ci vuole ':' o '{'
            resto = testo[fine:j].strip()
            if resto == "" : pass
            elif not resto.startswith(":"): return False
        j += 1
    return False

@lru_cache(maxsize=None)
def unita_del_file(path):
    t = leggi_pulito(path)
    righe = t.split("\n")
    offs = []; o = 0
    for r in righe:
        offs.append(o); o += len(r) + 1
    defs = []   # (inizio_riga, nome, contenitore, rientro)
    contenitore_corr = None; rientro_cont = None
    for i, r in enumerate(righe):
        if not r.strip(): continue
        ind = len(r) - len(r.lstrip(" "))
        if ind == 0 and not r.startswith(("}", ")", "]")):
            contenitore_corr = None
        s = r[ind:]
        if ind == 0:
            mc = RE_CONT.match(s)
            if mc:
                contenitore_corr = mc.group(1) or mc.group(2)
                continue
            m = RE_FUNZ.match(r)
            if m: defs.append((i, m.group(2), None, 0)); continue
            m = RE_CONST_FN.match(s)
            if m: defs.append((i, m.group(1), None, 0)); continue
            continue
        if ind in (2, 4):
            m = RE_FUNZ.match(r)
            if m and ind == 2 and contenitore_corr is None:
                defs.append((i, m.group(2), None, ind)); continue
            m = RE_METODO.match(r)
            if m and m.group(2) not in PAROLE_CHIAVE:
                pos = offs[i] + r.index("(", m.end(2))
                if _e_definizione(t, pos):
                    defs.append((i, m.group(2), contenitore_corr, ind)); continue
            m = RE_PROP_FN.match(r)
            if m and m.group(2) not in PAROLE_CHIAVE and contenitore_corr is not None and ind == 2:
                defs.append((i, m.group(2), contenitore_corr, ind)); continue
    out = []
    for k, (i, nome, cont, ind) in enumerate(defs):
        # fine: prima riga successiva con rientro <= ind che non sia una chiusura
        j = i + 1
        while j < len(righe):
            rr = righe[j]
            if rr.strip():
                ii = len(rr) - len(rr.lstrip(" "))
                if ii <= ind and not rr.lstrip().startswith(("}", ")", "]", ",", ".", "?", ":", "&&", "||")):
                    break
                if ii <= ind and rr.lstrip().startswith(("}", ")", "]")) and ii < ind:
                    pass
            j += 1
        fine = offs[j] if j < len(righe) else len(t)
        out.append(Unita(nome, cont, offs[i], fine, ind, path))
    return tuple(out)

def unita_per_nome(path, nome, contenitore=None):
    us = [u for u in unita_del_file(path) if u.nome == nome]
    if contenitore:
        sp = [u for u in us if u.contenitore == contenitore]
        if sp: return sp
    return us

def nome_default(path):
    t = leggi_pulito(path)
    m = re.search(r"export\s+default\s+(?:async\s+)?(?:function\s+)?([\w$]+)", t)
    return m.group(1) if m else None
