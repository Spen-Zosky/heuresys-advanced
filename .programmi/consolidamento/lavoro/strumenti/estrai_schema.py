#!/usr/bin/env python3
"""
estrai_schema.py — ricostruzione APPROSSIMATA dello schema risultante di una
catena di migrazioni PostgreSQL, per sola lettura dei file.

Uso:
    python3 estrai_schema.py --progetto advanced  --migrazioni <repo>/db/migrations --uscita <prefisso>
    python3 estrai_schema.py --progetto datastore --migrazioni <repo>/db/migrations --uscita <prefisso>

Produce:
    <prefisso>.tsv          un oggetto per riga (schema, oggetto, tipo, crea, alterano, drop, ...)
    <prefisso>.json         lo stesso, completo (colonne, FK, indici unici, commenti, dipendenze)
    <prefisso>_limiti.tsv   le istruzioni che il parser non ha potuto risolvere (DDL dinamico ecc.)

Regole di lettura:
  * advanced: ogni *.sql della cartella, in ordine lessicale (come db/scripts/migrate.sh).
  * datastore: solo la sezione fra "-- MIGRAZIONE:SU" e "-- MIGRAZIONE:GIU"
    (come src/db/migrazioni.ts, separaDirezioni); la GIU è l'inversa e non si applica.

Limiti dichiarati (si leggono anche nel file _limiti.tsv):
  * Nessun database viene toccato: lo stato EFFETTIVO del DB non è verificato.
  * DDL dentro corpi di FUNZIONE/PROCEDURA non è seguito (gira solo se chiamata).
  * Nei blocchi DO il DDL statico è seguito (con prefissi IF/LOOP rimossi in modo
    euristico) senza valutarne le condizioni: un "IF NOT EXISTS ... THEN CREATE"
    si conta come eseguito.
  * EXECUTE '<letterale>' è seguito; EXECUTE format('...%I...', v) è risolto solo se
    v scorre un ARRAY di costanti dichiarato nello stesso blocco (FOREACH / unnest);
    il resto finisce nei limiti come "dinamico non risolto".
  * DROP SCHEMA ... CASCADE ritira tutti gli oggetti noti dello schema; CASCADE su
    DROP TABLE non ritira le viste dipendenti (non si calcolano le dipendenze).
  * Le colonne delle viste non si ricavano: si riportano le relazioni lette (FROM/JOIN).
  * Il tipo delle colonne è il testo del DDL normalizzato (varchar(n), integer, ...).
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from collections import OrderedDict

# ---------------------------------------------------------------------------
# 1. Scansione: spezza un testo SQL in istruzioni, togliendo i commenti e
#    rispettando stringhe, identificatori fra virgolette e dollar quoting.
# ---------------------------------------------------------------------------
DOLLAR_RE = re.compile(r"\$([A-Za-z_][A-Za-z0-9_]*)?\$")


def split_statements(text: str):
    out = []
    buf = []
    i, n = 0, len(text)
    line = 1
    stmt_line = 1
    at_line_start = True
    has_content = False
    while i < n:
        c = text[i]
        if at_line_start and c == "\\":  # meta-comando psql: \echo, \set, \i ...
            j = text.find("\n", i)
            j = n if j < 0 else j
            i = j
            continue
        if c == "\n":
            line += 1
            at_line_start = True
            buf.append(c)
            i += 1
            continue
        if c in " \t\r":
            buf.append(c)
            i += 1
            continue
        at_line_start = False
        if c == "-" and text.startswith("--", i):
            j = text.find("\n", i)
            i = n if j < 0 else j
            continue
        if c == "/" and text.startswith("/*", i):
            depth, j = 1, i + 2
            while j < n and depth:
                if text.startswith("/*", j):
                    depth += 1; j += 2
                elif text.startswith("*/", j):
                    depth -= 1; j += 2
                else:
                    if text[j] == "\n":
                        line += 1
                    j += 1
            buf.append(" ")
            i = j
            continue
        if c == "'":
            j = i + 1
            while j < n:
                if text[j] == "'":
                    if j + 1 < n and text[j + 1] == "'":
                        j += 2
                        continue
                    break
                if text[j] == "\n":
                    line += 1
                j += 1
            if not has_content:
                stmt_line = line; has_content = True
            buf.append(text[i:j + 1])
            i = j + 1
            continue
        if c == '"':
            j = text.find('"', i + 1)
            j = n - 1 if j < 0 else j
            buf.append(text[i:j + 1])
            i = j + 1
            continue
        if c == "$":
            m = DOLLAR_RE.match(text, i)
            if m and not (i > 0 and (text[i - 1].isalnum() or text[i - 1] == "_")):
                tag = m.group(0)
                j = text.find(tag, m.end())
                j = n if j < 0 else j
                seg = text[i:j + len(tag)]
                if not has_content:
                    stmt_line = line; has_content = True
                line += seg.count("\n")
                buf.append(seg)
                i = j + len(tag)
                continue
        if c == ";":
            s = "".join(buf).strip()
            if s:
                out.append((s, stmt_line))
            buf = []
            has_content = False
            i += 1
            stmt_line = line
            continue
        if not has_content:
            stmt_line = line
            has_content = True
        buf.append(c)
        i += 1
    s = "".join(buf).strip()
    if s:
        out.append((s, stmt_line))
    return out


def norm_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def split_top_level(s: str, sep=","):
    """Spezza per separatore a livello zero di parentesi, fuori da stringhe."""
    parts, depth, buf, i, n = [], 0, [], 0, len(s)
    while i < n:
        c = s[i]
        if c == "'":
            j = i + 1
            while j < n:
                if s[j] == "'" and not (j + 1 < n and s[j + 1] == "'"):
                    break
                if s[j] == "'":
                    j += 1
                j += 1
            buf.append(s[i:j + 1]); i = j + 1; continue
        if c == '"':
            j = s.find('"', i + 1); j = n - 1 if j < 0 else j
            buf.append(s[i:j + 1]); i = j + 1; continue
        if c == "$":
            m = DOLLAR_RE.match(s, i)
            if m:
                j = s.find(m.group(0), m.end()); j = n if j < 0 else j
                buf.append(s[i:j + len(m.group(0))]); i = j + len(m.group(0)); continue
        if c in "([":
            depth += 1
        elif c in ")]":
            depth -= 1
        if c == sep and depth == 0:
            parts.append("".join(buf).strip()); buf = []; i += 1; continue
        buf.append(c); i += 1
    if "".join(buf).strip():
        parts.append("".join(buf).strip())
    return parts


def paren_body(s: str, start: int):
    """Dato l'indice di '(' restituisce (contenuto, indice dopo ')')."""
    depth, i, n = 0, start, len(s)
    while i < n:
        c = s[i]
        if c == "'":
            j = i + 1
            while j < n:
                if s[j] == "'" and not (j + 1 < n and s[j + 1] == "'"):
                    break
                if s[j] == "'":
                    j += 1
                j += 1
            i = j + 1; continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return s[start + 1:i], i + 1
        i += 1
    return s[start + 1:], n


IDENT = r'(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)'
QNAME = rf"{IDENT}(?:\s*\.\s*{IDENT})?"


def unq(x: str) -> str:
    x = x.strip()
    if x.startswith('"') and x.endswith('"'):
        return x[1:-1]
    return x.lower()


def split_q(q: str, default_schema: str):
    parts = [p for p in re.findall(IDENT, q)]
    if len(parts) >= 2:
        return unq(parts[0]), unq(parts[1])
    return default_schema, unq(parts[0])


TYPE_ALIASES = [
    (r"^character varying", "varchar"), (r"^int4$", "integer"), (r"^int$", "integer"),
    (r"^int8$", "bigint"), (r"^int2$", "smallint"), (r"^bool$", "boolean"),
    (r"^timestamp with time zone", "timestamptz"), (r"^timestamp without time zone", "timestamp"),
    (r"^float8$", "double precision"), (r"^character\(", "char("), (r"^decimal", "numeric"),
]


def norm_type(t: str) -> str:
    t = norm_ws(t).lower().replace(" (", "(")
    t = re.sub(r"\s*,\s*", ",", t)
    for pat, rep in TYPE_ALIASES:
        t = re.sub(pat, rep, t)
    return t


CONSTRAINT_WORDS = {"not", "null", "default", "primary", "references", "unique", "check",
                    "constraint", "generated", "collate", "deferrable", "initially"}
TABLE_CONSTRAINT_START = re.compile(r"^(constraint|primary\s+key|unique|foreign\s+key|check|exclude|like)\b", re.I)


def parse_column_def(d: str):
    """'name type [constraints]' -> (name, type, rest)."""
    m = re.match(rf"\s*({IDENT})\s+(.*)$", d, re.S)
    if not m:
        return None
    name = unq(m.group(1))
    rest = m.group(2)
    toks = []
    i = 0
    s = rest
    # leggi il tipo fino alla prima parola di vincolo a livello zero
    depth = 0
    word = ""
    out = []
    j = 0
    while j < len(s):
        c = s[j]
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        if depth == 0 and (c.isspace()):
            # guarda la parola seguente
            k = j
            while k < len(s) and s[k].isspace():
                k += 1
            mm = re.match(r"[A-Za-z_]+", s[k:])
            if mm and mm.group(0).lower() in CONSTRAINT_WORDS:
                return name, norm_type("".join(out)), s[k:]
        out.append(c)
        j += 1
    return name, norm_type("".join(out)), ""


# ---------------------------------------------------------------------------
# 2. Modello degli oggetti
# ---------------------------------------------------------------------------
REL_KINDS = {"TABLE", "VIEW", "MATERIALIZED VIEW"}


class Obj:
    def __init__(self, schema, name, kind, mig, origin):
        self.schema, self.name, self.kind = schema, name, kind
        self.created = mig
        self.recreated = []
        self.altered = []
        self.dropped = None
        self.drop_history = []
        self.columns = OrderedDict()
        self.pk = []
        self.fks = []          # (cols, target)
        self.uniques = []      # liste di colonne / espressioni
        self.uq_by_name = {}   # nome indice/vincolo -> voce di uniques
        self.indexes = 0
        self.comment = ""
        self.deps = []
        self.origin = set([origin])
        self.extra = {}

    def touch(self, mig):
        if mig != self.created and mig not in self.altered:
            self.altered.append(mig)

    def key(self):
        return (self.schema, self.name)


class Schema:
    def __init__(self):
        self.rel = {}      # (schema,name) -> Obj  (tabelle, viste, mviews: stesso namespace)
        self.func = {}
        self.trig = {}
        self.typ = {}
        self.sch = {}
        self.ext = {}
        self.indexes = {}  # (schema, index_name) -> (schema, table)
        self.limits = []   # (migrazione, riga, motivo, testo)
        self.stats = {"istruzioni": 0, "in_do": 0, "execute_risolti": 0, "execute_non_risolti": 0,
                      "non_riconosciute_ddl": 0}

    def limit(self, mig, line, why, txt):
        self.limits.append((mig, line, why, norm_ws(txt)[:300]))


# ---------------------------------------------------------------------------
# 3. Interpretazione delle istruzioni
# ---------------------------------------------------------------------------
CTRL_PREFIX = re.compile(
    r"^(?:begin\b|declare\b.*?\bbegin\b|end\s+if\b|end\s+loop\b|end\b(?!\s*\w)|else\b|loop\b|"
    r"(?:if|elsif)\b.*?\bthen\b|exception\s+when\b.*?\bthen\b|when\b.*?\bthen\b|"
    r"for\b.*?\bloop\b|foreach\b.*?\bloop\b|while\b.*?\bloop\b|<<\w+>>)\s*", re.I | re.S)

DDL_START = re.compile(r"^(create|alter|drop|comment\s+on|execute)\b", re.I)


class Interp:
    def __init__(self, project):
        self.project = project
        self.S = Schema()
        self.default_schema = "public"
        self.temp_names = set()

    # --- utilità ---
    def rel_get(self, schema, name):
        return self.S.rel.get((schema, name))

    def rel_alive(self, schema, name):
        o = self.rel_get(schema, name)
        return o if (o and o.dropped is None) else None

    def create_rel(self, schema, name, kind, mig, origin, replace=False, if_not_exists=False):
        o = self.rel_get(schema, name)
        if o is None:
            o = Obj(schema, name, kind, mig, origin)
            self.S.rel[(schema, name)] = o
            return o, True
        o.origin.add(origin)
        if o.dropped is not None:
            o.recreated.append(mig)
            o.dropped = None
            o.kind = kind
            if kind == "TABLE":
                o.columns = OrderedDict(); o.pk = []; o.fks = []; o.uniques = []
            return o, True
        if if_not_exists and kind == "TABLE":
            o.extra.setdefault("riaffermata_in", [])
            if mig not in o.extra["riaffermata_in"] and mig != o.created:
                o.extra["riaffermata_in"].append(mig)
            return o, False
        o.touch(mig)
        if kind != o.kind:
            o.extra.setdefault("cambio_tipo", []).append(f"{o.kind}->{kind}@{mig}")
            o.kind = kind
        return o, (kind != "TABLE")

    def drop_obj(self, store, key, mig, line, txt, kind_label):
        o = store.get(key)
        if o is None:
            if key[1] in self.temp_names or key[1].split(" ON ")[0] in self.temp_names:
                return
            if "if exists" not in txt.lower():
                self.S.limit(mig, line, f"DROP {kind_label} di oggetto mai visto creato", txt)
            return
        if o.dropped is None:
            o.dropped = mig
            o.drop_history.append(mig)

    # --- dispatcher ---
    def run_statement(self, stmt, mig, line, origin, ctx_arrays=None):
        s = norm_ws(stmt)
        low = s.lower()
        self.S.stats["istruzioni"] += 1
        m = re.match(r"^set\s+(?:local\s+)?search_path\s*(?:to|=)\s*(.+)$", low)
        if m:
            first = m.group(1).split(",")[0].strip().strip("'\"")
            self.default_schema = first if first not in ("", "default") else "public"
            return
        if re.match(r"^do\b", low):
            self.run_do(stmt, mig, line, ctx_arrays)
            return
        if not DDL_START.match(low):
            return
        try:
            self.dispatch(s, low, mig, line, origin)
        except Exception as e:  # il parser è approssimato: non deve fermarsi
            self.S.limit(mig, line, f"errore di parsing: {e.__class__.__name__}: {e}", s)

    # --- blocchi DO: DDL statico + EXECUTE risolti quando possibile ---
    def _like_to_re(self, pat):
        out = ""
        i = 0
        while i < len(pat):
            c = pat[i]
            if c == "\\" and i + 1 < len(pat):
                out += re.escape(pat[i + 1]); i += 2; continue
            out += ".*" if c == "%" else ("." if c == "_" else re.escape(c))
            i += 1
        return "^" + out + "$"

    def _loop_headers(self, body, arrays):
        """Restituisce [(offset, var, [valori])]; un valore è str o dict (record)."""
        hs = []
        for fm in re.finditer(r"\bforeach\s+(\w+)\s+in\s+array\s+(ARRAY\s*\[(.*?)\]|\w+)\s*loop", body, re.I | re.S):
            if fm.group(3) is not None:
                vals = re.findall(r"'([^']*)'", fm.group(3))
            else:
                vals = arrays.get(fm.group(2).lower())
            if vals is not None:
                hs.append((fm.start(), fm.group(1).lower(), vals))
        for fm in re.finditer(r"\bfor\s+(\w+)\s+in\s+(?:select\s+(?:\*\s+from\s+)?)?unnest\s*\(\s*(ARRAY\s*\[(.*?)\]|\w+)\s*\)", body, re.I | re.S):
            vals = re.findall(r"'([^']*)'", fm.group(3)) if fm.group(3) is not None else arrays.get(fm.group(2).lower())
            if vals is not None:
                hs.append((fm.start(), fm.group(1).lower(), vals))
        for fm in re.finditer(r"\bfor\s+(\w+)\s+in\s+select\s+\*\s+from\s+(\()\s*values\b", body, re.I | re.S):
            inner, after = paren_body(body, fm.start(2))
            am = re.match(r"\s*(?:as\s+)?\w+\s*\(([^)]*)\)", body[after:], re.I)
            if not am:
                continue
            cols = [c.strip().lower() for c in am.group(1).split(",")]
            vals_txt = re.sub(r"^\s*values\s*", "", inner, flags=re.I)
            rows = []
            for tup in split_top_level(vals_txt):
                tup = tup.strip()
                if not tup.startswith("("):
                    continue
                tb, _ = paren_body(tup, 0)
                vs = []
                for x in split_top_level(tb):
                    mm = re.fullmatch(r"\s*'((?:[^']|'')*)'\s*(?:::\w+)?\s*", x, re.S)
                    vs.append(mm.group(1).replace("''", "'") if mm else None)
                if len(vs) == len(cols):
                    rows.append(dict(zip(cols, vs)))
            hs.append((fm.start(), fm.group(1).lower(), rows if rows else None))
        for fm in re.finditer(r"\bfor\s+(\w+)\s+in\s+select\s+tablename\s+from\s+pg_tables\s+where\s+(.*?)\s+loop", body, re.I | re.S):
            cond = fm.group(2)
            sm = re.search(r"schemaname\s*=\s*'([^']+)'", cond, re.I)
            if not sm:
                continue
            sch = sm.group(1)
            likes = [self._like_to_re(x) for x in re.findall(r"tablename\s+like\s+'([^']*)'", cond, re.I)]
            eqs = re.findall(r"tablename\s*=\s*'([^']*)'", cond, re.I)
            names = []
            for (sc, nm), o in self.S.rel.items():
                if sc != sch or o.dropped is not None or o.kind != "TABLE":
                    continue
                if (not likes and not eqs) or nm in eqs or any(re.match(r, nm) for r in likes):
                    names.append({"tablename": nm})
            hs.append((fm.start(), fm.group(1).lower(), names))
        hs.sort()
        return hs

    def _eval(self, expr, env):
        parts = [p.strip() for p in re.split(r"\|\|", expr)]
        out = ""
        for p in parts:
            m = re.fullmatch(r"'((?:[^']|'')*)'(?:::\w+)?", p, re.S)
            if m:
                out += m.group(1).replace("''", "'"); continue
            m = re.fullmatch(r"(\w+)(?:\.(\w+))?", p)
            if m:
                v = env.get(m.group(1).lower())
                if isinstance(v, dict) and m.group(2):
                    v = v.get(m.group(2).lower())
                if isinstance(v, str):
                    out += v; continue
            return None
        return out

    def run_do(self, stmt, mig, line, outer_arrays=None):
        m = DOLLAR_RE.search(stmt)
        if not m:
            self.S.limit(mig, line, "DO senza corpo dollar-quoted", stmt); return
        tag = m.group(0)
        end = stmt.find(tag, m.end())
        body = stmt[m.end(): end if end >= 0 else len(stmt)]
        # togli i commenti dal corpo per la ricerca delle intestazioni
        body_nc = re.sub(r"--[^\n]*", "", body)
        arrays = dict(outer_arrays or {})
        for am in re.finditer(r"(\w+)\s+(?:constant\s+)?text\[\]\s*:=\s*ARRAY\s*\[(.*?)\]", body_nc, re.I | re.S):
            arrays[am.group(1).lower()] = re.findall(r"'([^']*)'", am.group(2))
        headers = self._loop_headers(body_nc, arrays)
        # offset di ogni istruzione nel corpo senza commenti
        subs = split_statements(body_nc)
        pos = 0
        for sub, sl in subs:
            off = body_nc.find(sub[:40], pos) if sub else pos
            if off >= 0:
                pos = off + 1
            else:
                off = pos
            self.S.stats["in_do"] += 1
            t = sub.strip()
            for _ in range(8):
                t2 = CTRL_PREFIX.sub("", t, count=1)
                if t2 == t:
                    break
                t = t2
            if not t:
                continue
            tl = t.lower()
            if tl.startswith("execute"):
                self.run_execute(t, mig, line + sl - 1, headers, body_nc, off + len(sub))
            elif DDL_START.match(tl):
                self.run_statement(t, mig, line + sl - 1, "DO")
            else:
                mm = re.search(r"\b(create|alter|drop)\s+(?:or\s+replace\s+)?(?:unique\s+)?(table|view|materialized|function|type|trigger|schema|index)\b", t, re.I)
                if mm and "'" not in t[:mm.start()][-1:]:
                    self.run_statement(t[mm.start():], mig, line + sl - 1, "DO")

    def run_execute(self, t, mig, line, headers=None, body="", off=0):
        headers = headers or []
        m = re.match(r"^execute\s+'((?:[^']|'')*)'\s*(?:into\b.*|using\b.*)?$", t, re.I | re.S)
        if m:
            inner = m.group(1).replace("''", "'")
            if DDL_START.match(inner.strip().lower()):
                self.S.stats["execute_risolti"] += 1
                self.run_statement(inner, mig, line, "EXECUTE")
            return
        m = re.match(r"^execute\s+(\$\w*\$)(.*?)\1\s*(?:into\b.*|using\b.*)?$", t, re.I | re.S)
        if m:
            inner = m.group(2)
            if DDL_START.match(inner.strip().lower()):
                self.S.stats["execute_risolti"] += 1
                self.run_statement(inner, mig, line, "EXECUTE")
            return
        m = re.match(r"^execute\s+format\s*\(\s*(.*)\)\s*(?:into\b.*|using\b.*)?$", t, re.I | re.S)
        if m:
            inner = m.group(1)
            # template: '..' '..' (concatenazione implicita) oppure $f$..$f$
            tm = re.match(r"((?:'(?:[^']|'')*'\s*)+)", inner, re.S)
            if tm:
                tmpl = "".join(x.replace("''", "'") for x in re.findall(r"'((?:[^']|'')*)'", tm.group(1)))
                rest = inner[tm.end():]
            else:
                dm = re.match(r"(\$\w*\$)(.*?)\1", inner, re.S)
                if not dm:
                    self.S.stats["execute_non_risolti"] += 1
                    self.S.limit(mig, line, "DDL dinamico non risolto (template non letterale)", t); return
                tmpl, rest = dm.group(2), inner[dm.end():]
            if not DDL_START.match(tmpl.strip().lower()):
                return  # SELECT/UPDATE dinamici: non toccano lo schema
            args = split_top_level(rest.lstrip().lstrip(",")) if rest.strip().lstrip(",").strip() else []
            # intestazione di ciclo più vicina che precede l'istruzione
            hdr = [h for h in headers if h[0] <= off]
            consts = {}
            for cm in re.finditer(r"(\w+)\s+(?:constant\s+)?(?:text|varchar(?:\(\d+\))?)\s*:=\s*'([^']*)'\s*;", body, re.I):
                consts[cm.group(1).lower()] = cm.group(2)
            envs = [dict(consts)] if consts else None
            if hdr and hdr[-1][2] == []:
                return  # ciclo risolto su un insieme vuoto: nessun effetto
            if hdr and hdr[-1][2] is None:
                hdr = []
            if hdr:
                hoff, var, vals = hdr[-1]
                seg = body[hoff:off]
                assigns = re.findall(r"(\w+)\s*:=\s*([^;]+);", seg)
                envs = []
                for v in vals:
                    env = dict(consts); env[var] = v
                    for an, ae in assigns:
                        r = self._eval(ae, env)
                        if r is not None:
                            env[an.lower()] = r
                    envs.append(env)
            done = False
            if envs:
                outs = []
                for env in envs:
                    vals_ = [self._eval(x, env) for x in args]
                    if any(x is None for x in vals_):
                        outs = None; break
                    k = 0
                    def rep(mm):
                        nonlocal k
                        if mm.group(0) == "%%":
                            return "%"
                        v = vals_[k] if k < len(vals_) else ""
                        k += 1
                        return v if mm.group(0) != "%L" else "'" + v.replace("'", "''") + "'"
                    outs.append(re.sub(r"%%|%[IsL]", rep, tmpl))
                if outs is not None:
                    for o in outs:
                        self.S.stats["execute_risolti"] += 1
                        self.run_statement(o, mig, line, "EXECUTE")
                    done = True
                    if not envs:
                        pass
            if not done:
                self.S.stats["execute_non_risolti"] += 1
                self.S.limit(mig, line, "DDL dinamico non risolto (EXECUTE format)", t)
            return
        if re.search(r"\b(create|alter|drop)\b", t, re.I):
            self.S.stats["execute_non_risolti"] += 1
            self.S.limit(mig, line, "DDL dinamico non risolto (EXECUTE di variabile)", t)

    def dispatch(self, s, low, mig, line, origin):
        ds = self.default_schema
        # ---------------- SCHEMA
        m = re.match(rf"^create\s+schema\s+(?:if\s+not\s+exists\s+)?({IDENT})", s, re.I)
        if m:
            name = unq(m.group(1))
            o = self.S.sch.get(name)
            if o is None:
                self.S.sch[name] = Obj(name, name, "SCHEMA", mig, origin)
            elif o.dropped:
                o.dropped = None; o.recreated.append(mig)
            return
        m = re.match(rf"^drop\s+schema\s+(?:if\s+exists\s+)?(.+?)(\s+cascade|\s+restrict)?$", s, re.I)
        if m:
            for nm in re.findall(IDENT, m.group(1)):
                name = unq(nm)
                o = self.S.sch.get(name)
                if o and o.dropped is None:
                    o.dropped = mig; o.drop_history.append(mig)
                if True:  # se DROP SCHEMA riesce, nello schema non resta nulla (CASCADE o RESTRICT)
                    for store in (self.S.rel, self.S.func, self.S.trig, self.S.typ):
                        for k, ob in store.items():
                            if ob.schema == name and ob.dropped is None:
                                ob.dropped = mig; ob.drop_history.append(mig)
                                ob.extra["ritirato_da"] = f"DROP SCHEMA {name}"
            return
        # ---------------- EXTENSION
        m = re.match(rf"^create\s+extension\s+(?:if\s+not\s+exists\s+)?({IDENT})", s, re.I)
        if m:
            name = unq(m.group(1))
            if name not in self.S.ext:
                self.S.ext[name] = Obj("-", name, "EXTENSION", mig, origin)
            return
        # ---------------- TABLE
        m = re.match(rf"^create\s+(?:(?:global\s+|local\s+)?(temp|temporary|unlogged)\s+)?table\s+(if\s+not\s+exists\s+)?({QNAME})\s*(.*)$", s, re.I | re.S)
        if m:
            if m.group(1) and m.group(1).lower() in ("temp", "temporary"):
                self.temp_names.add(split_q(m.group(3), ds)[1])
                return
            schema, name = split_q(m.group(3), ds)
            rest = m.group(4)
            o, fresh = self.create_rel(schema, name, "TABLE", mig, origin, if_not_exists=bool(m.group(2)))
            if re.match(r"^as\b", rest, re.I) or re.match(r"^\(\s*[^)]*\)\s*as\b", rest, re.I):
                if fresh:
                    o.extra["create_as"] = True
                    o.deps = self.find_deps(rest)
                return
            if re.match(r"^partition\s+of\b", rest, re.I):
                if fresh:
                    pm = re.match(rf"^partition\s+of\s+({QNAME})", rest, re.I)
                    o.extra["partition_of"] = ".".join(split_q(pm.group(1), ds)) if pm else "?"
                return
            if rest.startswith("("):
                body, after = paren_body(rest, 0)
                if fresh:
                    self.parse_table_body(o, body, ds)
                    pm = re.search(r"\bpartition\s+by\s+(\w+)", rest[after:], re.I)
                    if pm:
                        o.extra["partitioned_by"] = pm.group(1).upper()
                return
            self.S.limit(mig, line, "CREATE TABLE in forma non riconosciuta", s)
            return
        # ---------------- VIEW / MATERIALIZED VIEW
        m = re.match(rf"^create\s+(or\s+replace\s+)?(?:temp\s+|temporary\s+)?(?:recursive\s+)?(materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?({QNAME})\s*(.*)$", s, re.I | re.S)
        if m:
            kind = "MATERIALIZED VIEW" if m.group(2) else "VIEW"
            schema, name = split_q(m.group(3), ds)
            o, _ = self.create_rel(schema, name, kind, mig, origin, replace=bool(m.group(1)))
            rest = m.group(4)
            if rest.startswith("("):
                cols, after = paren_body(rest, 0)
                o.columns = OrderedDict((unq(c), "") for c in split_top_level(cols))
                rest = rest[after:]
            o.deps = self.find_deps(rest)
            return
        # ---------------- DROP TABLE/VIEW/MVIEW
        m = re.match(r"^drop\s+(table|view|materialized\s+view|foreign\s+table)\s+(?:if\s+exists\s+)?(.+?)(\s+cascade|\s+restrict)?$", s, re.I)
        if m:
            for q in split_top_level(m.group(2)):
                schema, name = split_q(q, ds)
                self.drop_obj(self.S.rel, (schema, name), mig, line, s, m.group(1).upper())
            return
        # ---------------- ALTER TABLE
        m = re.match(rf"^alter\s+(table|view|materialized\s+view|foreign\s+table)\s+(?:if\s+exists\s+)?(?:only\s+)?({QNAME})\s*\*?\s*(.*)$", s, re.I | re.S)
        if m:
            schema, name = split_q(m.group(2), ds)
            self.alter_rel(schema, name, m.group(3), mig, line, s)
            return
        m = re.match(r"^alter\s+table\s+all\s+in\s+tablespace", s, re.I)
        if m:
            return
        # ---------------- INDEX
        m = re.match(rf"^create\s+(unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?({IDENT}\s+)?on\s+(?:only\s+)?({QNAME})\s*(?:using\s+(\w+)\s*)?(.*)$", s, re.I | re.S)
        if m:
            schema, tname = split_q(m.group(3), ds)
            o = self.rel_get(schema, tname)
            iname = unq(m.group(2)) if m.group(2) else f"<anon>@{tname}"
            self.S.indexes[(schema, iname)] = (schema, tname)
            if o:
                o.indexes += 1
                o.touch(mig) if False else None
                if m.group(1):
                    rest = m.group(5)
                    if rest.startswith("("):
                        cols, after = paren_body(rest, 0)
                        where = rest[after:].strip()
                        u = norm_ws(cols)
                        if re.search(r"\bwhere\b", where, re.I):
                            u += " [parziale]"
                        o.uniques.append(u)
                        o.uq_by_name[iname] = u
                if (m.group(4) or "").lower() in ("hnsw", "ivfflat"):
                    o.extra["indice_vettoriale"] = m.group(4).lower()
            return
        m = re.match(r"^drop\s+index\s+(?:concurrently\s+)?(?:if\s+exists\s+)?(.+?)(\s+cascade|\s+restrict)?$", s, re.I)
        if m:
            for q in split_top_level(m.group(1)):
                sc, iname = split_q(q, ds)
                tgt = self.S.indexes.pop((sc, iname), None)
                o = self.rel_get(*tgt) if tgt else None
                if o:
                    o.indexes = max(0, o.indexes - 1)
                    u = o.uq_by_name.pop(iname, None)
                    if u is not None and u in o.uniques:
                        o.uniques.remove(u)
            return
        m = re.match(r"^alter\s+index\b", s, re.I)
        if m:
            return
        # ---------------- FUNCTION / PROCEDURE
        m = re.match(rf"^create\s+(or\s+replace\s+)?(function|procedure)\s+({QNAME})\s*\(", s, re.I)
        if m:
            schema, name = split_q(m.group(3), ds)
            args, after = paren_body(s, m.end() - 1)
            key = (schema, name)
            o = self.S.func.get(key)
            if o is None:
                o = Obj(schema, name, m.group(2).upper(), mig, origin)
                self.S.func[key] = o
            elif o.dropped is not None:
                o.dropped = None; o.recreated.append(mig)
            else:
                o.touch(mig)
            o.extra.setdefault("firme", [])
            sig = norm_ws(args)[:120]
            if sig not in o.extra["firme"]:
                o.extra["firme"].append(sig)
            rm = re.search(r"\breturns\s+(setof\s+\S+|table\s*\(|trigger|event_trigger|\S+)", s[after:], re.I)
            if rm:
                o.extra["returns"] = rm.group(1).lower().rstrip("(").strip()
            lm = re.search(r"\blanguage\s+(\w+)", s[after:], re.I)
            if lm:
                o.extra["language"] = lm.group(1).lower()
            return
        m = re.match(rf"^drop\s+(function|procedure)\s+(?:if\s+exists\s+)?(.+?)(\s+cascade|\s+restrict)?$", s, re.I)
        if m:
            for q in split_top_level(m.group(2)):
                qm = re.match(rf"\s*({QNAME})", q)
                if qm:
                    schema, name = split_q(qm.group(1), ds)
                    self.drop_obj(self.S.func, (schema, name), mig, line, s, "FUNCTION")
            return
        m = re.match(r"^alter\s+(function|procedure)\b", s, re.I)
        if m:
            return
        # ---------------- TRIGGER
        m = re.match(rf"^create\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+({IDENT})\s+.*?\bon\s+({QNAME})", s, re.I | re.S)
        if m:
            tname = unq(m.group(1))
            schema, table = split_q(m.group(2), ds)
            key = (schema, f"{tname} ON {table}")
            o = self.S.trig.get(key)
            if o is None:
                o = Obj(schema, f"{tname} ON {table}", "TRIGGER", mig, origin)
                self.S.trig[key] = o
            elif o.dropped is not None:
                o.dropped = None; o.recreated.append(mig)
            else:
                o.touch(mig)
            fm = re.search(rf"execute\s+(?:function|procedure)\s+({QNAME})", s, re.I)
            if fm:
                o.extra["funzione"] = ".".join(split_q(fm.group(1), ds))
            return
        m = re.match(rf"^create\s+event\s+trigger\s+({IDENT})", s, re.I)
        if m:
            key = ("-", "EVENT " + unq(m.group(1)))
            if key not in self.S.trig:
                self.S.trig[key] = Obj("-", "EVENT " + unq(m.group(1)), "EVENT TRIGGER", mig, origin)
            return
        m = re.match(rf"^drop\s+trigger\s+(?:if\s+exists\s+)?({IDENT})\s+on\s+({QNAME})", s, re.I)
        if m:
            tname = unq(m.group(1))
            schema, table = split_q(m.group(2), ds)
            self.drop_obj(self.S.trig, (schema, f"{tname} ON {table}"), mig, line, s, "TRIGGER")
            return
        m = re.match(rf"^drop\s+event\s+trigger\s+(?:if\s+exists\s+)?({IDENT})", s, re.I)
        if m:
            self.drop_obj(self.S.trig, ("-", "EVENT " + unq(m.group(1))), mig, line, s, "EVENT TRIGGER")
            return
        # ---------------- TYPE / DOMAIN
        m = re.match(rf"^create\s+type\s+({QNAME})\s+as\s+(enum|range|\()\s*(.*)$", s, re.I | re.S)
        if m:
            schema, name = split_q(m.group(1), ds)
            kind = {"enum": "TYPE ENUM", "range": "TYPE RANGE"}.get(m.group(2).lower(), "TYPE COMPOSITE")
            o = self.S.typ.get((schema, name))
            if o is None or o.dropped:
                o = Obj(schema, name, kind, mig, origin)
                self.S.typ[(schema, name)] = o
            if kind == "TYPE ENUM":
                o.extra["valori"] = re.findall(r"'([^']*)'", m.group(3))
            return
        m = re.match(rf"^create\s+domain\s+({QNAME})\s+(?:as\s+)?(.*)$", s, re.I | re.S)
        if m:
            schema, name = split_q(m.group(1), ds)
            o = Obj(schema, name, "DOMAIN", mig, origin)
            o.extra["base"] = norm_ws(m.group(2))[:80]
            self.S.typ[(schema, name)] = o
            return
        m = re.match(rf"^drop\s+(type|domain)\s+(?:if\s+exists\s+)?(.+?)(\s+cascade|\s+restrict)?$", s, re.I)
        if m:
            for q in split_top_level(m.group(2)):
                schema, name = split_q(q, ds)
                self.drop_obj(self.S.typ, (schema, name), mig, line, s, "TYPE")
            return
        m = re.match(rf"^alter\s+type\s+({QNAME})\s+add\s+value\s+(?:if\s+not\s+exists\s+)?'([^']*)'", s, re.I)
        if m:
            schema, name = split_q(m.group(1), ds)
            o = self.S.typ.get((schema, name))
            if o:
                o.touch(mig); o.extra.setdefault("valori", []).append(m.group(2))
            return
        # ---------------- COMMENT ON
        m = re.match(rf"^comment\s+on\s+(table|view|materialized\s+view|column|function|schema)\s+({QNAME}(?:\s*\.\s*{IDENT})?)\s*(\([^)]*\))?\s+is\s+(.*)$", s, re.I | re.S)
        if m:
            what = m.group(1).lower()
            txt = " ".join(x.replace("''", "'") for x in re.findall(r"'((?:[^']|'')*)'", m.group(4)))
            parts = [unq(p) for p in re.findall(IDENT, m.group(2))]
            if what in ("table", "view", "materialized view"):
                schema, name = (parts[0], parts[1]) if len(parts) >= 2 else (ds, parts[0])
                o = self.rel_get(schema, name)
                if o:
                    o.comment = txt
            elif what == "column":
                if len(parts) >= 3:
                    schema, name, col = parts[0], parts[1], parts[2]
                else:
                    schema, name, col = ds, parts[0], parts[1]
                o = self.rel_get(schema, name)
                if o:
                    o.extra.setdefault("commenti_colonne", {})[col] = txt[:200]
            elif what == "function":
                schema, name = (parts[0], parts[1]) if len(parts) >= 2 else (ds, parts[0])
                o = self.S.func.get((schema, name))
                if o:
                    o.comment = txt
            return
        if re.match(r"^(alter|create|drop)\s+(sequence|policy|role|user|default|publication|subscription|statistics|rule|server|collation|operator|aggregate|cast|text\s+search)\b", s, re.I):
            return
        if re.match(r"^(alter|create)\s+(schema|extension|database|system)\b", s, re.I):
            return
        if re.match(r"^comment\s+on\b", s, re.I):
            return
        if re.match(r"^drop\s+(extension|policy|role|owned|rule|sequence|cast|aggregate|operator)\b", s, re.I):
            return
        if re.match(r"^execute\b", s, re.I):
            return
        self.S.stats["non_riconosciute_ddl"] += 1
        self.S.limit(mig, line, "DDL non riconosciuto", s)

    def find_deps(self, select_text):
        deps = []
        for m in re.finditer(rf"\b(?:from|join)\s+({QNAME})", select_text, re.I):
            q = m.group(1)
            if "." not in q:
                continue  # alias di CTE o funzioni: solo nomi qualificati
            sc, nm = split_q(q, self.default_schema)
            d = f"{sc}.{nm}"
            if d not in deps:
                deps.append(d)
        return deps

    def parse_table_body(self, o, body, ds):
        for d in split_top_level(body):
            if TABLE_CONSTRAINT_START.match(d):
                self.table_constraint(o, d, ds)
                continue
            r = parse_column_def(d)
            if not r:
                continue
            name, typ, rest = r
            o.columns[name] = typ
            self.inline_constraints(o, name, rest, ds)

    def inline_constraints(self, o, col, rest, ds):
        if re.search(r"\bprimary\s+key\b", rest, re.I):
            o.pk = [col]
        fm = re.search(rf"\breferences\s+({QNAME})", rest, re.I)
        if fm:
            o.fks.append(([col], ".".join(split_q(fm.group(1), ds))))
        if re.search(r"\bunique\b", rest, re.I):
            o.uniques.append(col)

    def table_constraint(self, o, d, ds):
        nm = re.match(rf"^constraint\s+({IDENT})\s+", d, re.I)
        cname = unq(nm.group(1)) if nm else None
        dd = re.sub(rf"^constraint\s+{IDENT}\s+", "", d, flags=re.I)
        m = re.match(r"^primary\s+key\s*\(([^)]*)\)", dd, re.I)
        if m:
            o.pk = [unq(c) for c in m.group(1).split(",")]
            return
        m = re.match(rf"^foreign\s+key\s*\(([^)]*)\)\s*references\s+({QNAME})", dd, re.I)
        if m:
            o.fks.append(([unq(c) for c in m.group(1).split(",")], ".".join(split_q(m.group(2), ds))))
            return
        m = re.match(r"^unique\s*(?:nulls\s+not\s+distinct\s*)?\(([^)]*)\)", dd, re.I)
        if m:
            u = norm_ws(m.group(1))
            o.uniques.append(u)
            if cname:
                o.uq_by_name[cname] = u
            return

    def alter_rel(self, schema, name, actions, mig, line, s):
        o = self.rel_get(schema, name)
        if o is None:
            self.S.limit(mig, line, "ALTER su oggetto mai visto creato (creato fuori dalla catena o dinamicamente)", s)
            o = Obj(schema, name, "TABLE", "?fuori-catena", "ALTER")
            self.S.rel[(schema, name)] = o
        o.touch(mig)
        ds = self.default_schema
        m = re.match(rf"^rename\s+to\s+({IDENT})", actions, re.I)
        if m:
            new = unq(m.group(1))
            self._move(o, schema, new, mig, f"RENAME {name}->{new}")
            return
        m = re.match(rf"^set\s+schema\s+({IDENT})", actions, re.I)
        if m:
            self._move(o, unq(m.group(1)), name, mig, f"SET SCHEMA {schema}->{unq(m.group(1))}")
            return
        for a in split_top_level(actions):
            al = a.lower()
            mm = re.match(rf"^rename\s+(?:column\s+)?({IDENT})\s+to\s+({IDENT})", a, re.I)
            if mm and not al.startswith("rename constraint"):
                old, new = unq(mm.group(1)), unq(mm.group(2))
                if old in o.columns:
                    o.columns = OrderedDict((new if k == old else k, v) for k, v in o.columns.items())
                    o.pk = [new if c == old else c for c in o.pk]
                    o.fks = [([new if c == old else c for c in cs], t) for cs, t in o.fks]
                    o.uniques = [re.sub(rf"\b{re.escape(old)}\b", new, u) for u in o.uniques]
                continue
            if al.startswith("rename constraint"):
                continue
            mm = re.match(r"^add\s+(?:constraint\s+\S+\s+)?(primary\s+key|foreign\s+key|unique|check|exclude)\b", a, re.I)
            if mm:
                self.table_constraint(o, re.sub(r"^add\s+", "", a, flags=re.I), ds)
                continue
            mm = re.match(rf"^add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?(.*)$", a, re.I | re.S)
            if mm and not re.match(r"^add\s+constraint\b", a, re.I):
                r = parse_column_def(mm.group(1))
                if r:
                    cname, typ, rest = r
                    o.columns[cname] = typ
                    self.inline_constraints(o, cname, rest, ds)
                continue
            mm = re.match(rf"^drop\s+(?:column\s+)?(?:if\s+exists\s+)?({IDENT})", a, re.I)
            if mm and not re.match(r"^drop\s+(constraint|not\s+null|default|identity|expression)\b", a, re.I):
                cname = unq(mm.group(1))
                o.columns.pop(cname, None)
                o.extra.setdefault("colonne_tolte", []).append(f"{cname}@{mig}")
                if cname in o.pk:
                    o.pk = []
                o.fks = [f for f in o.fks if cname not in f[0]]
                continue
            mm = re.match(rf"^drop\s+constraint\s+(?:if\s+exists\s+)?({IDENT})", a, re.I)
            if mm:
                cn = unq(mm.group(1))
                u = o.uq_by_name.pop(cn, None)
                if u is not None and u in o.uniques:
                    o.uniques.remove(u)
                if cn.endswith("_pkey"):
                    o.extra["pk_tolta_e_forse_rimessa"] = mig
                continue
            mm = re.match(rf"^alter\s+(?:column\s+)?({IDENT})\s+(?:set\s+data\s+)?type\s+(.+?)(\s+using\b.*|\s+collate\b.*)?$", a, re.I | re.S)
            if mm:
                cname = unq(mm.group(1))
                o.columns[cname] = norm_type(mm.group(2))
                o.extra.setdefault("tipi_cambiati", []).append(f"{cname}@{mig}")
                continue

    def _move(self, o, new_schema, new_name, mig, why):
        old = o.key()
        self.S.rel.pop(old, None)
        tgt = self.S.rel.get((new_schema, new_name))
        o.extra.setdefault("storia_nome", []).append(f"{old[0]}.{old[1]} {why}@{mig}")
        o.schema, o.name = new_schema, new_name
        oldq, newq = f"{old[0]}.{old[1]}", f"{new_schema}.{new_name}"
        for ob in list(self.S.rel.values()) + [o]:
            ob.fks = [(cs, newq if t == oldq else t) for cs, t in ob.fks]
        if tgt is not None and tgt.dropped is None:
            self.S.limit(mig, 0, "spostamento su un nome già occupato", why)
        self.S.rel[(new_schema, new_name)] = o


# ---------------------------------------------------------------------------
# 4. Guida
# ---------------------------------------------------------------------------
def load_files(project, folder):
    files = sorted(f for f in os.listdir(folder) if f.endswith(".sql"))
    for f in files:
        with open(os.path.join(folder, f), encoding="utf-8", errors="replace") as fh:
            text = fh.read()
        if project == "datastore":
            i, j = text.find("-- MIGRAZIONE:SU"), text.find("-- MIGRAZIONE:GIU")
            if i < 0 or j < 0 or j < i:
                yield f, text, "senza marcatori SU/GIU: letto intero"
                continue
            line_off = text[:i].count("\n")
            yield f, "\n" * line_off + text[i + len("-- MIGRAZIONE:SU"):j], None
        else:
            yield f, text, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--progetto", required=True, choices=["advanced", "datastore"])
    ap.add_argument("--migrazioni", required=True)
    ap.add_argument("--uscita", required=True, help="prefisso dei file prodotti")
    ap.add_argument("--max-colonne", type=int, default=40)
    a = ap.parse_args()

    it = Interp(a.progetto)
    nfile = 0
    for f, text, warn in load_files(a.progetto, a.migrazioni):
        nfile += 1
        it.default_schema = "public"
        mig = f[:-4]
        if warn:
            it.S.limit(mig, 0, warn, "")
        for stmt, line in split_statements(text):
            it.run_statement(stmt, mig, line, "STATICA")

    S = it.S
    rows = []
    allobjs = []
    for store in (S.sch, S.ext, S.typ, S.rel, S.func, S.trig):
        allobjs.extend(store.values())
    allobjs.sort(key=lambda o: (o.schema, {"SCHEMA": 0, "EXTENSION": 0}.get(o.kind, 1), o.kind, o.name))
    js = []
    for o in allobjs:
        cols = list(o.columns.items())
        if o.kind in ("VIEW", "MATERIALIZED VIEW") and not any(t for _, t in cols):
            colstr = ("colonne: " + ", ".join(c for c, _ in cols) + " | " if cols else "") + "da: " + ", ".join(o.deps[:12])
        elif o.kind in ("FUNCTION", "PROCEDURE"):
            colstr = "(" + " / ".join(o.extra.get("firme", [])) + ") -> " + o.extra.get("returns", "?")
        elif o.kind == "TYPE ENUM":
            colstr = "valori: " + ", ".join(o.extra.get("valori", []))
        elif o.kind == "TRIGGER":
            colstr = "esegue: " + o.extra.get("funzione", "?")
        else:
            colstr = "; ".join(f"{c} {t}" for c, t in cols[: a.max_colonne])
            if len(cols) > a.max_colonne:
                colstr += f"; ... (+{len(cols) - a.max_colonne})"
            if o.extra.get("create_as"):
                colstr = "CREATE TABLE AS da: " + ", ".join(o.deps)
            if o.extra.get("partition_of"):
                colstr = "PARTITION OF " + o.extra["partition_of"]
        stato = "VIVO" if o.dropped is None else "RITIRATO"
        is_table = o.kind == "TABLE"
        rows.append(OrderedDict([
            ("schema", o.schema), ("oggetto", o.name), ("tipo", o.kind),
            ("crea", o.created), ("alterano", ",".join(o.altered)),
            ("drop", o.dropped or ""), ("stato", stato),
            ("ricreato_in", ",".join(o.recreated)),
            ("pk", (",".join(o.pk) if o.pk else ("NO" if is_table and not o.extra.get("partition_of") else "")) if is_table else ""),
            ("n_fk", str(len(o.fks)) if is_table else ""),
            ("fk_verso", ",".join(sorted(set(t for _, t in o.fks)))),
            ("unique", " | ".join(o.uniques)[:300]),
            ("n_colonne", str(len(cols)) if o.kind in REL_KINDS else ""),
            ("colonne_principali", colstr),
            ("origine", "+".join(sorted(o.origin))),
            ("note", "; ".join(f"{k}={v if not isinstance(v, (list, dict)) else (','.join(v) if isinstance(v, list) else len(v))}"
                                for k, v in o.extra.items() if k not in ("firme", "returns", "valori", "funzione", "commenti_colonne"))[:300]),
            ("commento", norm_ws(o.comment)[:240]),
        ]))
        js.append({
            "schema": o.schema, "oggetto": o.name, "tipo": o.kind, "crea": o.created,
            "alterano": o.altered, "drop": o.dropped, "storia_drop": o.drop_history,
            "ricreato_in": o.recreated, "colonne": o.columns, "pk": o.pk,
            "fk": [{"colonne": c, "verso": t} for c, t in o.fks], "unique": o.uniques,
            "n_indici": o.indexes, "dipendenze": o.deps, "commento": o.comment,
            "origine": sorted(o.origin), "extra": o.extra,
        })

    with open(a.uscita + ".tsv", "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, delimiter="\t", lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
        w.writerow(list(rows[0].keys()))
        for r in rows:
            w.writerow([str(v).replace("\t", " ").replace("\n", " ") for v in r.values()])
    with open(a.uscita + ".json", "w", encoding="utf-8") as fh:
        json.dump({"progetto": a.progetto, "file_letti": nfile, "statistiche": S.stats, "oggetti": js},
                  fh, ensure_ascii=False, indent=1)
    with open(a.uscita + "_limiti.tsv", "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, delimiter="\t", lineterminator="\n")
        w.writerow(["migrazione", "riga", "motivo", "istruzione"])
        for r in S.limits:
            w.writerow(r)

    from collections import Counter
    cnt = Counter((r["tipo"], r["stato"]) for r in rows)
    print(f"[{a.progetto}] file letti: {nfile}; statistiche: {S.stats}")
    for (t, st), c in sorted(cnt.items()):
        print(f"  {t:18s} {st:9s} {c}")
    print(f"  limiti registrati: {len(S.limits)}")


if __name__ == "__main__":
    main()
