#!/usr/bin/env python3
"""Prova di chiudi.py su un repository usa-e-getta (mai sull'originale).

    python docs/kb/tools/test_chiudi.py

Copia chiudi.py e chiudi_leggero.py in un repo temporaneo con la stessa disposizione
(docs/kb/tools/), senza linter ne' cancello: restano le tre mosse. Le prove sono sul verdetto:
un file sporco o una vista rapida vecchia fanno dire NO; pulito e aggiornato fa dire SI.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

QUI = Path(__file__).resolve().parent


def sh(cwd: Path, *cmd: str) -> subprocess.CompletedProcess:
    return subprocess.run(list(cmd), cwd=str(cwd), capture_output=True, text=True, encoding="utf-8")


class ChiudiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.dir = Path(tempfile.mkdtemp(prefix="chiudi_prova_"))
        tools = self.dir / "docs" / "kb" / "tools"
        tools.mkdir(parents=True)
        for n in ("chiudi.py", "chiudi_leggero.py"):
            shutil.copy(QUI / n, tools / n)
        (self.dir / ".handoff").mkdir()
        self.stato = self.dir / ".handoff" / "STATE.md"
        self.stato.write_text(f"**Updated**: {time.strftime('%Y-%m-%d')} (prova)\n", encoding="utf-8")
        (self.dir / ".gitignore").write_text(".handoff/close-log.ndjson\n__pycache__/\n",encoding="utf-8")
        sh(self.dir, "git", "init", "-q")
        sh(self.dir, "git", "add", "-A")
        sh(self.dir, "git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "base")
        self.registro = self.dir / ".handoff" / "close-log.ndjson"

    def tearDown(self) -> None:
        shutil.rmtree(self.dir, ignore_errors=True)

    def chiudi(self, *args: str) -> subprocess.CompletedProcess:
        return sh(self.dir, sys.executable, "docs/kb/tools/chiudi.py", "--sessione", "SPROVA", *args)

    def test_pulito_si_chiude_con_cinque_righe_e_registro(self) -> None:
        p = self.chiudi()
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        righe = p.stdout.strip().splitlines()
        self.assertEqual(len(righe), 5)
        self.assertEqual([r.split(":")[0] for r in righe], ["VERIFICA", "DEPOSITO", "PROPAGAZIONE", "PROVE", "ROSSI"])
        riga = json.loads(self.registro.read_text(encoding="utf-8").splitlines()[-1])
        self.assertEqual(set(riga), {"ts", "session", "run", "host", "head", "step", "outcome", "why"})
        self.assertEqual((riga["step"], riga["outcome"]), ("chiusura", "eseguito"))

    def test_file_sporco_fa_dire_no(self) -> None:
        (self.dir / "nuovo.txt").write_text("x", encoding="utf-8")
        p = self.chiudi()
        self.assertEqual(p.returncode, 1, p.stdout)
        self.assertIn("lavoro:", p.stdout.splitlines()[-1])

    def test_vista_rapida_vecchia_fa_dire_no(self) -> None:
        self.stato.write_text("**Updated**: 2020-01-01 (vecchia)\n", encoding="utf-8")
        sh(self.dir, "git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "vecchia")
        p = self.chiudi()
        self.assertEqual(p.returncode, 1, p.stdout)
        self.assertIn("vista-rapida:", p.stdout.splitlines()[-1])

    def test_onda_con_dimostrazione_rossa_fa_dire_no(self) -> None:
        ok = self.chiudi("--livello", "onda", "--dimostrazioni", f'"{sys.executable}" -c "raise SystemExit(0)"')
        self.assertEqual(ok.returncode, 0, ok.stdout + ok.stderr)
        ko = self.chiudi("--livello", "onda", "--dimostrazioni", f'"{sys.executable}" -c "raise SystemExit(3)"')
        self.assertEqual(ko.returncode, 1, ko.stdout)
        self.assertIn("dimostrazione", ko.stdout.splitlines()[-1])

    def test_rilascio_senza_rilascio_armato_non_fa_niente(self) -> None:
        p = self.chiudi("--livello", "rilascio")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertIn("nessun rilascio armato", p.stdout)
        self.assertEqual(len(p.stdout.strip().splitlines()), 5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
