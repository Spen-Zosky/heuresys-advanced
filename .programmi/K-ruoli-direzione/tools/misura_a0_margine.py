"""Mandato S1105, voce A0: misura la distribuzione dei salti di contesto fra due
misure consecutive, su transcript K reali e conclusi. Replica la stessa logica di
campionamento di ~/.claude/tools/guardiano.py (campiona()): un campione per ogni
riga con message.usage, contesto = input_tokens + cache_read_input_tokens +
cache_creation_input_tokens. Non stima: legge gli stessi blocchi che l'API ha
restituito.

Uso: python misura_a0_margine.py <path.jsonl> [<path.jsonl> ...]
"""
import json
import sys
from pathlib import Path

FINESTRA = 1_000_000  # misurata da context-window.json per questo modello/sessione (guardiano.py, A0 lo assume costante fra le sessioni K: stesso modello Sonnet 5)


def campiona(path: Path) -> list[int]:
    out = []
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
            out.append(ctx)
    return out


def percentile(vals: list[int], p: float) -> float:
    if not vals:
        return 0.0
    s = sorted(vals)
    k = (len(s) - 1) * p
    f = int(k)
    c = min(f + 1, len(s) - 1)
    if f == c:
        return float(s[f])
    return s[f] + (s[c] - s[f]) * (k - f)


def mediana(vals: list[int]) -> float:
    return percentile(vals, 0.5)


def main():
    if len(sys.argv) < 2:
        print("uso: misura_a0_margine.py <path.jsonl> [...]", file=sys.stderr)
        sys.exit(2)
    tutti_i_salti = []
    for arg in sys.argv[1:]:
        path = Path(arg)
        camp = campiona(path)
        if len(camp) < 2:
            print(f"{path.name}: meno di 2 campioni ({len(camp)}), scartato")
            continue
        salti = [b - a for a, b in zip(camp, camp[1:])]
        salti_positivi = [s for s in salti if s > 0]
        picco = max(camp)
        print(f"== {path.name} ==")
        print(f"  campioni: {len(camp)}  picco: {picco} ({picco/FINESTRA*100:.1f}%)")
        print(f"  salti totali: {len(salti)}  salti positivi: {len(salti_positivi)}")
        if salti_positivi:
            med = mediana(salti_positivi)
            p90 = percentile(salti_positivi, 0.90)
            mx = max(salti_positivi)
            print(f"  salto mediano:     {med:.0f} token  ({med/FINESTRA*100:.2f}%)")
            print(f"  salto 90-esimo pc: {p90:.0f} token  ({p90/FINESTRA*100:.2f}%)")
            print(f"  salto massimo:     {mx} token  ({mx/FINESTRA*100:.2f}%)")
        tutti_i_salti.extend(salti_positivi)
    if tutti_i_salti:
        print("== AGGREGATO su tutti i transcript ==")
        med = mediana(tutti_i_salti)
        p90 = percentile(tutti_i_salti, 0.90)
        mx = max(tutti_i_salti)
        print(f"  n={len(tutti_i_salti)}")
        print(f"  salto mediano:     {med:.0f} token  ({med/FINESTRA*100:.2f}%)")
        print(f"  salto 90-esimo pc: {p90:.0f} token  ({p90/FINESTRA*100:.2f}%)")
        print(f"  salto massimo:     {mx} token  ({mx/FINESTRA*100:.2f}%)")


if __name__ == "__main__":
    main()
